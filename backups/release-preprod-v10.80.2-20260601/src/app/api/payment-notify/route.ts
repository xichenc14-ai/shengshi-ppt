import { NextRequest, NextResponse } from 'next/server';

// 支付确认通知 - 发送 TG 消息给管理员
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { userId, userName, planId, planName, price, billing, payMethod } = body;

    // 检查 TG 配置
    const botToken = process.env.TELEGRAM_BOT_TOKEN;
    const chatId = process.env.TELEGRAM_CHAT_ID;

    if (!botToken || !chatId) {
      console.log('TG 配置缺失，跳过通知');
      return NextResponse.json({ success: true, message: '通知已记录（TG未配置）' });
    }

    // 构建通知消息
    const billingLabel = billing === 'annual' ? '年付' : '月付';
    const payMethodLabel = payMethod === 'wechat' ? '微信支付' : '支付宝';
    const timestamp = new Date().toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' });

    const message = `🔔 新订单通知

👤 用户：${userName || userId}
📦 套餐：${planName}（${billingLabel})
💰 金额：${price}
💳 支付：${payMethodLabel}
⏰ 时间：${timestamp}

⚠️ 请确认收款后手动开通会员`;

    // 发送到 TG
    const tgUrl = `https://api.telegram.org/bot${botToken}/sendMessage`;
    const tgRes = await fetch(tgUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text: message,
        parse_mode: 'HTML',
      }),
    });

    if (!tgRes.ok) {
      const tgErr = await tgRes.text();
      console.error('TG 发送失败:', tgErr);
      return NextResponse.json({ success: false, error: 'TG通知发送失败' }, { status: 500 });
    }

    return NextResponse.json({ success: true, message: '通知已发送' });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : '通知失败';
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}