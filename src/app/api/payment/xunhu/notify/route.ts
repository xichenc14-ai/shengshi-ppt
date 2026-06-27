import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getClientIP, rateLimit } from '@/lib/rate-limit';
import { fulfillPaidOrder } from '@/lib/payment/subscription';
import { getXunhuConfig, isXunhuPaidPayload, verifyXunhuHash, xunhuStatusToOrderStatus, type XunhuNotifyPayload, type XunhuPayload } from '@/lib/payment/xunhu';
import { updateOrderCompat } from '@/lib/payment/order-storage';

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key);
}

async function readNotifyPayload(req: NextRequest): Promise<XunhuNotifyPayload> {
  const contentType = req.headers.get('content-type') || '';
  if (contentType.includes('application/json')) {
    return await req.json();
  }

  if (!contentType.includes('multipart/form-data') && !contentType.includes('application/x-www-form-urlencoded')) {
    return {};
  }

  const form = await req.formData();
  const payload: XunhuNotifyPayload = {};
  for (const [key, value] of form.entries()) {
    payload[key] = typeof value === 'string' ? value : value.name;
  }
  return payload;
}

function text(message: string, status = 200) {
  return new NextResponse(message, {
    status,
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'no-store, max-age=0',
    },
  });
}

function amountYuanToFen(value: string | undefined): number | null {
  if (!value) return null;
  const amount = Number(value);
  if (!Number.isFinite(amount) || amount <= 0) return null;
  return Math.round(amount * 100);
}

export async function POST(req: NextRequest) {
  const sb = getSupabase();
  if (!sb) return text('server not configured', 503);

  const config = getXunhuConfig();
  if (!config) return text('xunhu not configured', 503);

  const clientIP = getClientIP(req) || 'unknown';
  const limit = rateLimit(`payment:xunhu_notify:${clientIP}`, { windowMs: 60 * 1000, maxRequests: 60 });
  if (!limit.allowed) return text('rate limited', 429);

  try {
    const payload = await readNotifyPayload(req);
    const orderNo = payload.trade_order_id || '';
    if (!orderNo) return text('missing order', 400);

    if (payload.appid !== config.appid) {
      console.warn(`[XunhuPay] appid mismatch: order=${orderNo}, ip=${clientIP}`);
      return text('appid mismatch', 400);
    }

    if (!verifyXunhuHash(payload as XunhuPayload, config.secret)) {
      console.warn(`[XunhuPay] hash verify failed: order=${orderNo}, ip=${clientIP}`);
      return text('invalid hash', 400);
    }

    const { data: order } = await sb
      .from('orders')
      .select('*')
      .eq('order_no', orderNo)
      .single();

    if (!order) return text('order not found', 404);

    if (order.status === 'completed' || order.status === 'paid') {
      return text('success');
    }

    const callbackFen = amountYuanToFen(payload.total_fee);
    if (callbackFen === null || callbackFen !== Number(order.amount || 0)) {
      console.warn(`[XunhuPay] amount mismatch: order=${orderNo}, orderAmount=${order.amount}, callback=${payload.total_fee}`);
      return text('amount mismatch', 400);
    }

    const mappedStatus = xunhuStatusToOrderStatus(payload.status);
    const providerMetadata = {
      ...(order.metadata || {}),
      provider: 'xunhu',
      providerStatus: payload.status || null,
      providerOrderId: payload.open_order_id || null,
      transactionId: payload.transaction_id || null,
      lastNotifyAt: new Date().toISOString(),
      lastNotifyPayload: payload,
    };

    if (mappedStatus !== 'completed' && !isXunhuPaidPayload(payload)) {
      await updateOrderCompat(sb, {
        status: mappedStatus,
        trade_no: payload.transaction_id || payload.open_order_id || null,
        metadata: providerMetadata,
      }, orderNo);
      return text('success');
    }

    await fulfillPaidOrder(
      sb,
      order as Record<string, unknown>,
      providerMetadata,
      payload.transaction_id || payload.open_order_id || null
    );
    return text('success');
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'notify failed';
    console.error('[XunhuPay] notify error:', msg);
    return text('notify failed', 500);
  }
}
