import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { isPaymentFeatureEnabledServer } from '@/lib/payment-feature';

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key);
}

type CreditPackPreset = {
  id: string;
  name: string;
  credits: number;
};

const CREDIT_PACK_PRESETS: CreditPackPreset[] = [
  { id: 'topup-100', name: '体验包', credits: 100 },
  { id: 'topup-500', name: '基础包', credits: 500 },
  { id: 'topup-2000', name: '超值包', credits: 2000 },
];

function getUserIdFromReq(req: NextRequest): string {
  const auth = req.headers.get('authorization') || req.headers.get('Authorization') || '';
  if (auth.toLowerCase().startsWith('bearer ')) {
    return auth.slice(7).trim();
  }
  const uid = req.headers.get('x-user-id');
  return (uid || '').trim();
}

async function resolvePlanType(req: NextRequest, sb: NonNullable<ReturnType<typeof getSupabase>>): Promise<string> {
  const userId = getUserIdFromReq(req);
  if (!userId) return 'free';
  try {
    const { data } = await sb.from('users').select('plan_type').eq('id', userId).single();
    return (data?.plan_type || 'free') as string;
  } catch {
    return 'free';
  }
}

function isMemberPlan(planType: string): boolean {
  return !!planType && !['free', 'guest', 'trial'].includes(planType);
}

function buildPricedPackages(planType: string) {
  const member = isMemberPlan(planType);
  const yuanPerCredit = member ? 0.05 : 0.1; // 会员: 1元≈20积分；免费: 1元≈10积分
  return CREDIT_PACK_PRESETS.map((pkg, idx) => {
    const amountFen = Math.round(pkg.credits * yuanPerCredit * 100);
    return {
      ...pkg,
      sort_order: idx + 1,
      amount_fen: amountFen,
      price: amountFen,
      price_yuan: Number((amountFen / 100).toFixed(2)),
      rate_text: member ? '会员价 1元≈20积分' : '免费用户价 1元≈10积分',
      price_tier: member ? 'member' : 'free',
    };
  });
}

export async function GET(req: NextRequest) {
  const sb = getSupabase();
  if (!sb) {
    return NextResponse.json({ packages: buildPricedPackages('free'), priceTier: 'free' });
  }
  try {
    const planType = await resolvePlanType(req, sb);
    const packages = buildPricedPackages(planType);
    return NextResponse.json({
      packages,
      priceTier: isMemberPlan(planType) ? 'member' : 'free',
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : '获取失败';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const sb = getSupabase();
  if (!sb) return NextResponse.json({ error: '服务未配置' }, { status: 503 });
  if (!isPaymentFeatureEnabledServer()) {
    return NextResponse.json({ error: '支付通道申请中，暂不可创建充值订单' }, { status: 503 });
  }
  try {
    const { packageId } = await req.json();
    if (!packageId) return NextResponse.json({ error: '请选择充值包' }, { status: 400 });
    const planType = await resolvePlanType(req, sb);
    const packages = buildPricedPackages(planType);
    const pkg = packages.find((item) => item.id === packageId);
    if (!pkg) return NextResponse.json({ error: '充值包不存在' }, { status: 400 });
    const userId = getUserIdFromReq(req) || '00000000-0000-0000-000000000000';

    const orderNo = Date.now().toString(36) + Math.random().toString(36).substring(2, 10);
    await sb.from('orders').insert({
      user_id: userId,
      order_no: orderNo,
      product_type: 'credits',
      product_name: pkg.name,
      amount: pkg.price,
      status: 'pending',
      metadata: { credits: pkg.credits, priceTier: pkg.price_tier, rate: pkg.rate_text },
      expires_at: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
    }).select().single();

    return NextResponse.json({
      order_no: orderNo,
      product_name: pkg.name,
      amount: pkg.price,
      amount_yuan: pkg.price_yuan,
      credits: pkg.credits,
      rate_text: pkg.rate_text,
      message: '支付功能开发中，充值成功将自动到账',
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : '创建订单失败';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
