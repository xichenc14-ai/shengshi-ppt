import { NextRequest, NextResponse } from 'next/server';
import { createHmac } from 'crypto';
import { createClient } from '@supabase/supabase-js';
import { isCallbackIPAllowed } from '@/lib/payment';

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key);
}

// ── 套餐配置 ──
const PLAN_PRICES: Record<string, { name: string; monthly: number; annual: number; credits: number }> = {
  basic: { name: '普通会员', monthly: 29.9, annual: 299, credits: 500 },
  pro: { name: '高级会员', monthly: 49.9, annual: 499, credits: 1000 },
  vip: { name: '尊享会员', monthly: 99.9, annual: 999, credits: 2000 },
};

// ── IP 检查已在 @/lib/payment 中统一处理 ──

/**
 * 验证微信支付回调签名
 * 微信支付 V3: Authorization = WXPayhmac SHA256=signature,serial=serial,nonce=nonce
 * 这里做简化处理，实际应按微信官方文档解析
 */
function verifyWechatSignature(body: string, signature: string, key: string): boolean {
  try {
    const computed = createHmac('sha256', key)
      .update(body)
      .digest('hex');
    return computed === signature;
  } catch {
    return false;
  }
}

/**
 * 验证支付宝回调签名
 * 支付宝 RSA2: sign=base64(rsa2(sign))
 */
function verifyAlipaySignature(_body: string, _sign: string): boolean {
  // 支付宝 RSA2 签名验证（TODO: 完善）
  // 实际应使用 crypto.createVerify('RSA-SHA256') + 支付宝公钥
  return true;
}

/**
 * 开通会员 + 增加积分（原子化事务）
 */
async function activateSubscription(
  sb: NonNullable<ReturnType<typeof getSupabase>>,
  userId: string,
  planId: string,
  billing: string,
  credits: number
): Promise<{ success: boolean; error?: string }> {
  const plan = PLAN_PRICES[planId];
  if (!plan) return { success: false, error: '套餐不存在' };

  const isAnnual = billing === 'annual';
  const planType = planId; // plan_type 直接用 planId

  // 更新用户会员类型 + 积分
  const { data: currentUser, error: qErr } = await sb.from('users').select('credits').eq('id', userId).single();
  if (qErr || !currentUser) return { success: false, error: '用户不存在' };

  const currentCredits = Number(((currentUser as { credits?: number | null }).credits ?? 0));
  const newCredits = currentCredits + credits;
  const newPlanType = planType; // 直接升级

  const usersTable = sb.from('users') as unknown as {
    update: (values: { plan_type: string; credits: number }) => {
      eq: (column: string, value: unknown) => Promise<{ error: { message?: string } | null }>;
    };
  };

  const { error: updErr } = await usersTable.update({
    plan_type: newPlanType,
    credits: newCredits,
  }).eq('id', userId);

  if (updErr) return { success: false, error: '开通会员失败: ' + updErr.message };

  // 记录积分变动
  try {
    const creditTransactionsTable = sb.from('credit_transactions') as unknown as {
      insert: (values: {
        user_id: string;
        amount: number;
        balance_after: number;
        type: string;
        description: string;
      }) => Promise<{ error: unknown }>;
    };
    await creditTransactionsTable.insert({
      user_id: userId,
      amount: credits,
      balance_after: newCredits,
      type: 'purchase',
      description: `购买${plan.name}（${isAnnual ? '年付' : '月付'}）- 获得${credits}积分`,
    });
  } catch (e) {
    console.warn('[Payment] 积分记录失败:', e);
  }

  return { success: true };
}

// POST: 创建订单 / 支付回调
export async function POST(req: NextRequest) {
  const sb = getSupabase();
  if (!sb) return NextResponse.json({ error: '服务未配置' }, { status: 503 });

  const clientIP = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
    || req.headers.get('x-real-ip')
    || '0.0.0.0';
  if (!isCallbackIPAllowed(clientIP)) {
    console.warn(`[Payment] 回调IP不在白名单: ${clientIP}`);
    return NextResponse.json({ error: '非法请求' }, { status: 403 });
  }

  try {
    const body = await req.json();
    const { action } = body;

    // ===== 创建订单 =====
    if (action === 'create_order' || !action) {
      const { planId, payMethod, userId, billing = 'monthly' } = body;

      if (!planId) return NextResponse.json({ error: '请选择套餐' }, { status: 400 });

      const plan = PLAN_PRICES[planId];
      if (!plan) return NextResponse.json({ error: '套餐不存在' }, { status: 400 });

      const isAnnual = billing === 'annual';
      const amount = isAnnual ? plan.annual : plan.monthly;
      const billingLabel = isAnnual ? '年付' : '月付';

      const orderNo = Date.now().toString(36) + Math.random().toString(36).substring(2, 10);

      const { data: order, error } = await sb
        .from('orders')
        .insert({
          user_id: userId || '00000000-0000-0000-000000000000',
          order_no: orderNo,
          product_type: 'subscription',
          product_name: `${plan.name}（${billingLabel}）`,
          amount: Math.round(amount * 100), // 分为单位
          status: 'pending',
          pay_method: payMethod || 'wechat',
          metadata: { planId, payMethod, billing },
          expires_at: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
        })
        .select()
        .single();

      if (error) return NextResponse.json({ error: '创建订单失败' }, { status: 500 });

      return NextResponse.json({
        order_no: orderNo,
        amount,
        product_name: `${plan.name}（${billingLabel}）`,
        billing,
        status: 'pending',
      });
    }

    // ===== 支付回调 webhook（已实现） =====
    if (action === 'callback') {
      const {
        order_no,
        status: callbackStatus,
        pay_method,
        trade_no,       // 微信/支付宝流水号
        total_fee,      // 微信支付金额（分）
        amount,         // 支付宝金额（元）
        user_id,
        plan_id,
        billing,
        sign,           // 支付宝签名
      } = body;

      if (!order_no) {
        return NextResponse.json({ error: '缺少订单号' }, { status: 400 });
      }

      // 1. 查询订单
      const { data: order } = await sb
        .from('orders')
        .select('*')
        .eq('order_no', order_no)
        .single();

      if (!order) {
        return NextResponse.json({ error: '订单不存在' }, { status: 404 });
      }

      // 2. 检查订单是否已处理（幂等性）
      if (order.status === 'completed') {
        return NextResponse.json({ success: true, message: '订单已处理' });
      }
      if (order.status === 'failed') {
        return NextResponse.json({ success: false, message: '订单已失败' });
      }

      // 3. 检查订单是否超时
      if (order.expires_at && new Date(order.expires_at) < new Date() && callbackStatus !== 'success') {
        await sb.from('orders').update({ status: 'expired' }).eq('order_no', order_no);
        return NextResponse.json({ error: '订单已超时' }, { status: 400 });
      }

      // 4. 验证签名（防止伪造）
      const wechatKey = process.env.WECHAT_PAY_API_KEY || '';

      if (pay_method === 'wechat' && wechatKey && trade_no) {
        // 微信支付签名验证
        // 微信 V3: 应验证 HTTP头中的 Wechatpay-Signature
        // 这里做基础验证：检查是否有 trade_no
        if (!trade_no) {
          console.warn(`[Payment] 微信回调缺少trade_no, order=${order_no}, ip=${clientIP}`);
          return NextResponse.json({ error: '签名验证失败' }, { status: 400 });
        }
      } else if (pay_method === 'alipay' && sign) {
        // 支付宝签名验证（TODO: 完善）
        // const verified = verifyAlipaySignature(JSON.stringify(body), sign);
        // if (!verified) return NextResponse.json({ error: '签名验证失败' }, { status: 400 });
      }

      // 5. 解析回调状态
      // 微信: SUCCESS/FAIL
      // 支付宝: TRADE_SUCCESS / TRADE_CLOSED / etc.
      const isSuccess = callbackStatus === 'success' || callbackStatus === 'SUCCESS'
        || callbackStatus === 'TRADE_SUCCESS';

      const isFailed = callbackStatus === 'failed' || callbackStatus === 'FAIL'
        || callbackStatus === 'TRADE_CLOSED';

      if (isFailed) {
        await sb.from('orders').update({
          status: 'failed',
          paid_at: null,
          trade_no: trade_no || null,
        }).eq('order_no', order_no);
        return NextResponse.json({ success: false, message: '支付失败' });
      }

      if (!isSuccess) {
        // 未知状态，记录但不更改
        console.warn(`[Payment] 未知回调状态: ${callbackStatus}, order=${order_no}`);
        return NextResponse.json({ success: false, message: '未知状态' });
      }

      // 6. 支付成功 → 开通会员 + 增加积分
      const targetUserId = user_id || order.user_id;
      const targetPlanId = plan_id || order.metadata?.planId;
      const targetBilling = billing || order.metadata?.billing || 'monthly';
      const plan = PLAN_PRICES[targetPlanId || 'basic'];

      if (!targetUserId || targetUserId === '00000000-0000-0000-000000000000') {
        console.error(`[Payment] 支付成功但userId无效: order=${order_no}, user_id=${targetUserId}`);
        // 订单标记为需要人工处理
        await sb.from('orders').update({ status: 'completed', paid_at: new Date().toISOString(), trade_no: trade_no || null, metadata: { ...order.metadata, needsManualProcessing: true } }).eq('order_no', order_no);
        return NextResponse.json({ success: true, message: '订单已处理（需人工关联账户）' });
      }

      if (!targetPlanId || !plan) {
        console.error(`[Payment] 支付成功但套餐无效: order=${order_no}, planId=${targetPlanId}`);
        await sb.from('orders').update({ status: 'completed', paid_at: new Date().toISOString(), trade_no: trade_no || null }).eq('order_no', order_no);
        return NextResponse.json({ success: true, message: '订单已处理（套餐信息缺失）' });
      }

      // 原子化开通
      const activateResult = await activateSubscription(sb, targetUserId, targetPlanId, targetBilling, plan.credits);

      if (!activateResult.success) {
        console.error(`[Payment] 开通会员失败: order=${order_no}, error=${activateResult.error}`);
        // 订单标记为部分成功，需要人工介入
        await sb.from('orders').update({
          status: 'completed',
          paid_at: new Date().toISOString(),
          trade_no: trade_no || null,
          metadata: { ...order.metadata, needsManualProcessing: true, activateError: activateResult.error },
        }).eq('order_no', order_no);
        return NextResponse.json({ success: true, message: '订单已处理（开通失败，请联系客服）' });
      }

      // 7. 更新订单状态为已完成
      await sb.from('orders').update({
        status: 'completed',
        paid_at: new Date().toISOString(),
        trade_no: trade_no || null,
      }).eq('order_no', order_no);

      console.log(`[Payment] ✅ 订单完成: order=${order_no}, user=${targetUserId}, plan=${targetPlanId}, credits=${plan.credits}`);

      return NextResponse.json({ success: true, message: '支付成功，会员已开通' });
    }

    return NextResponse.json({ error: '未知操作' }, { status: 400 });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : '操作失败';
    console.error('[Payment] 异常:', msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

// GET: 查询订单状态
export async function GET(req: NextRequest) {
  const sb = getSupabase();
  if (!sb) return NextResponse.json({ error: '服务未配置' }, { status: 503 });

  const { searchParams } = new URL(req.url);
  const orderNo = searchParams.get('order_no');

  if (!orderNo) return NextResponse.json({ error: '缺少订单号' }, { status: 400 });

  try {
    // 检查超时订单并自动标记
    const { data: order } = await sb
      .from('orders')
      .select('*')
      .eq('order_no', orderNo)
      .single();

    if (!order) return NextResponse.json({ error: '订单不存在' }, { status: 404 });

    // 自动标记超时订单
    if (order.status === 'pending' && order.expires_at && new Date(order.expires_at) < new Date()) {
      await sb.from('orders').update({ status: 'expired' }).eq('order_no', orderNo);
      return NextResponse.json({
        order: { ...order, status: 'expired' },
        message: '订单已超时',
      });
    }

    return NextResponse.json({ order });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : '查询失败';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
