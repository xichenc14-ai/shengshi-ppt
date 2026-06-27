import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getSession } from '@/lib/session';
import { isAdminIdentity } from '@/lib/admin-auth';
import { getSharedKeyPoolRemaining } from '@/lib/gamma-key-pool';

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

function derivePlanExpireFromOrder(order: { paid_at?: string | null; created_at?: string; metadata?: unknown }): string | null {
  const paidAt = order.paid_at || order.created_at;
  if (!paidAt) return null;
  const metadata = (order.metadata as { billing?: string; monthsOverride?: number } | null) || {};
  const manualExpire = (order.metadata as { manualExpireAt?: string; expiresAt?: string } | null)?.manualExpireAt
    || (order.metadata as { manualExpireAt?: string; expiresAt?: string } | null)?.expiresAt;
  if (manualExpire) {
    const md = new Date(manualExpire);
    if (!Number.isNaN(md.getTime())) return md.toISOString();
  }
  const months = typeof metadata.monthsOverride === 'number' && metadata.monthsOverride > 0
    ? metadata.monthsOverride
    : ((metadata.billing || 'monthly') === 'annual' ? 12 : 1);
  const expire = addMonths(paidAt, months);
  return expire || null;
}

async function readRecentOrders(sb: NonNullable<ReturnType<typeof getSupabase>>, userId: string) {
  const selections = [
    'id,order_no,product_type,product_name,amount,status,pay_method,metadata,paid_at,created_at',
    'id,order_no,product_type,product_name,amount,status,payment_provider,paid_at,created_at',
    'id,order_no,product_type,product_name,amount,status,paid_at,created_at',
  ];

  for (const select of selections) {
    const res = await sb
      .from('orders')
      .select(select)
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(100);
    if (!res.error) return res;
  }

  return await sb
    .from('orders')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(100);
}

export async function GET() {
  const session = await getSession();
  if (!session?.isLoggedIn || !session.user?.id) {
    return NextResponse.json({ error: '请先登录' }, { status: 401 });
  }
  const userId = session.user.id;

  const sb = getSupabase();
  if (!sb) return NextResponse.json({ error: '服务未配置' }, { status: 503 });

  try {
    const userWithExpireRes = await sb
      .from('users')
      .select('id,phone,nickname,credits,plan_type,total_credits_used,last_login_at,created_at,plan_expires_at')
      .eq('id', userId)
      .single();

    const userRes = userWithExpireRes.error && String(userWithExpireRes.error.message || '').includes('plan_expires_at')
      ? await sb
          .from('users')
          .select('id,phone,nickname,credits,plan_type,total_credits_used,last_login_at,created_at')
          .eq('id', userId)
          .single()
      : userWithExpireRes;

    const [orderRes, txRes] = await Promise.all([
      readRecentOrders(sb, userId),
      sb
        .from('credit_transactions')
        .select('id,amount,type,description,created_at')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(300),
    ]);

    if (userRes.error || !userRes.data) {
      return NextResponse.json({ error: '用户信息获取失败' }, { status: 500 });
    }
    if (orderRes.error) return NextResponse.json({ error: orderRes.error.message }, { status: 500 });
    if (txRes.error) return NextResponse.json({ error: txRes.error.message }, { status: 500 });

    const user = userRes.data;
    const orders = orderRes.data || [];
    const transactions = txRes.data || [];

    const isPaidOrder = (status: string | null | undefined) => status === 'completed' || status === 'paid';
    const completedSubOrders = orders.filter((o) => isPaidOrder(o.status) && o.product_type === 'subscription');
    const lastSubOrder = completedSubOrders[0];
    const derivedExpire = lastSubOrder ? derivePlanExpireFromOrder(lastSubOrder) : null;
    const planExpiresAt = (user as { plan_expires_at?: string | null }).plan_expires_at || derivedExpire;

    const generationCount = transactions.filter((t) => {
      const type = String(t.type || '').toLowerCase();
      return type.includes('generation') || String(t.description || '').includes('生成PPT');
    }).length;

    const downloadCount = transactions.filter((t) => {
      const type = String(t.type || '').toLowerCase();
      return type.includes('download') || String(t.description || '').includes('下载');
    }).length;

    const paidAmountYuan = orders
      .filter((o) => isPaidOrder(o.status))
      .reduce((sum, o) => sum + Number(o.amount || 0) / 100, 0);

    const isAdmin = isAdminIdentity({ id: user.id, phone: user.phone || '' });
    const userCredits = isAdmin ? (() => {
      try { return getSharedKeyPoolRemaining(); } catch { return 0; }
    })() : Number(user.credits || 0);
    const gammaPoolCredits = isAdmin ? (() => {
      try { return getSharedKeyPoolRemaining(); } catch { return 0; }
    })() : null;

    return NextResponse.json({
      user: {
        id: user.id,
        phone: user.phone || '',
        nickname: user.nickname || '用户',
        credits: userCredits,
        plan_type: user.plan_type || 'free',
        plan_expires_at: planExpiresAt,
        total_credits_used: Number((user as { total_credits_used?: number | null }).total_credits_used || 0),
        last_login_at: user.last_login_at,
        created_at: user.created_at,
      },
      metrics: {
        generation_count: generationCount,
        download_count: downloadCount,
        paid_amount_yuan: Number(paidAmountYuan.toFixed(2)),
      },
      admin: isAdmin ? {
        gamma_pool_credits: gammaPoolCredits,
        gamma_pool_note: '基于最近一次 Gamma 生成响应追踪；与用户积分独立',
      } : null,
      recentOrders: orders.slice(0, 20),
      recentTransactions: transactions.slice(0, 80),
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : '加载失败';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
