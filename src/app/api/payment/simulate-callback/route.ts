import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { requireAdmin } from '@/lib/admin-auth';
import type { CreditTransactionInsert, UserRow } from '@/lib/supabase-types';

type BillingCycle = 'monthly' | 'annual';

const PLAN_PRICES: Record<string, { name: string; monthly: number; annual: number; credits: number }> = {
  shengxin: { name: '省心会员', monthly: 19.9, annual: 199, credits: 500 },
  advanced: { name: '尊享会员', monthly: 49.9, annual: 499, credits: 1500 },
  basic: { name: '省心会员', monthly: 19.9, annual: 199, credits: 500 },
  standard: { name: '尊享会员', monthly: 49.9, annual: 499, credits: 1500 },
  pro: { name: '尊享会员', monthly: 49.9, annual: 499, credits: 1500 },
  vip: { name: '尊享会员', monthly: 49.9, annual: 499, credits: 1500 },
  supreme: { name: '尊享会员', monthly: 49.9, annual: 499, credits: 1500 },
};

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key);
}

async function activateSubscription(
  sb: NonNullable<ReturnType<typeof getSupabase>>,
  userId: string,
  planId: string,
  billing: BillingCycle,
  credits: number
): Promise<{ success: boolean; error?: string }> {
  const plan = PLAN_PRICES[planId];
  if (!plan) return { success: false, error: '套餐不存在' };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const typedSb: any = sb;
  const { data: currentUser, error: qErr } = await typedSb.from('users').select('credits').eq('id', userId).single();
  if (qErr || !currentUser) return { success: false, error: '用户不存在' };

  const currentCredits = Number((currentUser as UserRow).credits ?? 0);
  const newCredits = currentCredits + credits;
  const now = new Date();
  const nextExpire = new Date(now);
  if (billing === 'annual') nextExpire.setFullYear(nextExpire.getFullYear() + 1);
  else nextExpire.setMonth(nextExpire.getMonth() + 1);

  let { error: updErr } = await typedSb.from('users').update({
    plan_type: planId,
    credits: newCredits,
    plan_started_at: now.toISOString(),
    plan_expires_at: nextExpire.toISOString(),
  }).eq('id', userId);

  if (updErr && String(updErr.message || '').includes('plan_started_at')) {
    ({ error: updErr } = await typedSb.from('users').update({
      plan_type: planId,
      credits: newCredits,
    }).eq('id', userId));
  }
  if (updErr) return { success: false, error: `开通会员失败: ${updErr.message}` };

  try {
    const txInsert: CreditTransactionInsert = {
      user_id: userId,
      amount: credits,
      balance_after: newCredits,
      type: 'purchase',
      description: `【沙箱回调】购买${plan.name}（${billing === 'annual' ? '年付' : '月付'}）- 获得${credits}积分`,
    };
    await typedSb.from('credit_transactions').insert(txInsert);
  } catch {}

  return { success: true };
}

export async function POST(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.reason || '无权限' }, { status: auth.reason === '请先登录' ? 401 : 403 });
  }

  const sb = getSupabase();
  if (!sb) return NextResponse.json({ error: '服务未配置' }, { status: 503 });

  try {
    const body = await request.json() as Record<string, unknown>;
    const orderNo = String(body.order_no || '').trim();
    if (!orderNo) return NextResponse.json({ error: '缺少 order_no' }, { status: 400 });

    const dryRun = body.dry_run === true;
    const tradeNo = String(body.trade_no || `SIM_${Date.now()}`);

    const { data: order } = await sb
      .from('orders')
      .select('*')
      .eq('order_no', orderNo)
      .single();

    if (!order) return NextResponse.json({ error: '订单不存在' }, { status: 404 });

    if (order.status === 'completed') {
      return NextResponse.json({ success: true, message: '订单已完成（幂等）', order_no: orderNo });
    }

    const targetUserId = String(body.user_id || order.user_id || '');
    const targetPlanId = String(body.plan_id || order.metadata?.planId || '');
    const targetBilling = String(body.billing || order.metadata?.billing || 'monthly') as BillingCycle;
    const plan = PLAN_PRICES[targetPlanId || 'shengxin'];

    if (!targetUserId || targetUserId === '00000000-0000-0000-000000000000') {
      return NextResponse.json({ error: 'user_id 无效，无法模拟开通' }, { status: 400 });
    }
    if (!plan || !targetPlanId) {
      return NextResponse.json({ error: 'plan_id 无效，无法模拟开通' }, { status: 400 });
    }

    if (dryRun) {
      return NextResponse.json({
        success: true,
        dry_run: true,
        order_no: orderNo,
        user_id: targetUserId,
        plan_id: targetPlanId,
        billing: targetBilling,
        credits_to_add: plan.credits,
        next_status: 'completed',
      });
    }

    const activateResult = await activateSubscription(sb, targetUserId, targetPlanId, targetBilling, plan.credits);
    if (!activateResult.success) {
      return NextResponse.json({
        error: activateResult.error || '开通失败',
        order_no: orderNo,
      }, { status: 500 });
    }

    await sb.from('orders').update({
      status: 'completed',
      paid_at: new Date().toISOString(),
      trade_no: tradeNo,
      metadata: { ...(order.metadata || {}), simulatedCallback: true },
    }).eq('order_no', orderNo);

    return NextResponse.json({
      success: true,
      simulated: true,
      order_no: orderNo,
      user_id: targetUserId,
      plan_id: targetPlanId,
      credits_added: plan.credits,
      trade_no: tradeNo,
      message: '沙箱回调模拟完成，订单已标记完成并已开通会员',
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : '模拟回调失败';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
