import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { requireAdmin } from '@/lib/admin-auth';
import { getKeyPoolStatus } from '@/lib/gamma-key-pool';

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key);
}

function planMonthsFromMetadata(metadata: unknown): number {
  const md = (metadata as { billing?: string; monthsOverride?: number } | null) || {};
  if (typeof md.monthsOverride === 'number' && md.monthsOverride > 0) return md.monthsOverride;
  const billing = md.billing || 'monthly';
  return billing === 'annual' ? 12 : 1;
}

function expiryFromMetadata(metadata: unknown, paidAtOrCreatedAt: string): string {
  const md = (metadata as { manualExpireAt?: string; expiresAt?: string } | null) || {};
  const manual = md.manualExpireAt || md.expiresAt;
  if (manual) {
    const d = new Date(manual);
    if (!Number.isNaN(d.getTime())) return d.toISOString();
  }
  return addMonths(paidAtOrCreatedAt, planMonthsFromMetadata(metadata));
}

function addMonths(baseISO: string, months: number): string {
  const base = new Date(baseISO);
  if (Number.isNaN(base.getTime())) return '';
  const d = new Date(base);
  d.setMonth(d.getMonth() + months);
  return d.toISOString();
}

export async function GET(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.reason || '无权限' }, { status: auth.reason === '请先登录' ? 401 : 403 });
  }

  const sb = getSupabase();
  if (!sb) return NextResponse.json({ error: '服务未配置' }, { status: 503 });

  const { searchParams } = new URL(request.url);
  const userLimit = Math.min(Number(searchParams.get('userLimit') || 120), 300);
  const keyword = (searchParams.get('q') || '').trim().toLowerCase();
  const planFilter = (searchParams.get('plan') || 'all').trim().toLowerCase();

  try {
    const usersWithExpireRes = await sb
      .from('users')
      .select('id,phone,nickname,credits,plan_type,total_credits_used,last_login_at,created_at,updated_at,plan_expires_at')
      .order('created_at', { ascending: false })
      .limit(userLimit);

    const usersRes = usersWithExpireRes.error && String(usersWithExpireRes.error.message || '').includes('plan_expires_at')
      ? await sb
          .from('users')
          .select('id,phone,nickname,credits,plan_type,total_credits_used,last_login_at,created_at,updated_at')
          .order('created_at', { ascending: false })
          .limit(userLimit)
      : usersWithExpireRes;

    const [ordersRes, txRes] = await Promise.all([
      sb
        .from('orders')
        .select('id,user_id,order_no,product_type,product_name,amount,status,pay_method,metadata,paid_at,created_at')
        .order('created_at', { ascending: false })
        .limit(500),
      sb
        .from('credit_transactions')
        .select('id,user_id,amount,type,description,created_at')
        .order('created_at', { ascending: false })
        .limit(800),
    ]);

    if (usersRes.error) throw usersRes.error;
    if (ordersRes.error) throw ordersRes.error;
    if (txRes.error) throw txRes.error;

    const users = usersRes.data || [];
    const orders = ordersRes.data || [];
    const transactions = txRes.data || [];

    const paidAmountMap = new Map<string, number>();
    const planExpireMap = new Map<string, string>();

    for (const order of orders) {
      const uid = order.user_id || '';
      if (!uid) continue;
      if (order.status === 'completed') {
        const amountYuan = Number(order.amount || 0) / 100;
        paidAmountMap.set(uid, (paidAmountMap.get(uid) || 0) + amountYuan);
      }
      if (order.status === 'completed' && order.product_type === 'subscription') {
        const paidAt = order.paid_at || order.created_at;
        if (!paidAt) continue;
        const expiresAt = expiryFromMetadata(order.metadata, paidAt);
        if (!expiresAt) continue;
        const prev = planExpireMap.get(uid);
        if (!prev || new Date(expiresAt).getTime() > new Date(prev).getTime()) {
          planExpireMap.set(uid, expiresAt);
        }
      }
    }

    const generationCountMap = new Map<string, number>();
    const downloadCountMap = new Map<string, number>();

    for (const tx of transactions) {
      const uid = tx.user_id || '';
      if (!uid) continue;
      const type = String(tx.type || '').toLowerCase();
      const desc = String(tx.description || '');

      if (type.includes('generation') || type.includes('outline') || desc.includes('生成PPT')) {
        generationCountMap.set(uid, (generationCountMap.get(uid) || 0) + 1);
      }
      if (type.includes('download') || desc.includes('下载')) {
        downloadCountMap.set(uid, (downloadCountMap.get(uid) || 0) + 1);
      }
    }

    let normalizedUsers = users.map((u) => {
      const planExpiresAt = (u as { plan_expires_at?: string | null }).plan_expires_at || planExpireMap.get(u.id) || null;
      return {
        id: u.id,
        phone: u.phone || '',
        nickname: u.nickname || '用户',
        credits: Number(u.credits || 0),
        plan_type: u.plan_type || 'free',
        total_credits_used: Number((u as { total_credits_used?: number | null }).total_credits_used || 0),
        plan_expires_at: planExpiresAt,
        paid_amount_yuan: Number((paidAmountMap.get(u.id) || 0).toFixed(2)),
        generation_count: generationCountMap.get(u.id) || 0,
        download_count: downloadCountMap.get(u.id) || 0,
        last_login_at: u.last_login_at,
        created_at: u.created_at,
      };
    });

    if (planFilter && planFilter !== 'all') {
      normalizedUsers = normalizedUsers.filter((u) => (u.plan_type || 'free').toLowerCase() === planFilter);
    }
    if (keyword) {
      normalizedUsers = normalizedUsers.filter((u) => {
        const hay = `${u.nickname} ${u.phone} ${u.id}`.toLowerCase();
        return hay.includes(keyword);
      });
    }

    const nowTs = Date.now();
    const summary = {
      total_users: normalizedUsers.length,
      paid_users: normalizedUsers.filter((u) => u.plan_type !== 'free').length,
      active_members: normalizedUsers.filter((u) => {
        if (u.plan_type === 'free') return false;
        if (!u.plan_expires_at) return true;
        return new Date(u.plan_expires_at).getTime() > nowTs;
      }).length,
      total_revenue_yuan: Number(
        normalizedUsers.reduce((sum, u) => sum + u.paid_amount_yuan, 0).toFixed(2)
      ),
      total_generation: normalizedUsers.reduce((sum, u) => sum + u.generation_count, 0),
      total_download: normalizedUsers.reduce((sum, u) => sum + u.download_count, 0),
      admin_gamma_pool_credits: (() => {
        try { return getKeyPoolStatus().totalRemaining; } catch { return 0; }
      })(),
    };

    const userById = new Map(normalizedUsers.map((u) => [u.id, u]));
    const recentPayments = orders
      .filter((o) => o.status === 'completed')
      .slice(0, 40)
      .map((o) => ({
        order_no: o.order_no,
        user_id: o.user_id,
        nickname: userById.get(o.user_id || '')?.nickname || '未知用户',
        phone: userById.get(o.user_id || '')?.phone || '',
        product_type: o.product_type,
        product_name: o.product_name || '',
        pay_method: o.pay_method || '',
        amount_yuan: Number((Number(o.amount || 0) / 100).toFixed(2)),
        paid_at: o.paid_at || o.created_at,
      }));

    return NextResponse.json({
      summary,
      users: normalizedUsers,
      recentPayments,
      recentUsage: transactions.slice(0, 120),
    });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : '后台数据读取失败';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
