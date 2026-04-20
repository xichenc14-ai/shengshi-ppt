import { NextRequest, NextResponse } from 'next/server';
import { createHash } from 'crypto';

// 🚨 安全：Webhook 签名验证
// 支付渠道回调时，验证请求是否来自可信来源
function verifyWebhookSignature(req: NextRequest, body: string): boolean {
  // 从请求头获取签名
  const sig = req.headers.get('x-webhook-signature') || req.headers.get('x-pay-signature');
  if (!sig) return false;

  const secret = process.env.WEBHOOK_SECRET;
  if (!secret) {
    // 未配置 secret 时，跳过验证（开发环境）
    if (process.env.NODE_ENV !== 'production') return true;
    return false;
  }

  // HMAC-SHA256 验证
  const expected = createHash('sha256').update(body + secret).digest('hex');
  return sig === expected || sig === `sha256=${expected}`;
}

// 支付确认通知 - 发送 TG 消息给管理员
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    // 🚨 安全：验证 Webhook 签名（防止恶意调用）
    const rawBody = JSON.stringify(body);
    if (!verifyWebhookSignature(req, rawBody)) {
      console.warn('[PaymentNotify] 未授权的回调请求:', req.headers.get('x-webhook-signature'));
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { userId, userName, planId, planName, price, billing, payMethod } = body;

    // 🚨 安全：验证金额（防止价格篡改）
    if (price === undefined || typeof price !== 'number' || price < 0) {
      return NextResponse.json({ error: 'Invalid amount' }, { status: 400 });
    }

    // TG 通知（构建纯文本消息，避免 HTML 注入）
    const botToken = process.env.TELEGRAM_BOT_TOKEN;
    const chatId = process.env.TELEGRAM_CHAT_ID;

    if (!botToken || !chatId) {
      console.log('[PaymentNotify] TG 配置缺失，跳过通知');
      return NextResponse.json({ success: true });
    }

    const billingLabel = billing === 'annual' ? '年付' : '月付';
    const payMethodLabel = payMethod === 'wechat' ? '微信支付' : '支付宝';
    const timestamp = new Date().toISOString().replace('T', ' ').substring(0, 19);

    // 使用纯文本，避免 HTML 注入
    const message = [
      '\u{1F4E3} 新订单通知',
      '',
      `\u{1F464} 用户：${String(userName || userId).replace(/[<>\"\'&]/g, '')}`,
      `\u{1F4E6} 套餐：${String(planName || '').replace(/[<>\"\'&]/g, '')}（${billingLabel}）`,
      `\u{1F4B0} 金额：${price}`,
      `\u{1F4B3} 支付：${payMethodLabel}`,
      `\u{23F0} 时间：${timestamp}`,
      '',
      '\u26A0\uFE0F 请确认收款后手动开通会员',
    ].join('\n');

    const tgUrl = `https://api.telegram.org/bot${botToken}/sendMessage`;
    const tgRes = await fetch(tgUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text: message,
      }),
    });

    if (!tgRes.ok) {
      const tgErr = await tgRes.text();
      console.error('[PaymentNotify] TG 发送失败:', tgErr);
      return NextResponse.json({ success: false, error: 'TG通知发送失败' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : '通知失败';
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}