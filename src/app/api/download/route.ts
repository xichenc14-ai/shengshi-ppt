import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getClientIP, rateLimit } from '@/lib/rate-limit';

type MutableUserCounters = {
  plan_type?: string | null;
  download_count_month?: number | null;
  ppt_trial_count_month?: number | null;
  download_reset_month?: string | null;
  credits?: number | null;
};

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key);
}

// GET: 检查下载能力（当前下载不再单独计费）
export async function GET(request: NextRequest) {
  const ip = getClientIP(request);
  const { allowed } = rateLimit(`download:${ip}`, { windowMs: 60000, maxRequests: 30 });
  if (!allowed) return NextResponse.json({ error: '请求过于频繁' }, { status: 429 });

  const sb = getSupabase();
  if (!sb) return NextResponse.json({ error: '服务未配置' }, { status: 503 });

  const { searchParams } = new URL(request.url);
  const userId = searchParams.get('userId');
  const rawFormat = (searchParams.get('format') || 'pptx').toLowerCase();
  if (rawFormat !== 'pptx' && rawFormat !== 'pdf') {
    return NextResponse.json({ error: '仅支持 PPTX / PDF 下载' }, { status: 410 });
  }

  if (!userId) return NextResponse.json({ error: '缺少用户ID' }, { status: 400 });

  try {
    // 获取用户信息
    const { data: user, error } = await sb
      .from('users')
      .select('id, plan_type, download_count_month, ppt_trial_count_month, download_reset_month')
      .eq('id', userId)
      .single();

    if (error || !user) return NextResponse.json({ error: '用户不存在' }, { status: 404 });

    return NextResponse.json({
      allowed: true,
      isFreeDownload: true,
      format: rawFormat,
      downloadCount: user.download_count_month || 0,
      pptTrialCount: user.ppt_trial_count_month || 0,
      resetMonth: user.download_reset_month,
    });
  } catch (e: unknown) {
    return NextResponse.json({ error: getErrorMessage(e) }, { status: 500 });
  }
}

// POST: 更新下载计数（实际下载时调用）
export async function POST(request: NextRequest) {
  const ip = getClientIP(request);
  const { allowed } = rateLimit(`download_post:${ip}`, { windowMs: 60000, maxRequests: 20 });
  if (!allowed) return NextResponse.json({ error: '请求过于频繁' }, { status: 429 });

  const sb = getSupabase();
  if (!sb) return NextResponse.json({ error: '服务未配置' }, { status: 503 });

  try {
    const { action, userId, pageCount, format: rawFormat } = await request.json();
    const format = (rawFormat || 'pptx').toLowerCase();
    if (format !== 'pptx' && format !== 'pdf') {
      return NextResponse.json({ error: '仅支持 PPTX / PDF 下载' }, { status: 410 });
    }

    if (action === 'record') {
      if (!userId) return NextResponse.json({ error: '缺少用户ID' }, { status: 400 });

      // 获取用户当前计数
      const { data: user, error } = await sb
        .from('users')
        .select('id, plan_type, download_count_month, ppt_trial_count_month, download_reset_month')
        .eq('id', userId)
        .single();

      if (error || !user) return NextResponse.json({ error: '用户不存在' }, { status: 404 });

      const updates: Record<string, number> = {};
      if ((user.plan_type || 'free') === 'free') {
        updates.download_count_month = (user.download_count_month || 0) + 1;
      }

      if (Object.keys(updates).length > 0) {
        await sb.from('users').update(updates).eq('id', userId);
      }

      // 统一记录下载行为（便于后台审计）
      try {
        const latestBalance = Number((user as MutableUserCounters).credits || 0);
        await sb.from('credit_transactions').insert({
          user_id: userId,
          amount: 0,
          balance_after: latestBalance,
          type: user.plan_type === 'free' ? 'download_trial' : 'download_member',
          description: `${format.toUpperCase()}下载-${pageCount}页-${user.plan_type || 'free'}`,
        });
      } catch {}

      return NextResponse.json({
        success: true,
        recorded: true,
        format,
        downloadCount: updates.download_count_month || user.download_count_month,
        pptTrialCount: user.ppt_trial_count_month,
        watermarked: false,
        isTrial: false,
      });
    }

    return NextResponse.json({ error: '未知操作' }, { status: 400 });
  } catch (e: unknown) {
    return NextResponse.json({ error: getErrorMessage(e) }, { status: 500 });
  }
}
