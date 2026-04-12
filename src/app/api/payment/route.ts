import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key);
}

// POST: 创建订单 / 支付回调
export async function POST(req: NextRequest) {
  const sb = getSupabase();
  if (!sb) return NextResponse.json({ error: '服务未配置' }, { status: 503 });

  try {
    const body = await req.json();
    const { action } = body;

    // 创建订单
    if (action === 'create_order' || !action) {
      const { planId, payMethod, userId, billing = 'monthly' } = body;

      if (!planId) return NextResponse.json({ error: '请选择套餐' }, { status: 400 });

      const PLAN_PRICES: Record<string, { name: string; monthly: number; annual: number }> = {
        basic: { name: '基础版', monthly: 19, annual: 99 },
        pro: { name: '专业版', monthly: 49, annual: 299 },
      };

      const plan = PLAN_PRICES[planId];
      if (!plan) return NextResponse.json({ error: '套餐不存在' }, { status: 400 });

      const isAnnual = billing === 'annual';
      const amount = isAnnual ? plan.annual : plan.monthly;
      const billingLabel = isAnnual ? '年付' : '月付';

      const orderNo = Date.now().toString(36) + Math.random().toString(36).substring(2, 10);

      const { data: order, error } = await sb
        .from('orders')
        .insert({
          user_id: userId || '00000000-0000-0000-000000000000',
          order_no: orderNo,
          product_type: 'subscription',
          product_name: `${plan.name}（${billingLabel}）`,
          amount: Math.round(amount * 100), // 分为单位
          status: 'pending',
          pay_method: payMethod || 'wechat',
          metadata: { planId, payMethod, billing },
          expires_at: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
        })
        .select()
        .single();

      if (error) return NextResponse.json({ error: '创建订单失败' }, { status: 500 });

      return NextResponse.json({
        order_no: orderNo,
        amount,
        product_name: `${plan.name}（${billingLabel}）`,
        billing,
        status: 'pending',
        message: '支付功能即将上线',
      });
    }

    // 支付回调 webhook（预留）
    if (action === 'callback') {
      // TODO: 验证签名 + 更新订单状态 + 开通套餐
      return NextResponse.json({ success: true, message: '支付回调预留' });
    }

    return NextResponse.json({ error: '未知操作' }, { status: 400 });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : '操作失败';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

// GET: 查询订单状态
export async function GET(req: NextRequest) {
  const sb = getSupabase();
  if (!sb) return NextResponse.json({ error: '服务未配置' }, { status: 503 });

  const { searchParams } = new URL(req.url);
  const orderNo = searchParams.get('order_no');

  if (!orderNo) return NextResponse.json({ error: '缺少订单号' }, { status: 400 });

  try {
    const { data: order } = await sb
      .from('orders')
      .select('*')
      .eq('order_no', orderNo)
      .single();

    if (!order) return NextResponse.json({ error: '订单不存在' }, { status: 404 });

    return NextResponse.json({ order });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : '查询失败';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
