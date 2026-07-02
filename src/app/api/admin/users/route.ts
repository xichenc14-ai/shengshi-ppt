import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { requireAdmin } from '@/lib/admin-auth';
import { writeAdminAuditLog } from '@/lib/admin-audit';

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

function addOneMonthISO(): string {
  const d = new Date();
  d.setMonth(d.getMonth() + 1);
  return d.toISOString();
}

function normalizePlanType(planType: string): 'free' | 'plus' | 'pro' {
  if (planType === 'plus' || planType === 'shengxin' || planType === 'basic') return 'plus';
  if (['pro', 'advanced', 'standard', 'vip', 'supreme', 'enterprise'].includes(planType)) return 'pro';
  return 'free';
}

function storagePlanType(planType: string): 'free' | 'plus' | 'pro' {
  return normalizePlanType(planType);
}

function isMissingColumnError(error: { code?: string; message?: string } | null | undefined): string | null {
  if (!error) return null;
  const message = String(error.message || '');
  if (error.code !== 'PGRST204' && !message.includes('column')) return null;
  return message.match(/'([^']+)' column/)?.[1] || null;
}

async function updateUserCompat(
  sb: NonNullable<ReturnType<typeof getSupabase>>,
  userId: string,
  payload: Record<string, unknown>
): Promise<{ error: { message?: string } | null }> {
  const nextPayload = { ...payload };
  for (let i = 0; i < 8; i += 1) {
    if (Object.keys(nextPayload).length === 0) return { error: null };
    const { error } = await sb.from('users').update(nextPayload).eq('id', userId);
    const missing = isMissingColumnError(error as { code?: string; message?: string } | null);
    if (missing && missing in nextPayload) {
      delete nextPayload[missing];
      continue;
    }
    return { error: error as { message?: string } | null };
  }
  return { error: { message: '用户字段兼容更新失败' } };
}

async function readUserSnapshot(
  sb: NonNullable<ReturnType<typeof getSupabase>>,
  userId: string
) {
  const selections = [
    'id,phone,nickname,credits,plan_type,total_credits_used,last_login_at,created_at,updated_at,plan_expires_at',
    'id,phone,nickname,credits,plan_type,total_credits_used,last_login_at,created_at,updated_at',
    'id,phone,nickname,credits,plan_type,last_login_at,created_at,updated_at',
  ];
  for (const select of selections) {
    const { data, error } = await sb.from('users').select(select).eq('id', userId).single();
    if (!error && data) {
      const row = data as unknown as Record<string, unknown>;
      return {
        id: String(row.id || ''),
        phone: String(row.phone || ''),
        nickname: String(row.nickname || '用户'),
        credits: Number(row.credits || 0),
        plan_type: normalizePlanType(String(row.plan_type || 'free')),
        raw_plan_type: String(row.plan_type || 'free'),
        total_credits_used: Number(row.total_credits_used || 0),
        plan_expires_at: typeof row.plan_expires_at === 'string' ? row.plan_expires_at : null,
        last_login_at: typeof row.last_login_at === 'string' ? row.last_login_at : null,
        created_at: String(row.created_at || ''),
      };
    }
  }
  return null;
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
      await writeAdminAuditLog(sb as never, request, {
        operatorUserId: auth.userId,
        operatorPhone: auth.phone,
        action: 'user_adjust_credits',
        targetType: 'user',
        targetId: targetUserId,
        before: { credits: currentCredits },
        after: { credits: nextCredits, delta },
        reason,
      });

      const snapshot = await readUserSnapshot(sb, targetUserId);
      return NextResponse.json({
        success: true,
        action,
        credits: Number(updatedUser.credits),
        user: snapshot,
        transactionRecorded: !txErr,
        warning: txErr ? '积分已更新，但流水记录失败' : undefined,
      });
    }

    if (action === 'set_credits') {
      const nextCredits = Math.max(0, Math.floor(Number(body?.credits ?? body?.targetCredits ?? 0)));
      const reason = safeReason(body?.reason);
      if (!Number.isFinite(nextCredits)) return NextResponse.json({ error: '积分额度无效' }, { status: 400 });

      const currentCredits = Number(user.credits || 0);
      const delta = nextCredits - currentCredits;
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
        type: 'admin_set_credits',
        description: `后台设置积分为${nextCredits}-${reason}`,
      });
      await writeAdminAuditLog(sb as never, request, {
        operatorUserId: auth.userId,
        operatorPhone: auth.phone,
        action: 'user_set_credits',
        targetType: 'user',
        targetId: targetUserId,
        before: { credits: currentCredits },
        after: { credits: nextCredits, delta },
        reason,
      });

      const snapshot = await readUserSnapshot(sb, targetUserId);
      return NextResponse.json({
        success: true,
        action,
        credits: Number(updatedUser.credits),
        delta,
        user: snapshot,
        transactionRecorded: !txErr,
        warning: txErr ? '积分已更新，但流水记录失败' : undefined,
      });
    }

    if (action === 'set_plan') {
      const requestedPlanType = String(body?.planType || '').trim();
      if (!['free', 'plus', 'pro', 'shengxin', 'advanced', 'basic', 'standard', 'vip', 'supreme', 'enterprise'].includes(requestedPlanType)) {
        return NextResponse.json({ error: '套餐类型无效' }, { status: 400 });
      }
      const planType = normalizePlanType(requestedPlanType);
      const expireAtISO = planType === 'free'
        ? null
        : (toIsoDateEnd(String(body?.expireAt || body?.expiresAt || '')) || addOneMonthISO());
      const startedAt = planType === 'free' ? null : new Date().toISOString();
      const { error: setErr } = await updateUserCompat(sb, targetUserId, {
        plan_type: storagePlanType(planType),
        plan_started_at: startedAt,
        plan_expires_at: expireAtISO,
        last_entitlement_sync_at: new Date().toISOString(),
      });
      if (setErr) return NextResponse.json({ error: `套餐更新失败: ${setErr.message || ''}` }, { status: 500 });

      if (planType !== 'free') {
        const orderNo = `admin_plan_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
        await sb.from('orders').insert({
          user_id: targetUserId,
          order_no: orderNo,
          product_type: 'subscription',
          product_name: '后台手动修改套餐',
          amount: 0,
          status: 'completed',
          pay_method: 'admin',
          metadata: {
            manualExpireAt: expireAtISO,
            reason: safeReason(body?.reason),
            operator: auth.userId,
            planType,
            storagePlanType: storagePlanType(planType),
            action,
          },
          paid_at: startedAt,
        });
      }

      const snapshot = await readUserSnapshot(sb, targetUserId);
      await writeAdminAuditLog(sb as never, request, {
        operatorUserId: auth.userId,
        operatorPhone: auth.phone,
        action: 'user_set_plan',
        targetType: 'user',
        targetId: targetUserId,
        before: { plan_type: user.plan_type },
        after: { plan_type: planType, plan_expires_at: expireAtISO },
        reason: safeReason(body?.reason),
      });
      return NextResponse.json({ success: true, action, plan_type: planType, plan_expires_at: expireAtISO, user: snapshot });
    }

    if (action === 'set_plan_date' || action === 'grant_membership') {
      const planTypeRaw = String(body?.planType || '').trim();
      const planType = normalizePlanType(planTypeRaw || (String(user.plan_type || 'free')));
      const reason = safeReason(body?.reason);
      const expireAtISO = toIsoDateEnd(String(body?.expireAt || body?.expiresAt || ''));

      if (!['free', 'plus', 'pro', 'shengxin', 'advanced', 'basic', 'standard', 'vip', 'supreme', 'enterprise'].includes(planTypeRaw || planType)) {
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
        plan_type: storagePlanType(planType),
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
          storagePlanType: storagePlanType(planType),
          action,
        },
        paid_at: new Date().toISOString(),
      });
      await writeAdminAuditLog(sb as never, request, {
        operatorUserId: auth.userId,
        operatorPhone: auth.phone,
        action: action === 'grant_membership' ? 'user_grant_membership' : 'user_set_plan_date',
        targetType: 'user',
        targetId: targetUserId,
        before: { plan_type: user.plan_type, credits: user.credits },
        after: { plan_type: planType, plan_expires_at: expireAtISO, credits: nextCredits, grantCredits },
        reason,
      });

      const snapshot = await readUserSnapshot(sb, targetUserId);
      return NextResponse.json({
        success: true,
        action,
        plan_type: planType,
        plan_expires_at: expireAtISO,
        credits: nextCredits,
        user: snapshot,
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
      const nextExpire = addMonths(paidAt, months);
      await updateUserCompat(sb, targetUserId, {
        plan_type: storagePlanType(currentPlan),
        plan_started_at: paidAt,
        plan_expires_at: nextExpire,
        last_entitlement_sync_at: new Date().toISOString(),
      });

      await writeAdminAuditLog(sb as never, request, {
        operatorUserId: auth.userId,
        operatorPhone: auth.phone,
        action: 'user_extend_plan',
        targetType: 'user',
        targetId: targetUserId,
        before: { plan_type: user.plan_type },
        after: { plan_type: currentPlan, months, plan_expires_at: nextExpire },
        reason,
      });
      const snapshot = await readUserSnapshot(sb, targetUserId);
      return NextResponse.json({ success: true, action, plan_type: normalizePlanType(currentPlan), plan_expires_at: nextExpire, user: snapshot });
    }

    return NextResponse.json({ error: '未知操作' }, { status: 400 });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : '后台操作失败';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
