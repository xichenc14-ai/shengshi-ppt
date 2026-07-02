import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { requireAdmin } from '@/lib/admin-auth';
import { writeAdminAuditLog } from '@/lib/admin-audit';
import { refundXunhuOrder } from '@/lib/payment/xunhu';

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key);
}

function isPaidStatus(status: unknown): boolean {
  return status === 'completed' || status === 'paid';
}

function addMonths(baseISO: string, months: number): string | null {
  const d = new Date(baseISO);
  if (Number.isNaN(d.getTime())) return null;
  d.setMonth(d.getMonth() + months);
  return d.toISOString();
}

function normalizePlanId(raw: unknown): 'free' | 'plus' | 'pro' {
  const value = String(raw || 'free');
  if (value === 'plus' || value === 'shengxin' || value === 'basic') return 'plus';
  if (['pro', 'advanced', 'standard', 'vip', 'supreme', 'enterprise'].includes(value)) return 'pro';
  return 'free';
}

function storagePlanType(planId: string): string {
  return normalizePlanId(planId);
}

function deriveOrderExpiry(order: Record<string, any>): string | null {
  const metadata = (order.metadata || {}) as Record<string, unknown>;
  const manual = metadata.manualExpireAt || metadata.expiresAt;
  if (typeof manual === 'string') {
    const d = new Date(manual);
    if (!Number.isNaN(d.getTime())) return d.toISOString();
  }
  const start = String(order.paid_at || order.created_at || '');
  if (!start) return null;
  const months = typeof metadata.monthsOverride === 'number' && metadata.monthsOverride > 0
    ? metadata.monthsOverride
    : (metadata.billing === 'annual' ? 12 : 1);
  return addMonths(start, months);
}

async function reconcileMembershipAfterRefund(sb: NonNullable<ReturnType<typeof getSupabase>>, userId: string, refundedOrderNo: string) {
  const { data: orders } = await sb
    .from('orders')
    .select('order_no,product_name,metadata,paid_at,created_at,status,product_type')
    .eq('user_id', userId)
    .eq('product_type', 'subscription')
    .in('status', ['completed', 'paid'])
    .neq('order_no', refundedOrderNo)
    .order('paid_at', { ascending: false })
    .limit(20);

  const now = Date.now();
  let best: { planType: string; expiresAt: string } | null = null;
  for (const order of (orders || []) as Array<Record<string, any>>) {
    const expiresAt = deriveOrderExpiry(order);
    if (!expiresAt || new Date(expiresAt).getTime() <= now) continue;
    const metadata = (order.metadata || {}) as Record<string, unknown>;
    const productName = String(order.product_name || '');
    const planId = normalizePlanId(metadata.planId || (productName.includes('尊享') ? 'pro' : 'plus'));
    if (!best || new Date(expiresAt).getTime() > new Date(best.expiresAt).getTime()) {
      best = { planType: storagePlanType(planId), expiresAt };
    }
  }

  if (best) {
    await sb.from('users').update({
      plan_type: best.planType,
      plan_expires_at: best.expiresAt,
      last_entitlement_sync_at: new Date().toISOString(),
    }).eq('id', userId);
    return best;
  }

  await sb.from('users').update({
    plan_type: 'free',
    plan_started_at: null,
    plan_expires_at: null,
    last_entitlement_sync_at: new Date().toISOString(),
  }).eq('id', userId);
  return { planType: 'free', expiresAt: null };
}

function shouldAutoRefund(provider: string, body: Record<string, unknown>): boolean {
  if (body.autoRefund === true) return true;
  if (provider !== 'xunhu' && provider !== 'wechat') return false;
  return process.env.PAYMENT_AUTO_REFUND_ENABLED === 'true';
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ orderNo: string }> }
) {
  const auth = await requireAdmin(request);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.reason || '无权限' }, { status: auth.reason === '请先登录' ? 401 : 403 });
  }
  const sb = getSupabase();
  if (!sb) return NextResponse.json({ error: '服务未配置' }, { status: 503 });

  const { orderNo } = await context.params;
  const body = await request.json().catch(() => ({}));
  const reason = String(body?.reason || '').trim().slice(0, 300);
  if (!reason) return NextResponse.json({ error: '请填写退款原因' }, { status: 400 });

  const { data: order, error: orderErr } = await sb
    .from('orders')
    .select('*')
    .eq('order_no', orderNo)
    .single();
  if (orderErr || !order) return NextResponse.json({ error: '订单不存在' }, { status: 404 });
  if (!isPaidStatus(order.status)) {
    return NextResponse.json({ error: '仅已支付订单可发起退款' }, { status: 409 });
  }

  const { data: existing } = await sb
    .from('refund_requests')
    .select('id,status')
    .eq('order_no', orderNo)
    .in('status', ['requested', 'approved', 'processing', 'succeeded', 'manual_required'])
    .limit(1)
    .maybeSingle();
  if (existing) {
    return NextResponse.json({ error: `该订单已有退款记录：${existing.status}` }, { status: 409 });
  }

  const provider = String((order.metadata || {}).provider || order.pay_method || 'manual');
  let refundStatus = shouldAutoRefund(provider, body) ? 'processing' : 'manual_required';
  let providerRaw: Record<string, unknown> = {
    note: shouldAutoRefund(provider, body)
      ? '自动退款处理中'
      : '已登记退款申请。当前未启用自动退款，请在支付商户后台完成退款后更新财务记录。',
    tradeNo: order.trade_no || null,
  };
  let providerRefundId: string | null = null;

  if (refundStatus === 'processing') {
    try {
      const result = await refundXunhuOrder({
        orderNo,
        amountFen: Number(order.amount || 0),
        reason,
      });
      refundStatus = 'succeeded';
      providerRaw = result.raw;
      providerRefundId = result.refundId || null;
    } catch (e) {
      refundStatus = 'failed';
      providerRaw = {
        error: e instanceof Error ? e.message : String(e),
        note: '自动退款失败，订单未标记为已退款，请检查支付渠道后重试或人工处理。',
      };
    }
  }

  const refundPayload = {
    order_no: orderNo,
    user_id: order.user_id || null,
    amount: Number(order.amount || 0),
    reason,
    status: refundStatus,
    provider,
    provider_refund_id: providerRefundId,
    operator_user_id: auth.userId || null,
    provider_raw: providerRaw,
    ...(refundStatus === 'succeeded' ? { completed_at: new Date().toISOString() } : {}),
  };

  const { data: refund, error: refundErr } = await sb
    .from('refund_requests')
    .insert(refundPayload)
    .select('*')
    .single();
  if (refundErr || !refund) {
    return NextResponse.json({ error: refundErr?.message || '退款记录创建失败' }, { status: 500 });
  }

  const nextOrderStatus = refundStatus === 'succeeded'
    ? 'refunded'
    : refundStatus === 'failed'
      ? 'refund_failed'
      : 'refund_pending';
  const entitlementAfterRefund = refundStatus === 'succeeded' && order.user_id && order.product_type === 'subscription'
    ? await reconcileMembershipAfterRefund(sb, String(order.user_id), orderNo)
    : null;

  const nextMetadata = {
    ...(order.metadata || {}),
    refundRequestId: refund.id,
    refundReason: reason,
    refundStatus,
    refundRequestedAt: new Date().toISOString(),
    refundOperator: auth.userId || null,
    providerRefundId,
    entitlementAfterRefund,
  };
  await sb.from('orders').update({
    status: nextOrderStatus,
    metadata: nextMetadata,
  }).eq('order_no', orderNo);

  await writeAdminAuditLog(sb as never, request, {
    operatorUserId: auth.userId,
    operatorPhone: auth.phone,
    action: 'order_refund_request',
    targetType: 'order',
    targetId: orderNo,
    before: { status: order.status, metadata: order.metadata },
    after: { status: nextOrderStatus, refund, entitlementAfterRefund },
    reason,
  });

  return NextResponse.json({
    success: true,
    refund,
    order_status: nextOrderStatus,
    entitlement_after_refund: entitlementAfterRefund,
    warning: refundStatus === 'succeeded'
      ? '退款已由支付渠道返回成功，订单已标记为 refunded。'
      : refundStatus === 'failed'
        ? '自动退款失败，订单已标记为 refund_failed，请检查支付渠道后重试或人工处理。'
        : '退款申请已记录，订单已进入 refund_pending。请在支付渠道后台完成实际退款后对账。',
  });
}
