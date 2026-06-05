import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

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
  try {
    const { userId, generationId, pageCount, filename } = await req.json();
    if (!userId || !generationId) return NextResponse.json({ error: '参数不全' }, { status: 400 });

    // 查用户积分
    const { data: user } = await sb.from('users').select('credits,plan_type').eq('id', userId).single();
    if (!user) return NextResponse.json({ error: '用户不存在' }, { status: 404 });
    if (user.plan_type && user.plan_type !== 'free') {
      // 订阅用户走这里，但不应该调用此API（前端已区分）
      return NextResponse.json({ error: '订阅用户请直接下载' }, { status: 400 });
    }

    // 检查积分是否够（积分单位=1元，100积分=1元）
    // pageCount页 × 0.2元 = total元，所需积分 = total × 100
    const neededCredits = Math.ceil(pageCount * 20); // 每页0.2元=20积分
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
        description: `按页付费下载PPTX-${pageCount}页-扣${neededCredits}积分`,
      });
    } catch {}

    // 返回PPTX文件代理下载链接（前端拿到后下载）
    return NextResponse.json({
      success: true,
      cost: neededCredits,
      remainingCredits: updated?.credits || 0,
      downloadUrl: `/api/export-pptx?generationId=${encodeURIComponent(generationId)}&name=${encodeURIComponent(filename || '省心PPT.pptx')}`,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : '下单失败';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
