import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { requireAdmin } from '@/lib/admin-auth';

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key);
}

function safeReason(reason?: string): string {
  return (reason || '').trim().slice(0, 120) || '后台调整';
}

function addMonths(baseISO: string, months: number): string {
  const d = new Date(baseISO);
  if (Number.isNaN(d.getTime())) return '';
  d.setMonth(d.getMonth() + months);
  return d.toISOString();
}

function toIsoDateEnd(input: string): string | null {
  const trimmed = String(input || '').trim();
  if (!trimmed) return null;
  // 支持 YYYY-MM-DD / ISO
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    return `${trimmed}T23:59:59.999Z`;
  }
  const d = new Date(trimmed);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString();
}

function calcPlanExpireFromOrders(orders: Array<{ paid_at?: string | null; created_at?: string; metadata?: unknown }>): string | null {
  let latest: string | null = null;
  for (const order of orders) {
    const explicitExpire = (order.metadata as { manualExpireAt?: string; expiresAt?: string } | null)?.manualExpireAt
      || (order.metadata as { manualExpireAt?: string; expiresAt?: string } | null)?.expiresAt;
    if (explicitExpire) {
      const explicitDate = new Date(explicitExpire);
      if (!Number.isNaN(explicitDate.getTime())) {
        const exp = explicitDate.toISOString();
        if (!latest || new Date(exp).getTime() > new Date(latest).getTime()) latest = exp;
        continue;
      }
    }
    const md = (order.metadata as { billing?: string; monthsOverride?: number } | null) || {};
    const months = typeof md.monthsOverride === 'number' && md.monthsOverride > 0
      ? md.monthsOverride
      : ((md.billing || 'monthly') === 'annual' ? 12 : 1);
    const start = order.paid_at || order.created_at;
    if (!start) continue;
    const expire = addMonths(start, months);
    if (!expire) continue;
    if (!latest || new Date(expire).getTime() > new Date(latest).getTime()) latest = expire;
  }
  return latest;
}

export async function POST(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.reason || '无权限' }, { status: auth.reason === '请先登录' ? 401 : 403 });
  }

  const sb = getSupabase();
  if (!sb) return NextResponse.json({ error: '服务未配置' }, { status: 503 });

  try {
    const body = await request.json();
    const action = String(body?.action || '');
    const targetUserId = String(body?.targetUserId || '');
    if (!targetUserId) return NextResponse.json({ error: '缺少目标用户ID' }, { status: 400 });

    const { data: user, error: qErr } = await sb
      .from('users')
      .select('id,credits,plan_type')
      .eq('id', targetUserId)
      .single();
    if (qErr || !user) return NextResponse.json({ error: '用户不存在' }, { status: 404 });

    if (action === 'adjust_credits') {
      const delta = Number(body?.delta || 0);
      const reason = safeReason(body?.reason);
      if (!Number.isFinite(delta) || delta === 0) return NextResponse.json({ error: '积分调整值无效' }, { status: 400 });

      const currentCredits = Number(user.credits || 0);
      if (delta < 0 && currentCredits + delta < 0) {
        return NextResponse.json({
          error: '积分不足，不能扣成负数',
          balance: currentCredits,
        }, { status: 400 });
      }
      const nextCredits = currentCredits + delta;
      const { data: updatedUser, error: uErr } = await sb
        .from('users')
        .update({ credits: nextCredits })
        .eq('id', targetUserId)
        .eq('credits', currentCredits)
        .select('credits')
        .single();
      if (uErr || !updatedUser) {
        return NextResponse.json({ error: '积分已发生变化，请刷新后重试' }, { status: 409 });
      }

      const { error: txErr } = await sb.from('credit_transactions').insert({
        user_id: targetUserId,
        amount: delta,
        balance_after: nextCredits,
        type: 'admin_adjust',
        description: `后台调账-${reason}`,
      });

      return NextResponse.json({
        success: true,
        action,
        credits: Number(updatedUser.credits),
        transactionRecorded: !txErr,
        warning: txErr ? '积分已更新，但流水记录失败' : undefined,
      });
    }

    if (action === 'set_plan') {
      const planType = String(body?.planType || '').trim();
      if (!['free', 'shengxin', 'advanced', 'basic', 'standard', 'pro', 'vip', 'supreme'].includes(planType)) {
        return NextResponse.json({ error: '套餐类型无效' }, { status: 400 });
      }
      const { error: setErr } = await sb.from('users').update({ plan_type: planType }).eq('id', targetUserId);
      if (setErr) return NextResponse.json({ error: '套餐更新失败' }, { status: 500 });
      return NextResponse.json({ success: true, action, plan_type: planType });
    }

    if (action === 'set_plan_date' || action === 'grant_membership') {
      const planTypeRaw = String(body?.planType || '').trim();
      const planType = planTypeRaw || (String(user.plan_type || 'free'));
      const reason = safeReason(body?.reason);
      const expireAtISO = toIsoDateEnd(String(body?.expireAt || body?.expiresAt || ''));

      if (!['free', 'shengxin', 'advanced', 'basic', 'standard', 'pro', 'vip', 'supreme'].includes(planType)) {
        return NextResponse.json({ error: '套餐类型无效' }, { status: 400 });
      }
      if (!expireAtISO) {
        return NextResponse.json({ error: '请提供有效到期日期（YYYY-MM-DD）' }, { status: 400 });
      }

      const grantCredits = Number(body?.grantCredits || 0);
      let nextCredits = Number(user.credits || 0);
      if (grantCredits && Number.isFinite(grantCredits)) {
        nextCredits = Math.max(0, nextCredits + grantCredits);
      }

      // 优先写入users中的到期字段（如果存在）
      let userUpdateErr: { message?: string } | null = null;
      ({
        error: userUpdateErr,
      } = await sb.from('users').update({
        plan_type: planType,
        credits: nextCredits,
        plan_expires_at: expireAtISO,
      }).eq('id', targetUserId));

      if (userUpdateErr && String(userUpdateErr.message || '').includes('plan_expires_at')) {
        ({ error: userUpdateErr } = await sb.from('users').update({
          plan_type: planType,
          credits: nextCredits,
        }).eq('id', targetUserId));
      }
      if (userUpdateErr) return NextResponse.json({ error: `用户更新失败: ${userUpdateErr.message}` }, { status: 500 });

      if (grantCredits && Number.isFinite(grantCredits)) {
        await sb.from('credit_transactions').insert({
          user_id: targetUserId,
          amount: grantCredits,
          balance_after: nextCredits,
          type: 'admin_grant',
          description: `后台授予会员积分-${reason}`,
        });
      }

      // 兜底：插入一条订阅订单，确保即使没有plan_expires_at字段，也能从订单元数据推导到期
      const orderNo = `admin_set_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
      await sb.from('orders').insert({
        user_id: targetUserId,
        order_no: orderNo,
        product_type: 'subscription',
        product_name: '后台手动授予/改期',
        amount: 0,
        status: 'completed',
        pay_method: 'admin',
        metadata: {
          manualExpireAt: expireAtISO,
          reason,
          operator: auth.userId,
          planType,
          action,
        },
        paid_at: new Date().toISOString(),
      });

      return NextResponse.json({
        success: true,
        action,
        plan_type: planType,
        plan_expires_at: expireAtISO,
        credits: nextCredits,
      });
    }

    if (action === 'extend_plan') {
      const months = Math.max(1, Math.min(24, Number(body?.months || 1)));
      const reason = safeReason(body?.reason);
      const currentPlan = String(body?.planType || user.plan_type || 'shengxin');

      const { data: subOrders } = await sb
        .from('orders')
        .select('paid_at,created_at,metadata,status,product_type')
        .eq('user_id', targetUserId)
        .eq('product_type', 'subscription')
        .order('created_at', { ascending: false })
        .limit(100);

      const paidSubOrders = (subOrders || []).filter((order) => order.status === 'completed' || order.status === 'paid');
      const latestExpire = calcPlanExpireFromOrders(paidSubOrders as Array<{ paid_at?: string | null; created_at?: string; metadata?: unknown }>);
      const now = new Date();
      const base = latestExpire && new Date(latestExpire).getTime() > now.getTime() ? new Date(latestExpire) : now;
      const paidAt = base.toISOString();

      const orderNo = `admin_ext_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
      const { error: orderErr } = await sb.from('orders').insert({
        user_id: targetUserId,
        order_no: orderNo,
        product_type: 'subscription',
        product_name: `后台续期${months}个月`,
        amount: 0,
        status: 'completed',
        pay_method: 'admin',
        metadata: { billing: 'monthly', monthsOverride: months, reason, operator: auth.userId, planType: currentPlan },
        paid_at: paidAt,
      });
      if (orderErr) return NextResponse.json({ error: `续期记录写入失败: ${orderErr.message}` }, { status: 500 });

      // 同步plan_type；到期展示从订单推导
      await sb.from('users').update({ plan_type: currentPlan }).eq('id', targetUserId);

      const nextExpire = addMonths(paidAt, months);
      return NextResponse.json({ success: true, action, plan_type: currentPlan, plan_expires_at: nextExpire });
    }

    return NextResponse.json({ error: '未知操作' }, { status: 400 });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : '后台操作失败';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
