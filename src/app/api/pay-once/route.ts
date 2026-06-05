import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { createProviderOrderIntent, inspectProviderReadiness, type PaymentProvider } from '@/lib/payment/provider-adapter';
import { getClientIP, rateLimit } from '@/lib/rate-limit';
import { isPaymentFeatureEnabledServer } from '@/lib/payment-feature';

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key);
}

// 单次付费下载PPTX：扣积分 + 返回文件
export async function POST(req: NextRequest) {
  const sb = getSupabase();
  if (!sb) return NextResponse.json({ error: '服务未配置' }, { status: 503 });
  const clientIP = getClientIP(req) || 'unknown';
  try {
    const {
      userId,
      generationId,
      pageCount,
      filename,
      payMode = 'credits',
      payMethod = 'wechat',
      subject,
    } = await req.json();
    if (!userId || !generationId) return NextResponse.json({ error: '参数不全' }, { status: 400 });
    const orderLimit = rateLimit(`pay_once:create:${clientIP}:${userId}`, { windowMs: 60 * 1000, maxRequests: 8 });
    if (!orderLimit.allowed) {
      return NextResponse.json(
        { error: '请求过于频繁，请稍后再试' },
        {
          status: 429,
          headers: {
            'Retry-After': String(Math.max(1, Math.ceil((orderLimit.resetAt - Date.now()) / 1000))),
          },
        }
      );
    }
    const safePageCount = Math.max(1, Number(pageCount || 1));

    // 查用户积分
    const { data: user } = await sb.from('users').select('credits,plan_type').eq('id', userId).single();
    if (!user) return NextResponse.json({ error: '用户不存在' }, { status: 404 });
    if (user.plan_type && user.plan_type !== 'free') {
      // 订阅用户走这里，但不应该调用此API（前端已区分）
      return NextResponse.json({ error: '订阅用户请直接下载' }, { status: 400 });
    }

    // 检查积分是否够（积分单位=1元，100积分=1元）
    // pageCount页 × 0.2元 = total元，所需积分 = total × 100
    const neededCredits = Math.ceil(safePageCount * 20); // 每页0.2元=20积分

    // 新增：真实支付下单意图（商业化路径）
    if (payMode === 'provider') {
      if (!isPaymentFeatureEnabledServer()) {
        return NextResponse.json({ error: '支付通道申请中，暂不可发起支付' }, { status: 503 });
      }
      const provider = payMethod === 'alipay' ? 'alipay' : 'wechat';
      const readiness = inspectProviderReadiness(provider);
      if (!readiness.ready) {
        return NextResponse.json({
          error: '支付通道配置不完整，暂不可发起单次支付',
          provider,
          missing: readiness.missing,
        }, { status: 503 });
      }

      const notifyUrl = process.env.PAYMENT_NOTIFY_URL || '';
      if (!/^https:\/\//i.test(notifyUrl)) {
        return NextResponse.json({ error: 'PAYMENT_NOTIFY_URL 必须为 https 地址' }, { status: 503 });
      }

      const orderNo = `once_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
      const amountFen = Math.round(safePageCount * 20); // 0.2 元/页
      const providerInput = {
        provider: provider as PaymentProvider,
        orderNo,
        amountFen,
        subject: subject || `单次下载 ${safePageCount} 页`,
        userId,
        notifyUrl,
      };
      const intent = await createProviderOrderIntent(providerInput);
      if (intent.mock) {
        return NextResponse.json({
          error: '支付通道尚未完成生产接入',
          provider: intent.provider,
          reason: intent.raw?.reason || 'provider_unavailable',
        }, { status: 503 });
      }

      const { error: orderErr } = await sb
        .from('orders')
        .insert({
          user_id: userId,
          order_no: orderNo,
          product_type: 'download_once',
          product_name: `单次下载（${safePageCount}页）`,
          amount: amountFen,
          status: 'pending',
          pay_method: provider,
          metadata: {
            generationId,
            pageCount: safePageCount,
            filename: filename || '省心PPT.pptx',
            mode: 'one_time_download',
          },
          expires_at: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
        });
      if (orderErr) {
        return NextResponse.json({ error: '创建支付订单失败' }, { status: 500 });
      }
      console.log(`[PayOnce] provider order created order=${orderNo} ip=${clientIP} user=${userId} pages=${safePageCount} provider=${provider}`);

      return NextResponse.json({
        success: true,
        mode: 'provider',
        orderNo,
        provider: intent.provider,
        providerOrderId: intent.providerOrderId,
        payUrl: intent.payUrl || null,
        qrCodeUrl: intent.qrCodeUrl || null,
        amountFen,
        amountYuan: (amountFen / 100).toFixed(2),
      });
    }

    if ((user.credits || 0) < neededCredits) {
      return NextResponse.json({
        error: '积分不足',
        needed: neededCredits,
        balance: user.credits || 0,
        message: `需要${neededCredits}积分，您有${user.credits || 0}积分`,
      }, { status: 402 });
    }

    // 扣积分
    const { data: updated } = await sb.from('users')
      .update({ credits: user.credits - neededCredits })
      .eq('id', userId)
      .select('credits').single();

    // 记录下载（统一入积分流水，避免依赖缺失表）
    try {
      await sb.from('credit_transactions').insert({
        user_id: userId,
        amount: -neededCredits,
        balance_after: updated?.credits || 0,
        type: 'download_paid',
        description: `按页付费下载PPTX-${safePageCount}页-扣${neededCredits}积分`,
      });
    } catch {}

    // 返回PPTX文件代理下载链接（前端拿到后下载）
    return NextResponse.json({
      success: true,
      mode: 'credits',
      cost: neededCredits,
      remainingCredits: updated?.credits || 0,
      downloadUrl: `/api/export-pptx?generationId=${encodeURIComponent(generationId)}&name=${encodeURIComponent(filename || '省心PPT.pptx')}`,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : '下单失败';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// 单次付费下载PPTX：查询订单并在已支付后返回下载链接
export async function GET(req: NextRequest) {
  const sb = getSupabase();
  if (!sb) return NextResponse.json({ error: '服务未配置' }, { status: 503 });
  const clientIP = getClientIP(req) || 'unknown';

  const { searchParams } = new URL(req.url);
  const orderNo = searchParams.get('orderNo') || '';
  const userId = searchParams.get('userId') || '';
  if (!orderNo || !userId) return NextResponse.json({ error: '参数不全' }, { status: 400 });
  const pollLimit = rateLimit(`pay_once:poll:${clientIP}:${orderNo}`, { windowMs: 60 * 1000, maxRequests: 30 });
  if (!pollLimit.allowed) {
    return NextResponse.json(
      { error: '轮询过于频繁，请稍后再试' },
      {
        status: 429,
        headers: {
          'Retry-After': String(Math.max(1, Math.ceil((pollLimit.resetAt - Date.now()) / 1000))),
        },
      }
    );
  }

  try {
    const { data: order } = await sb
      .from('orders')
      .select('*')
      .eq('order_no', orderNo)
      .eq('user_id', userId)
      .single();

    if (!order) return NextResponse.json({ error: '订单不存在' }, { status: 404 });
    if (order.product_type !== 'download_once') {
      return NextResponse.json({ error: '订单类型不匹配' }, { status: 400 });
    }

    if (order.status === 'failed') {
      return NextResponse.json({ status: 'failed', error: '支付失败' }, { status: 400 });
    }
    if (order.status === 'expired') {
      return NextResponse.json({ status: 'expired', error: '订单已超时' }, { status: 400 });
    }
    if (order.status !== 'completed') {
      return NextResponse.json({ status: order.status || 'pending', paid: false });
    }

    const metadata = (order.metadata || {}) as {
      generationId?: string;
      filename?: string;
      fulfilled?: boolean;
      fulfilledAt?: string | null;
    };
    const generationId = metadata.generationId || '';
    if (!generationId) {
      return NextResponse.json({ error: '订单缺少生成任务信息' }, { status: 500 });
    }
    const name = metadata.filename || '省心PPT.pptx';

    if (!metadata.fulfilled) {
      await sb
        .from('orders')
        .update({
          metadata: {
            ...metadata,
            fulfilled: true,
            fulfilledAt: new Date().toISOString(),
          },
        })
        .eq('order_no', orderNo);
    }

    return NextResponse.json({
      status: 'completed',
      paid: true,
      downloadUrl: `/api/export-pptx?generationId=${encodeURIComponent(generationId)}&name=${encodeURIComponent(name)}`,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : '查询失败';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
