import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { inspectProviderReadiness } from '@/lib/payment/provider-adapter';

function boolEnv(name: string): boolean {
  return Boolean(process.env[name]);
}

export async function GET(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (!auth.ok) {
    return NextResponse.json(
      { error: auth.reason || '无权限' },
      { status: auth.reason === '请先登录' ? 401 : 403 }
    );
  }

  const wechat = inspectProviderReadiness('wechat');
  const alipay = inspectProviderReadiness('alipay');

  const notifyUrl = process.env.PAYMENT_NOTIFY_URL || '';
  const notifyUrlValid = /^https:\/\//i.test(notifyUrl);

  const core = {
    supabaseUrl: boolEnv('NEXT_PUBLIC_SUPABASE_URL'),
    supabaseServiceRole: boolEnv('SUPABASE_SERVICE_ROLE_KEY'),
    paymentNotifyUrl: notifyUrlValid,
    adminDashboardKey: boolEnv('ADMIN_DASHBOARD_KEY'),
  };

  const ready = core.supabaseUrl
    && core.supabaseServiceRole
    && core.paymentNotifyUrl
    && wechat.ready
    && alipay.ready;

  return NextResponse.json({
    status: ready ? 'ready' : 'not_ready',
    timestamp: new Date().toISOString(),
    core,
    providers: { wechat, alipay },
    recommendations: [
      !core.paymentNotifyUrl ? 'PAYMENT_NOTIFY_URL 必须是 https 回调地址' : null,
      !wechat.ready ? `微信支付配置缺失: ${wechat.missing.join(', ')}` : null,
      !alipay.ready ? `支付宝配置缺失: ${alipay.missing.join(', ')}` : null,
    ].filter(Boolean),
  }, {
    headers: {
      'Cache-Control': 'no-store, max-age=0',
    },
  });
}

