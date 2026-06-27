import type { SupabaseClient } from '@supabase/supabase-js';
import type { CreditTransactionInsert, UserRow } from '@/lib/supabase-types';
import { updateOrderCompat } from '@/lib/payment/order-storage';

export const FREE_MONTHLY_CREDITS = 40;

export const PLAN_PRICES: Record<string, { name: string; monthly: number; annual: number; credits: number; rank: number }> = {
  shengxin: { name: '省心会员', monthly: 19.9, annual: 199, credits: 500, rank: 1 },
  advanced: { name: '尊享会员', monthly: 49.9, annual: 499, credits: 1500, rank: 2 },
  basic: { name: '省心会员', monthly: 19.9, annual: 199, credits: 500, rank: 1 },
  standard: { name: '尊享会员', monthly: 49.9, annual: 499, credits: 1500, rank: 2 },
  pro: { name: '尊享会员', monthly: 49.9, annual: 499, credits: 1500, rank: 2 },
  vip: { name: '尊享会员', monthly: 49.9, annual: 499, credits: 1500, rank: 2 },
  supreme: { name: '尊享会员', monthly: 49.9, annual: 499, credits: 1500, rank: 2 },
};

export type PaymentSupabase = SupabaseClient | {
  from: (table: string) => unknown;
};

type SupabaseError = {
  code?: string;
  message?: string;
  details?: string | null;
  hint?: string | null;
};

type UserEntitlementRow = {
  id: string;
  credits?: number | null;
  plan_type?: string | null;
  created_at?: string | null;
  plan_started_at?: string | null;
  plan_expires_at?: string | null;
  free_cycle_anchor?: string | null;
  free_credits_reset_at?: string | null;
  last_entitlement_sync_at?: string | null;
};

type OrderLike = Record<string, unknown>;

function missingSchemaColumn(error: SupabaseError | null | undefined): string | null {
  if (!error || error.code !== 'PGRST204') return null;
  const match = String(error.message || '').match(/'([^']+)' column/);
  return match?.[1] || null;
}

async function runWithMissingColumnRetry(
  payload: Record<string, unknown>,
  run: (nextPayload: Record<string, unknown>) => Promise<{ error: SupabaseError | null; data?: unknown }>
): Promise<{ error: SupabaseError | null; payload: Record<string, unknown>; stripped: string[]; data?: unknown }> {
  let nextPayload = { ...payload };
  const stripped: string[] = [];

  for (let attempt = 0; attempt < 8; attempt += 1) {
    const result = await run(nextPayload);
    const missing = missingSchemaColumn(result.error);
    if (!missing || !(missing in nextPayload)) {
      return { ...result, payload: nextPayload, stripped };
    }
    stripped.push(missing);
    delete nextPayload[missing];
  }

  return {
    error: { code: 'PGRST204', message: `Too many missing columns: ${stripped.join(', ')}` },
    payload: nextPayload,
    stripped,
  };
}

async function updateUserCompat(
  sb: PaymentSupabase,
  userId: string,
  payload: Record<string, unknown>
): Promise<{ error: SupabaseError | null; stripped: string[] }> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const typedSb: any = sb;
  const result = await runWithMissingColumnRetry(payload, async (nextPayload) => {
    if (Object.keys(nextPayload).length === 0) return { error: null };
    const query = typedSb.from('users').update(nextPayload).eq('id', userId);
    return await query;
  });
  if (result.stripped.length > 0) {
    console.warn(`[Membership] users update stripped missing columns: ${result.stripped.join(', ')}, user=${userId}`);
  }
  return { error: result.error, stripped: result.stripped };
}

function addBillingPeriod(from: Date, billing: string): Date {
  const next = new Date(from);
  if (billing === 'annual') next.setFullYear(next.getFullYear() + 1);
  else next.setMonth(next.getMonth() + 1);
  return next;
}

function addOneMonth(from: Date): Date {
  const next = new Date(from);
  next.setMonth(next.getMonth() + 1);
  return next;
}

export function normalizePlanId(planType?: string | null): 'free' | 'shengxin' | 'advanced' {
  const raw = String(planType || 'free');
  if (raw === 'shengxin' || raw === 'basic') return 'shengxin';
  if (raw === 'advanced' || raw === 'standard' || raw === 'pro' || raw === 'vip' || raw === 'supreme') return 'advanced';
  return 'free';
}

export function storagePlanType(planId: string): string {
  if (planId === 'shengxin') return 'basic';
  if (planId === 'advanced') return 'pro';
  return planId;
}

export function getPlanRank(planType?: string | null): number {
  const planId = normalizePlanId(planType);
  if (planId === 'advanced') return 2;
  if (planId === 'shengxin') return 1;
  return 0;
}

export function canPurchasePlan(currentPlanType: string | null | undefined, targetPlanId: string): { allowed: boolean; reason?: string } {
  const currentRank = getPlanRank(currentPlanType);
  const targetRank = getPlanRank(targetPlanId);
  if (targetRank <= 0) return { allowed: false, reason: '请选择有效会员套餐' };
  if (currentRank >= 2) return { allowed: false, reason: '您已是尊享会员，当前为最高档套餐' };
  if (currentRank >= targetRank) return { allowed: false, reason: '您当前已是该套餐会员' };
  return { allowed: true };
}

async function readUserFlexible(sb: PaymentSupabase, userId: string): Promise<UserEntitlementRow | null> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const typedSb: any = sb;
  const selections = [
    'id,credits,plan_type,created_at,plan_started_at,plan_expires_at,free_cycle_anchor,free_credits_reset_at,last_entitlement_sync_at',
    'id,credits,plan_type,created_at,plan_started_at,plan_expires_at',
    'id,credits,plan_type,created_at',
    'id,credits,plan_type',
  ];

  for (const select of selections) {
    const { data, error } = await typedSb.from('users').select(select).eq('id', userId).single();
    if (!error && data) return data as UserEntitlementRow;
  }
  return null;
}

async function latestCompletedSubscriptionExpiry(sb: PaymentSupabase, userId: string): Promise<{ planId: string; expiresAt: string | null } | null> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const typedSb: any = sb;
  const queryLatest = async (status: string) => await typedSb
      .from('orders')
      .select('product_name,paid_at,created_at,metadata,status,product_type')
      .eq('user_id', userId)
      .eq('status', status)
      .eq('product_type', 'subscription')
      .order('paid_at', { ascending: false })
      .limit(1);

  let { data } = await queryLatest('completed');
  if (!Array.isArray(data) || data.length === 0) {
    ({ data } = await queryLatest('paid'));
  }

  const order = Array.isArray(data) ? data[0] : null;
  if (!order) return null;
  const metadata = (order.metadata || {}) as Record<string, unknown>;
  const productName = String(order.product_name || '');
  const amountPlan = productName.includes('尊享') ? 'advanced' : 'shengxin';
  const planId = normalizePlanId(String(metadata.planId || amountPlan));
  const billing = String(metadata.billing || (productName.includes('年付') ? 'annual' : 'monthly'));
  const paidAt = new Date(String(order.paid_at || order.created_at || Date.now()));
  if (Number.isNaN(paidAt.getTime())) return { planId, expiresAt: null };
  return { planId, expiresAt: addBillingPeriod(paidAt, billing).toISOString() };
}

async function insertCreditTransaction(sb: PaymentSupabase, payload: CreditTransactionInsert) {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const typedSb: any = sb;
    await typedSb.from('credit_transactions').insert(payload);
  } catch (e) {
    console.warn('[Membership] 积分流水记录失败:', e);
  }
}

async function hasPurchaseTransactionForOrder(sb: PaymentSupabase, orderNo?: string | null): Promise<boolean> {
  if (!orderNo) return false;
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const typedSb: any = sb;
    const { data, error } = await typedSb
      .from('credit_transactions')
      .select('id')
      .eq('type', 'purchase')
      .ilike('description', `%订单${orderNo}%`)
      .limit(1);
    if (error) return false;
    return Array.isArray(data) && data.length > 0;
  } catch {
    return false;
  }
}

export async function reconcileUserEntitlements(
  sb: PaymentSupabase,
  userId: string
): Promise<{ success: boolean; user?: UserEntitlementRow; changed: boolean; error?: string }> {
  const user = await readUserFlexible(sb, userId);
  if (!user) return { success: false, changed: false, error: '用户不存在' };

  const now = new Date();
  const nowISO = now.toISOString();
  const currentPlanId = normalizePlanId(user.plan_type);
  const credits = Number(user.credits ?? 0);
  let changed = false;
  let nextUser: UserEntitlementRow = { ...user, credits };

  let effectiveExpiresAt = user.plan_expires_at || null;
  if (currentPlanId !== 'free' && !effectiveExpiresAt) {
    const latest = await latestCompletedSubscriptionExpiry(sb, userId);
    if (latest?.expiresAt) effectiveExpiresAt = latest.expiresAt;
  }

  if (currentPlanId !== 'free' && effectiveExpiresAt && new Date(effectiveExpiresAt) <= now) {
    const payload = {
      plan_type: 'free',
      plan_started_at: null,
      plan_expires_at: null,
      free_cycle_anchor: nowISO,
      free_credits_reset_at: nowISO,
      last_entitlement_sync_at: nowISO,
      credits: FREE_MONTHLY_CREDITS,
    };
    const { error } = await updateUserCompat(sb, userId, payload);
    if (error) return { success: false, changed, error: '会员到期降级失败: ' + error.message };
    await insertCreditTransaction(sb, {
      user_id: userId,
      amount: FREE_MONTHLY_CREDITS - credits,
      balance_after: FREE_MONTHLY_CREDITS,
      type: 'free_monthly_reset',
      description: '会员到期降级为免费用户，重置免费月额度',
    } as CreditTransactionInsert);
    nextUser = { ...nextUser, ...payload };
    changed = true;
    return { success: true, user: nextUser, changed };
  }

  if (currentPlanId === 'free') {
    const anchor = new Date(user.free_cycle_anchor || user.created_at || nowISO);
    const lastReset = user.free_credits_reset_at ? new Date(user.free_credits_reset_at) : null;
    const nextReset = addOneMonth(lastReset && !Number.isNaN(lastReset.getTime()) ? lastReset : anchor);
    const shouldReset = nextReset <= now;

    if (shouldReset) {
      const payload = {
        plan_type: 'free',
        credits: FREE_MONTHLY_CREDITS,
        free_cycle_anchor: user.free_cycle_anchor || user.created_at || nowISO,
        free_credits_reset_at: nowISO,
        last_entitlement_sync_at: nowISO,
      };
      const { error } = await updateUserCompat(sb, userId, payload);
      if (error) return { success: false, changed, error: '免费月额度重置失败: ' + error.message };
      await insertCreditTransaction(sb, {
        user_id: userId,
        amount: FREE_MONTHLY_CREDITS - credits,
        balance_after: FREE_MONTHLY_CREDITS,
        type: 'free_monthly_reset',
        description: '免费用户月度积分重置',
      } as CreditTransactionInsert);
      nextUser = { ...nextUser, ...payload };
      changed = true;
    } else {
      await updateUserCompat(sb, userId, { last_entitlement_sync_at: nowISO });
    }
  } else {
    await updateUserCompat(sb, userId, { last_entitlement_sync_at: nowISO });
  }

  return { success: true, user: nextUser, changed };
}

export async function activateSubscription(
  sb: PaymentSupabase,
  userId: string,
  planId: string,
  billing: string,
  credits: number,
  sourceOrderNo?: string | null
): Promise<{ success: boolean; error?: string; user?: UserEntitlementRow; planName?: string; expiresAt?: string }> {
  const normalizedPlanId = normalizePlanId(planId);
  const plan = PLAN_PRICES[normalizedPlanId];
  if (!plan || normalizedPlanId === 'free') return { success: false, error: '套餐不存在' };

  const reconciled = await reconcileUserEntitlements(sb, userId);
  if (!reconciled.success) return { success: false, error: reconciled.error || '用户不存在' };

  const currentUser = await readUserFlexible(sb, userId);
  if (!currentUser) return { success: false, error: '用户不存在' };

  const alreadyCredited = await hasPurchaseTransactionForOrder(sb, sourceOrderNo);
  const purchaseCheck = canPurchasePlan(currentUser.plan_type, normalizedPlanId);
  if (!purchaseCheck.allowed && normalizePlanId(currentUser.plan_type) === normalizedPlanId) {
    if (!alreadyCredited) return { success: false, error: purchaseCheck.reason || '不可重复购买当前套餐' };
  }

  const currentCredits = Number((currentUser as UserRow).credits ?? 0);
  const creditsToAdd = alreadyCredited ? 0 : credits;
  const newCredits = currentCredits + creditsToAdd;
  const now = new Date();
  const planStartISO = now.toISOString();
  const planExpireISO = addBillingPeriod(now, billing).toISOString();
  const planType = storagePlanType(normalizedPlanId);

  const updatePayload = {
    plan_type: planType,
    credits: newCredits,
    plan_started_at: planStartISO,
    plan_expires_at: planExpireISO,
    last_entitlement_sync_at: planStartISO,
  };
  const { error: updErr } = await updateUserCompat(sb, userId, updatePayload);

  if (updErr) return { success: false, error: '开通会员失败: ' + updErr.message };

  if (!alreadyCredited) {
    await insertCreditTransaction(sb, {
      user_id: userId,
      amount: credits,
      balance_after: newCredits,
      type: 'purchase',
      description: `购买${plan.name}（${billing === 'annual' ? '年付' : '月付'}）- 订单${sourceOrderNo || 'unknown'} - 获得${credits}积分`,
    } as CreditTransactionInsert);
  }

  return {
    success: true,
    user: { ...currentUser, ...updatePayload },
    planName: plan.name,
    expiresAt: planExpireISO,
  };
}

export function inferSubscriptionFromOrder(order: { product_name?: string | null; amount?: number | null; metadata?: Record<string, unknown> | null }) {
  const metadata = (order.metadata || {}) as Record<string, unknown>;
  const productName = String(order.product_name || '');
  const amount = Number(order.amount || 0);

  const planId = normalizePlanId(String(
    metadata.planId
    || (productName.includes('尊享') || amount === 4990 || amount === 49900 ? 'advanced' : 'shengxin')
  ));
  const billing = String(
    metadata.billing
    || (productName.includes('年付') || amount === 19900 || amount === 49900 ? 'annual' : 'monthly')
  );

  return { planId, billing };
}

export async function fulfillPaidOrder(
  sb: PaymentSupabase,
  order: OrderLike,
  providerMetadata: Record<string, unknown>,
  tradeNo: string | null
) {
  const orderNo = String(order.order_no || '');
  const paidAt = new Date().toISOString();
  const productType = String(order.product_type || 'subscription');

  const existingMetadata = (order.metadata || {}) as Record<string, unknown>;
  if ((order.status === 'completed' || order.status === 'paid') && !existingMetadata.activateError) {
    const metadata = existingMetadata;
    return {
      order,
      message: metadata.activatedPlanName ? `付款成功，恭喜您成为${metadata.activatedPlanName}！` : '订单已处理',
      alreadyProcessed: true,
    };
  }

  if (productType === 'download_once') {
    const metadata = {
      ...((order.metadata || {}) as Record<string, unknown>),
      ...providerMetadata,
      fulfilled: false,
      fulfilledAt: null,
    };
    await updateOrderCompat(sb as never, {
      status: 'completed',
      paid_at: paidAt,
      trade_no: tradeNo,
      metadata,
    }, orderNo);
    return { order: { ...order, status: 'completed', paid_at: paidAt, trade_no: tradeNo, metadata }, message: '支付成功，单次下载订单已生效' };
  }

  const targetUserId = String(order.user_id || '');
  const inferred = inferSubscriptionFromOrder(order);
  const targetPlanId = inferred.planId;
  const targetBilling = inferred.billing;
  const plan = PLAN_PRICES[targetPlanId];
  const baseMetadata = {
    ...((order.metadata || {}) as Record<string, unknown>),
    ...providerMetadata,
  };

  if (!targetUserId || targetUserId === '00000000-0000-0000-000000000000' || !plan) {
    const metadata = {
      ...baseMetadata,
      needsManualProcessing: true,
      manualReason: !plan ? 'invalid_plan' : 'invalid_user',
    };
    await updateOrderCompat(sb as never, {
      status: 'paid',
      paid_at: paidAt,
      trade_no: tradeNo,
      metadata,
    }, orderNo);
    return { order: { ...order, status: 'completed', paid_at: paidAt, trade_no: tradeNo, metadata }, message: '支付成功，订单需人工关联账户' };
  }

  const activateResult = await activateSubscription(sb, targetUserId, targetPlanId, targetBilling, plan.credits, orderNo);
  if (!activateResult.success) {
    const metadata = {
      ...baseMetadata,
      needsManualProcessing: true,
      activateError: activateResult.error,
    };
    await updateOrderCompat(sb as never, {
      status: 'paid',
      paid_at: paidAt,
      trade_no: tradeNo,
      metadata,
    }, orderNo);
    return { order: { ...order, status: 'completed', paid_at: paidAt, trade_no: tradeNo, metadata }, message: '支付成功，会员开通需人工处理' };
  }

  const planName = activateResult.planName || plan.name;
  const successMetadata = {
    ...baseMetadata,
    activatedPlanId: targetPlanId,
    activatedPlanName: planName,
    activatedBilling: targetBilling,
    activatedAt: paidAt,
    planExpiresAt: activateResult.expiresAt || null,
    needsManualProcessing: false,
    activateError: null,
    manualReason: null,
  };

  const updatePayload = {
    status: 'paid',
    paid_at: paidAt,
    trade_no: tradeNo,
    metadata: successMetadata,
  };
  await updateOrderCompat(sb as never, updatePayload, orderNo);

  console.log(`[Payment] order completed: order=${orderNo}, user=${targetUserId}, plan=${targetPlanId}`);
  return {
    order: { ...order, ...updatePayload, status: 'completed' },
    message: `付款成功，恭喜您成为${planName}！`,
    user: activateResult.user,
  };
}
