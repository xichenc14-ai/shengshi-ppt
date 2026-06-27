import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { isCallbackIPAllowed } from '@/lib/payment';
import { verifyWechatPayCallback } from '@/lib/payment/wechat-verify';
import { verifyAlipayCallback, normalizeAlipayPublicKey } from '@/lib/payment/alipay-verify';
import { createProviderOrderIntent } from '@/lib/payment/provider-adapter';
import { getClientIP, rateLimit } from '@/lib/rate-limit';
import { isPaymentFeatureEnabledServer } from '@/lib/payment-feature';
import { canCreatePlanOrder, fulfillPaidOrder, PLAN_PRICES, reconcileUserEntitlements } from '@/lib/payment/subscription';
import { insertOrderCompat, updateOrderCompat } from '@/lib/payment/order-storage';
import { isXunhuPaidResult, queryXunhuOrder, xunhuStatusToOrderStatus } from '@/lib/payment/xunhu';

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key);
}

function amountYuanToFen(value: string | undefined): number | null {
  if (!value) return null;
  const amount = Number(value);
  if (!Number.isFinite(amount) || amount <= 0) return null;
  return Math.round(amount * 100);
}

function readProviderUrl(rawInput: unknown, key: 'url' | 'url_qrcode'): string | null {
  if (!rawInput || typeof rawInput !== 'object') return null;
  const raw = rawInput as Record<string, unknown>;
  if (typeof raw[key] === 'string' && raw[key]) return raw[key];
  const response = raw.response;
  if (response && typeof response === 'object') {
    const nested = (response as Record<string, unknown>)[key];
    if (typeof nested === 'string' && nested) return nested;
  }
  return null;
}

async function readPaymentUser(sb: NonNullable<ReturnType<typeof getSupabase>>, userId: unknown) {
  const id = typeof userId === 'string' ? userId : '';
  if (!id || id === '00000000-0000-0000-000000000000') return null;
  await reconcileUserEntitlements(sb, id);
  const selections = [
    'id,phone,nickname,avatar,credits,plan_type,plan_expires_at,is_active',
    'id,phone,nickname,credits,plan_type,plan_expires_at,is_active',
    'id,phone,nickname,avatar,credits,plan_type,is_active',
    'id,phone,nickname,credits,plan_type,is_active',
    'id,phone,nickname,credits,plan_type',
  ];
  let userRes: { data: unknown; error: unknown } | null = null;
  for (const select of selections) {
    const res = await sb.from('users').select(select).eq('id', id).single();
    if (!res.error && res.data) {
      userRes = res;
      break;
    }
  }
  if (!userRes?.data) return null;
  const user = userRes.data as Record<string, unknown>;
  return {
    id: String(user.id || id),
    phone: String(user.phone || ''),
    nickname: String(user.nickname || '用户'),
    ...(typeof user.avatar === 'string' ? { avatar: user.avatar } : {}),
    credits: Number(user.credits || 0),
    plan_type: String(user.plan_type || 'free'),
    ...(typeof user.plan_expires_at === 'string' || user.plan_expires_at === null
      ? { plan_expires_at: user.plan_expires_at as string | null }
      : {}),
    is_active: user.is_active !== false,
  };
}

// ── IP 检查已在 @/lib/payment 中统一处理 ──

// POST: 创建订单 / 支付回调
export async function POST(req: NextRequest) {
  const sb = getSupabase();
  if (!sb) return NextResponse.json({ error: '服务未配置' }, { status: 503 });

  const clientIP = getClientIP(req) || 'unknown';

  try {
    const body = await req.json();
    const { action } = body;

    // ===== 创建订单 =====
    if (action === 'create_order' || !action) {
      if (!isPaymentFeatureEnabledServer()) {
        return NextResponse.json({ error: '支付通道申请中，暂不可下单' }, { status: 503 });
      }
      const { planId, payMethod, userId, billing = 'monthly' } = body;
      const purchaseMode = String(body.purchaseMode || 'upgrade') === 'renew' ? 'renew' : 'upgrade';
      const createOrderLimit = rateLimit(`payment:create_order:${clientIP}:${userId || 'anon'}`, { windowMs: 60 * 1000, maxRequests: 6 });
      if (!createOrderLimit.allowed) {
        return NextResponse.json(
          { error: '请求过于频繁，请稍后再试' },
          {
            status: 429,
            headers: {
              'Retry-After': String(Math.max(1, Math.ceil((createOrderLimit.resetAt - Date.now()) / 1000))),
            },
          }
        );
      }

      if (!planId) return NextResponse.json({ error: '请选择套餐' }, { status: 400 });

      const plan = PLAN_PRICES[planId];
      if (!plan) return NextResponse.json({ error: '套餐不存在' }, { status: 400 });

      const isAnnual = billing === 'annual';
      const amount = isAnnual ? plan.annual : plan.monthly;
      const billingLabel = isAnnual ? '年付' : '月付';
      const targetUserId = userId || '00000000-0000-0000-000000000000';

      if (targetUserId && targetUserId !== '00000000-0000-0000-000000000000') {
        await reconcileUserEntitlements(sb, targetUserId);

        const { data: currentUser } = await sb
          .from('users')
          .select('id,plan_type')
          .eq('id', targetUserId)
          .single();
        const purchaseCheck = canCreatePlanOrder(String(currentUser?.plan_type || 'free'), planId, purchaseMode);
        if (!purchaseCheck.allowed) {
          return NextResponse.json({ error: purchaseCheck.reason || '当前套餐不可重复购买' }, { status: 409 });
        }

        const { data: pendingOrders } = await sb
          .from('orders')
          .select('*')
          .eq('user_id', targetUserId)
          .eq('status', 'pending')
          .eq('amount', Math.round(amount * 100))
          .order('created_at', { ascending: false })
          .limit(5);
        const reusableOrder = Array.isArray(pendingOrders)
          ? pendingOrders.find((item) => {
              const metadata = (item.metadata || {}) as Record<string, unknown>;
              const expiresAt = item.expires_at ? new Date(String(item.expires_at)).getTime() : Date.now() + 1;
              return expiresAt > Date.now()
                && String(metadata.planId || planId) === planId
                && String(metadata.billing || billing) === String(billing)
                && String(metadata.purchaseMode || 'upgrade') === purchaseMode;
            })
          : null;
        if (reusableOrder) {
          const metadata = (reusableOrder.metadata || {}) as Record<string, unknown>;
          const raw = (metadata.providerRaw || {}) as Record<string, unknown>;
          const payUrl = readProviderUrl(raw, 'url');
          const qrCodeUrl = readProviderUrl(raw, 'url_qrcode');
          if (!payUrl && !qrCodeUrl) {
            await sb.from('orders').update({ status: 'expired' }).eq('order_no', reusableOrder.order_no);
          } else {
            return NextResponse.json({
              order_no: reusableOrder.order_no,
              amount,
              product_name: `${plan.name}（${billingLabel}）`,
              billing,
              status: 'pending',
              provider: metadata.provider || 'xunhu',
              provider_order_id: metadata.providerOrderId || null,
              pay_url: payUrl,
              qr_code_url: qrCodeUrl,
              provider_mock: false,
              provider_raw: raw,
              reused: true,
            });
          }
        }
      }

      const orderNo = Date.now().toString(36) + Math.random().toString(36).substring(2, 10);

      const { error } = await insertOrderCompat(sb, {
          user_id: targetUserId,
          order_no: orderNo,
          product_type: 'subscription',
          product_name: `${plan.name}（${billingLabel}）`,
          amount: Math.round(amount * 100), // 分为单位
          status: 'pending',
          pay_method: payMethod || 'wechat',
          metadata: { planId, payMethod, billing, purchaseMode },
          expires_at: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
        });

      if (error) {
        console.error('[Payment][CreateOrder] insert failed:', {
          code: error.code,
          message: error.message,
          details: error.details,
          hint: error.hint,
        });
        return NextResponse.json({ error: '创建订单失败' }, { status: 500 });
      }
      console.log(`[Payment][CreateOrder] created order=${orderNo} ip=${clientIP} user=${userId || 'anon'} plan=${planId} billing=${billing} mode=${purchaseMode}`);

      const notifyUrl = process.env.PAYMENT_NOTIFY_URL || '';
      if (process.env.NODE_ENV === 'production' && !/^https:\/\//i.test(notifyUrl)) {
        return NextResponse.json({
          error: 'PAYMENT_NOTIFY_URL 未配置为 https 地址，生产环境禁止下单',
        }, { status: 503 });
      }
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

      await updateOrderCompat(sb, {
        metadata: {
          planId,
          payMethod,
          billing,
          purchaseMode,
          provider: intent.provider,
          providerOrderId: intent.providerOrderId,
          providerRaw: intent.raw || null,
        },
      }, orderNo);

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
      const callbackOrderNo = typeof body?.order_no === 'string' ? body.order_no : 'unknown';
      const callbackLimit = rateLimit(`payment:callback:${clientIP}:${callbackOrderNo}`, { windowMs: 60 * 1000, maxRequests: 30 });
      if (!callbackLimit.allowed) {
        return NextResponse.json(
          { error: '回调请求过于频繁' },
          {
            status: 429,
            headers: {
              'Retry-After': String(Math.max(1, Math.ceil((callbackLimit.resetAt - Date.now()) / 1000))),
            },
          }
        );
      }

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
      if (order.status === 'completed' || order.status === 'paid') {
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
      const isProd = process.env.NODE_ENV === 'production';

      if (pay_method === 'wechat' && wechatApiKey) {
        // 🚨 P2 Fix: 使用微信 V3 签名验证（从 HTTP 头提取）
        const verifyResult = await verifyWechatPayCallback(body, req.headers, wechatApiKey);
        if (!verifyResult.valid) {
          console.warn(`[Payment] 微信签名验证失败: ${verifyResult.reason}, order=${order_no}, ip=${clientIP}`);
          return NextResponse.json({ error: '签名验证失败' }, { status: 400 });
        }
      } else if (pay_method === 'wechat' && isProd) {
        return NextResponse.json({ error: '生产环境缺少微信回调验签配置' }, { status: 503 });
      } else if (pay_method === 'alipay' && sign) {
        // 🚨 P2 Fix: 使用支付宝 RSA2 签名验证
        const alipayPublicKey = normalizeAlipayPublicKey(process.env.ALIPAY_PUBLIC_KEY || '');
        const verifyResult = verifyAlipayCallback(body as Record<string, unknown>, alipayPublicKey);
        if (!verifyResult.valid) {
          console.warn(`[Payment] 支付宝签名验证失败: ${verifyResult.reason}, order=${order_no}, ip=${clientIP}`);
          return NextResponse.json({ error: '签名验证失败' }, { status: 400 });
        }
      } else if (pay_method === 'alipay' && isProd) {
        return NextResponse.json({ error: '生产环境缺少支付宝回调验签配置' }, { status: 503 });
      }

      // 4.1 金额一致性检查（生产/联调都启用，防止回调金额被篡改）
      if (pay_method === 'wechat' && total_fee !== undefined && total_fee !== null) {
        const callbackFen = Number(total_fee);
        if (!Number.isFinite(callbackFen) || callbackFen <= 0) {
          return NextResponse.json({ error: '微信回调金额无效' }, { status: 400 });
        }
        if (callbackFen !== Number(order.amount || 0)) {
          console.warn(`[Payment] 微信回调金额不一致: order=${order_no}, orderAmount=${order.amount}, callback=${callbackFen}`);
          return NextResponse.json({ error: '回调金额校验失败' }, { status: 400 });
        }
      }
      if (pay_method === 'alipay' && amount !== undefined && amount !== null) {
        const callbackYuan = Number(amount);
        const orderYuan = Number(order.amount || 0) / 100;
        if (!Number.isFinite(callbackYuan) || callbackYuan <= 0) {
          return NextResponse.json({ error: '支付宝回调金额无效' }, { status: 400 });
        }
        if (Math.abs(callbackYuan - orderYuan) > 0.0001) {
          console.warn(`[Payment] 支付宝回调金额不一致: order=${order_no}, orderAmount=${orderYuan}, callback=${callbackYuan}`);
          return NextResponse.json({ error: '回调金额校验失败' }, { status: 400 });
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

      const providerMetadata = {
        ...(order.metadata || {}),
        provider: pay_method || 'legacy',
        providerStatus: callbackStatus || null,
        transactionId: trade_no || null,
        lastNotifyAt: new Date().toISOString(),
        lastNotifyPayload: body,
        ...(plan_id ? { planId: plan_id } : {}),
        ...(billing ? { billing } : {}),
        ...(user_id ? { callbackUserId: user_id } : {}),
      };
      const fulfilled = await fulfillPaidOrder(sb, order as Record<string, unknown>, providerMetadata, trade_no || null);
      return NextResponse.json({ success: true, message: fulfilled.message, order: fulfilled.order });
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

    const existingMetadata = (order.metadata || {}) as Record<string, unknown>;
    if (order.status === 'paid') {
      const freshUser = await readPaymentUser(sb, order.user_id);
      return NextResponse.json({
        order: { ...order, status: 'completed' },
        message: existingMetadata.activatedPlanName ? `付款成功，恭喜您成为${existingMetadata.activatedPlanName}！` : '支付成功，会员已开通',
        user: freshUser,
      });
    }

    if (order.status === 'completed' && existingMetadata.activateError) {
      const fulfilled = await fulfillPaidOrder(
        sb,
        order as Record<string, unknown>,
        {
          ...existingMetadata,
          recoveryStatusQueryAt: new Date().toISOString(),
        },
        typeof order.trade_no === 'string' ? order.trade_no : null
      );
      const freshUser = await readPaymentUser(sb, (fulfilled.order as Record<string, unknown>)?.user_id || order.user_id);
      return NextResponse.json({ ...fulfilled, user: freshUser || fulfilled.user || null });
    }

    if (order.status === 'pending') {
      try {
        const queryResult = await queryXunhuOrder(orderNo);
        const mappedStatus = xunhuStatusToOrderStatus(queryResult.status);
        const providerMetadata = {
          ...((order.metadata || {}) as Record<string, unknown>),
          provider: 'xunhu',
          providerStatus: queryResult.status || null,
          providerOrderId: queryResult.openOrderId || null,
          transactionId: queryResult.transactionId || null,
          lastStatusQueryAt: new Date().toISOString(),
          lastStatusQueryPayload: queryResult.raw,
        };

        const queryAmountFen = amountYuanToFen(queryResult.totalFee);
        if (queryAmountFen !== null && queryAmountFen !== Number(order.amount || 0)) {
          console.warn(`[Payment][StatusQuery] amount mismatch: order=${orderNo}, orderAmount=${order.amount}, query=${queryResult.totalFee}`);
          return NextResponse.json({ order, message: '订单金额校验失败，请联系 602473182@qq.com' });
        }

        if (mappedStatus === 'completed' || isXunhuPaidResult(queryResult)) {
          const fulfilled = await fulfillPaidOrder(
            sb,
            order as Record<string, unknown>,
            providerMetadata,
            queryResult.transactionId || queryResult.openOrderId || null
          );
          const freshUser = await readPaymentUser(sb, (fulfilled.order as Record<string, unknown>)?.user_id || order.user_id);
          return NextResponse.json({ ...fulfilled, user: freshUser || fulfilled.user || null });
        }

        if (mappedStatus !== 'pending') {
          await updateOrderCompat(sb, {
            status: mappedStatus,
            trade_no: queryResult.transactionId || queryResult.openOrderId || null,
            metadata: providerMetadata,
          }, orderNo);
          return NextResponse.json({ order: { ...order, status: mappedStatus }, message: `当前订单状态：${mappedStatus}` });
        }
      } catch (queryError) {
        const msg = queryError instanceof Error ? queryError.message : 'unknown';
        console.warn(`[Payment][StatusQuery] provider query failed: order=${orderNo}, error=${msg}`);
      }
    }

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
