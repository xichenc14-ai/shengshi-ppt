import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key);
}

export async function GET() {
  const sb = getSupabase();
  if (!sb) return NextResponse.json({ packages: [] });
  try {
    const { data } = await sb.from('credit_packages').select('*').eq('is_active', true).order('sort_order', { ascending: true });
    return NextResponse.json({ packages: data || [] });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : '获取失败';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const sb = getSupabase();
  if (!sb) return NextResponse.json({ error: '服务未配置' }, { status: 503 });
  try {
    const { packageId } = await req.json();
    if (!packageId) return NextResponse.json({ error: '请选择充值包' }, { status: 400 });

    const { data: pkg } = await sb.from('credit_packages').select('*').eq('id', packageId).eq('is_active', true).single();
    if (!pkg) return NextResponse.json({ error: '充值包不存在' }, { status: 400 });

    const orderNo = Date.now().toString(36) + Math.random().toString(36).substring(2, 10);
    const { data: order } = await sb.from('orders').insert({
      user_id: '00000000-0000-0000-000000000000',
      order_no: orderNo,
      product_type: 'credits',
      product_name: pkg.name,
      amount: pkg.price,
      status: 'pending',
      expires_at: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
    }).select().single();

    return NextResponse.json({
      order_no: orderNo, product_name: pkg.name, amount: pkg.price,
      message: '支付功能开发中，充值成功将自动到账',
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : '创建订单失败';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
