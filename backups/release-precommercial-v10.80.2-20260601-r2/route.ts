import { NextRequest, NextResponse } from 'next/server';
import { createHmac } from 'crypto';
import { createClient } from '@supabase/supabase-js';
import { isCallbackIPAllowed } from '@/lib/payment';
import { verifyWechatPayCallback } from '@/lib/payment/wechat-verify';
import { verifyAlipayCallback, normalizeAlipayPublicKey } from '@/lib/payment/alipay-verify';
import type { TypedSupabaseClient, CreditTransactionInsert, UserRow } from '@/lib/supabase-types';
import { createProviderOrderIntent } from '@/lib/payment/provider-adapter';

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key);
}

// ── 套餐配置 ──
const PLAN_PRICES: Record<string, { name: string; monthly: number; annual: number; credits: number }> = {
  shengxin: { name: '省心会员', monthly: 19.9, annual: 199, credits: 400 },
  advanced: { name: '高级会员', monthly: 39.9, annual: 399, credits: 1000 },
  // 兼容旧计划ID
  basic: { name: '省心会员', monthly: 19.9, annual: 199, credits: 400 },
  standard: { name: '高级会员', monthly: 39.9, annual: 399, credits: 1000 },
  pro: { name: '高级会员', monthly: 39.9, annual: 399, credits: 1000 },
  vip: { name: '高级会员', monthly: 39.9, annual: 399, credits: 1000 },
  supreme: { name: '高级会员', monthly: 39.9, annual: 399, credits: 1000 },
};

// ── IP 检查已在 @/lib/payment 中统一处理 ──

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
  // 🚨 P2 Fix: cast to any to bypass Supabase v2 typed-client Database schema type mismatch
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const typedSb: any = sb;
  const { data: currentUser, error: qErr } = await typedSb.from('users').select('credits').eq('id', userId).single();
  if (qErr || !currentUser) return { success: false, error: '用户不存在' };

  const currentCredits = Number((currentUser as UserRow).credits ?? 0);
  const newCredits = currentCredits + credits;
  const newPlanType = planType; // 直接升级
  const now = new Date();
  const nextExpire = new Date(now);
  if (isAnnual) {
    nextExpire.setFullYear(nextExpire.getFullYear() + 1);
  } else {
    nextExpire.setMonth(nextExpire.getMonth() + 1);
  }
  const planStartISO = now.toISOString();
  const planExpireISO = nextExpire.toISOString();

  let { error: updErr } = await typedSb.from('users').update({
    plan_type: newPlanType,
    credits: newCredits,
    plan_started_at: planStartISO,
    plan_expires_at: planExpireISO,
  }).eq('id', userId);

  // 兼容未升级的库：无到期字段时降级为仅更新套餐和积分
  if (updErr && String(updErr.message || '').includes('plan_started_at')) {
    ({ error: updErr } = await typedSb.from('users').update({
      plan_type: newPlanType,
      credits: newCredits,
    }).eq('id', userId));
  }

  if (updErr) return { success: false, error: '开通会员失败: ' + updErr.message };

  // 记录积分变动
  try {
    const txInsert: CreditTransactionInsert = {
      user_id: userId,
      amount: credits,
      balance_after: newCredits,
      type: 'purchase',
      description: `购买${plan.name}（${isAnnual ? '年付' : '月付'}）- 获得${credits}积分`,
    };
    await typedSb.from('credit_transactions').insert(txInsert);
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

      const notifyUrl = process.env.PAYMENT_NOTIFY_URL || '';
      const intent = await createProviderOrderIntent({
        provider: (payMethod === 'alipay' ? 'alipay' : 'wechat'),
        orderNo,
        amountFen: Math.round(amount * 100),
        subject: `${plan.name}（${billingLabel}）`,
        userId: userId || '',
        notifyUrl,
      });

      // 商业化保护：生产环境禁止 mock 支付下单，避免形成“假支付可用”状态
      if (process.env.NODE_ENV === 'production' && intent.mock) {
        const reason = String((intent.raw as { reason?: string } | null)?.reason || 'payment_provider_unavailable');
        return NextResponse.json({
          error: '支付通道未完成生产接入，暂不可下单',
          provider: intent.provider,
          reason,
        }, { status: 503 });
      }

      return NextResponse.json({
        order_no: orderNo,
        amount,
        product_name: `${plan.name}（${billingLabel}）`,
        billing,
        status: 'pending',
        provider: intent.provider,
        provider_order_id: intent.providerOrderId,
        pay_url: intent.payUrl || null,
        qr_code_url: intent.qrCodeUrl || null,
        provider_mock: intent.mock,
        provider_raw: intent.raw || null,
      });
    }

    // ===== 支付回调 webhook（已实现） =====
    if (action === 'callback') {
      if (!isCallbackIPAllowed(clientIP)) {
        console.warn(`[Payment] 回调IP不在白名单: ${clientIP}`);
        return NextResponse.json({ error: '非法请求' }, { status: 403 });
      }

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
      const wechatApiKey = process.env.WECHAT_PAY_API_KEY || '';

      if (pay_method === 'wechat' && wechatApiKey) {
        // 🚨 P2 Fix: 使用微信 V3 签名验证（从 HTTP 头提取）
        const verifyResult = await verifyWechatPayCallback(body, req.headers, wechatApiKey);
        if (!verifyResult.valid) {
          console.warn(`[Payment] 微信签名验证失败: ${verifyResult.reason}, order=${order_no}, ip=${clientIP}`);
          return NextResponse.json({ error: '签名验证失败' }, { status: 400 });
        }
      } else if (pay_method === 'alipay' && sign) {
        // 🚨 P2 Fix: 使用支付宝 RSA2 签名验证
        const alipayPublicKey = normalizeAlipayPublicKey(process.env.ALIPAY_PUBLIC_KEY || '');
        const verifyResult = verifyAlipayCallback(body as Record<string, unknown>, alipayPublicKey);
        if (!verifyResult.valid) {
          console.warn(`[Payment] 支付宝签名验证失败: ${verifyResult.reason}, order=${order_no}, ip=${clientIP}`);
          return NextResponse.json({ error: '签名验证失败' }, { status: 400 });
        }
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
      const plan = PLAN_PRICES[targetPlanId || 'shengxin'];

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
