import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { requireAdmin } from '@/lib/admin-auth';

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key);
}

function addMonths(baseISO: string, months: number): string {
  const d = new Date(baseISO);
  if (Number.isNaN(d.getTime())) return '';
  d.setMonth(d.getMonth() + months);
  return d.toISOString();
}

function planMonthsFromMetadata(metadata: unknown): number {
  const md = (metadata as { billing?: string; monthsOverride?: number } | null) || {};
  if (typeof md.monthsOverride === 'number' && md.monthsOverride > 0) return md.monthsOverride;
  return (md.billing || 'monthly') === 'annual' ? 12 : 1;
}

function expiryFromMetadata(metadata: unknown, start: string): string {
  const md = (metadata as { manualExpireAt?: string; expiresAt?: string } | null) || {};
  const manual = md.manualExpireAt || md.expiresAt;
  if (manual) {
    const d = new Date(manual);
    if (!Number.isNaN(d.getTime())) return d.toISOString();
  }
  return addMonths(start, planMonthsFromMetadata(metadata));
}

function csvEscape(v: unknown): string {
  const s = String(v ?? '');
  if (s.includes(',') || s.includes('"') || s.includes('\n')) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

export async function GET(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.reason || '无权限' }, { status: auth.reason === '请先登录' ? 401 : 403 });
  }

  const sb = getSupabase();
  if (!sb) return NextResponse.json({ error: '服务未配置' }, { status: 503 });

  const { searchParams } = new URL(request.url);
  const keyword = (searchParams.get('q') || '').trim().toLowerCase();
  const planFilter = (searchParams.get('plan') || 'all').trim().toLowerCase();

  try {
    const usersRes = await sb
      .from('users')
      .select('id,phone,nickname,credits,plan_type,total_credits_used,last_login_at,created_at')
      .order('created_at', { ascending: false })
      .limit(1000);
    const ordersRes = await sb
      .from('orders')
      .select('user_id,amount,status,product_type,metadata,paid_at,created_at')
      .order('created_at', { ascending: false })
      .limit(2000);
    const txRes = await sb
      .from('credit_transactions')
      .select('user_id,type,description')
      .order('created_at', { ascending: false })
      .limit(4000);

    if (usersRes.error) throw usersRes.error;
    if (ordersRes.error) throw ordersRes.error;
    if (txRes.error) throw txRes.error;

    const users = usersRes.data || [];
    const orders = ordersRes.data || [];
    const txs = txRes.data || [];

    const paidAmountMap = new Map<string, number>();
    const planExpireMap = new Map<string, string>();
    for (const order of orders) {
      const uid = order.user_id || '';
      if (!uid) continue;
      if (order.status === 'completed') {
        paidAmountMap.set(uid, (paidAmountMap.get(uid) || 0) + Number(order.amount || 0) / 100);
      }
      if (order.status === 'completed' && order.product_type === 'subscription') {
        const start = order.paid_at || order.created_at;
        if (!start) continue;
        const expire = expiryFromMetadata(order.metadata, start);
        const prev = planExpireMap.get(uid);
        if (!prev || new Date(expire).getTime() > new Date(prev).getTime()) planExpireMap.set(uid, expire);
      }
    }

    const genMap = new Map<string, number>();
    const dlMap = new Map<string, number>();
    for (const t of txs) {
      const uid = t.user_id || '';
      if (!uid) continue;
      const type = String(t.type || '').toLowerCase();
      const desc = String(t.description || '');
      if (type.includes('generation') || desc.includes('生成PPT')) genMap.set(uid, (genMap.get(uid) || 0) + 1);
      if (type.includes('download') || desc.includes('下载')) dlMap.set(uid, (dlMap.get(uid) || 0) + 1);
    }

    let rows = users.map((u) => ({
      id: u.id,
      nickname: u.nickname || '用户',
      phone: u.phone || '',
      plan_type: u.plan_type || 'free',
      plan_expires_at: planExpireMap.get(u.id) || '',
      credits: Number(u.credits || 0),
      total_credits_used: Number((u as { total_credits_used?: number | null }).total_credits_used || 0),
      generation_count: genMap.get(u.id) || 0,
      download_count: dlMap.get(u.id) || 0,
      paid_amount_yuan: Number((paidAmountMap.get(u.id) || 0).toFixed(2)),
      last_login_at: u.last_login_at || '',
      created_at: u.created_at || '',
    }));

    if (planFilter && planFilter !== 'all') rows = rows.filter((r) => r.plan_type.toLowerCase() === planFilter);
    if (keyword) rows = rows.filter((r) => `${r.nickname} ${r.phone} ${r.id}`.toLowerCase().includes(keyword));

    const header = ['user_id', 'nickname', 'phone', 'plan_type', 'plan_expires_at', 'credits', 'total_credits_used', 'generation_count', 'download_count', 'paid_amount_yuan', 'last_login_at', 'created_at'];
    const lines = [header.join(',')];
    for (const r of rows) {
      lines.push([
        csvEscape(r.id),
        csvEscape(r.nickname),
        csvEscape(r.phone),
        csvEscape(r.plan_type),
        csvEscape(r.plan_expires_at),
        csvEscape(r.credits),
        csvEscape(r.total_credits_used),
        csvEscape(r.generation_count),
        csvEscape(r.download_count),
        csvEscape(r.paid_amount_yuan),
        csvEscape(r.last_login_at),
        csvEscape(r.created_at),
      ].join(','));
    }

    return new NextResponse(lines.join('\n'), {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="sx-users-${Date.now()}.csv"`,
      },
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : '导出失败';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
