import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { requireAdmin } from '@/lib/admin-auth';

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key);
}

function isMissingTable(error: unknown, tableName: string): boolean {
  const msg = String((error as { message?: string } | null)?.message || '');
  return msg.includes(tableName) && msg.toLowerCase().includes('does not exist');
}

export async function GET(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.reason || '无权限' }, { status: auth.reason === '请先登录' ? 401 : 403 });
  }
  const sb = getSupabase();
  if (!sb) return NextResponse.json({ error: '服务未配置' }, { status: 503 });

  const { searchParams } = new URL(request.url);
  const limit = Math.min(Math.max(Number(searchParams.get('limit') || 80), 1), 300);
  const status = (searchParams.get('status') || 'all').trim();
  const q = (searchParams.get('q') || '').trim().toLowerCase();

  let query = sb
    .from('orders')
    .select('id,user_id,order_no,product_type,product_name,amount,status,pay_method,metadata,paid_at,trade_no,created_at')
    .order('created_at', { ascending: false })
    .limit(limit);
  if (status && status !== 'all') query = query.eq('status', status);

  const { data: orderRows, error } = await query;
  if (error) return NextResponse.json({ error: error.message || '订单读取失败' }, { status: 500 });
  const orders = (orderRows || []) as Array<Record<string, any>>;
  const userIds = [...new Set(orders.map((o) => String(o.user_id || '')).filter(Boolean))];
  const orderNos = orders.map((o) => String(o.order_no || '')).filter(Boolean);

  const [{ data: users }, refundRes] = await Promise.all([
    userIds.length
      ? sb.from('users').select('id,phone,nickname').in('id', userIds)
      : Promise.resolve({ data: [] }),
    orderNos.length
      ? sb.from('refund_requests').select('id,order_no,status,amount,reason,provider,provider_refund_id,created_at,completed_at').in('order_no', orderNos)
      : Promise.resolve({ data: [], error: null }),
  ]);

  if (refundRes.error && !isMissingTable(refundRes.error, 'refund_requests')) {
    return NextResponse.json({ error: refundRes.error.message || '退款记录读取失败' }, { status: 500 });
  }

  const userMap = new Map((users || []).map((u: any) => [String(u.id), u]));
  const refundMap = new Map((refundRes.data || []).map((r: any) => [String(r.order_no), r]));

  let normalized = orders.map((o) => {
    const user = userMap.get(String(o.user_id || '')) || {};
    const refund = refundMap.get(String(o.order_no || '')) || null;
    return {
      id: o.id,
      user_id: o.user_id,
      order_no: o.order_no,
      nickname: user.nickname || '未知用户',
      phone: user.phone || '',
      product_type: o.product_type || '',
      product_name: o.product_name || '',
      amount_yuan: Number((Number(o.amount || 0) / 100).toFixed(2)),
      amount: Number(o.amount || 0),
      status: o.status || '',
      pay_method: o.pay_method || '',
      provider: String((o.metadata || {}).provider || o.pay_method || ''),
      trade_no: o.trade_no || '',
      paid_at: o.paid_at || null,
      created_at: o.created_at,
      refund,
    };
  });

  if (q) {
    normalized = normalized.filter((row) => `${row.order_no} ${row.nickname} ${row.phone} ${row.product_name} ${row.trade_no}`.toLowerCase().includes(q));
  }

  return NextResponse.json({ orders: normalized });
}
