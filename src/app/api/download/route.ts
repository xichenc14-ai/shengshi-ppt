import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getClientIP, rateLimit } from '@/lib/rate-limit';
import { checkDownloadPermission } from '@/lib/membership';

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key);
}

// GET: 检查下载权限（不实际下载）
export async function GET(request: NextRequest) {
  const ip = getClientIP(request);
  const { allowed } = rateLimit(`download:${ip}`, { windowMs: 60000, maxRequests: 30 });
  if (!allowed) return NextResponse.json({ error: '请求过于频繁' }, { status: 429 });

  const sb = getSupabase();
  if (!sb) return NextResponse.json({ error: '服务未配置' }, { status: 503 });

  const { searchParams } = new URL(request.url);
  const userId = searchParams.get('userId');
  const pageCount = parseInt(searchParams.get('pageCount') || '0');
  const format = (searchParams.get('format') || 'pdf') as 'pptx' | 'pdf';

  if (!userId) return NextResponse.json({ error: '缺少用户ID' }, { status: 400 });

  try {
    // 获取用户信息
    const { data: user, error } = await sb
      .from('users')
      .select('id, plan_type, download_count_month, ppt_trial_count_month, download_reset_month')
      .eq('id', userId)
      .single();

    if (error || !user) return NextResponse.json({ error: '用户不存在' }, { status: 404 });

    // 检查下载权限
    const permission = checkDownloadPermission(user, pageCount, format);

    return NextResponse.json({
      ...permission,
      downloadCount: user.download_count_month || 0,
      pptTrialCount: user.ppt_trial_count_month || 0,
      resetMonth: user.download_reset_month,
    });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
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
    const { action, userId, pageCount, format } = await request.json();

    if (action === 'record') {
      if (!userId) return NextResponse.json({ error: '缺少用户ID' }, { status: 400 });

      // 获取用户当前计数
      const { data: user, error } = await sb
        .from('users')
        .select('id, plan_type, download_count_month, ppt_trial_count_month, download_reset_month')
        .eq('id', userId)
        .single();

      if (error || !user) return NextResponse.json({ error: '用户不存在' }, { status: 404 });

      const currentMonth = new Date().toISOString().substring(0, 7); // '2026-04'

      // 如果月份不匹配，重置计数
      if (user.download_reset_month !== currentMonth) {
        await sb
          .from('users')
          .update({
            download_count_month: 0,
            ppt_trial_count_month: 0,
            download_reset_month: currentMonth,
          })
          .eq('id', userId);

        user.download_count_month = 0;
        user.ppt_trial_count_month = 0;
      }

      // 检查权限
      const permission = checkDownloadPermission(user, pageCount, format);

      if (permission.needPayment) {
        // TODO: 接入支付系统
        return NextResponse.json({
          needPayment: true,
          cost: permission.cost,
          message: permission.reason,
        });
      }

      // 更新计数
      const updates: any = {};
      if (format === 'pdf') {
        updates.download_count_month = (user.download_count_month || 0) + 1;
      } else if (format === 'pptx') {
        updates.ppt_trial_count_month = (user.ppt_trial_count_month || 0) + 1;
      }

      if (Object.keys(updates).length > 0) {
        await sb.from('users').update(updates).eq('id', userId);
      }

      return NextResponse.json({
        success: true,
        recorded: true,
        format,
        downloadCount: updates.download_count_month || user.download_count_month,
        pptTrialCount: updates.ppt_trial_count_month || user.ppt_trial_count_month,
        watermarked: permission.watermarked,
        isTrial: permission.isTrial,
      });
    }

    return NextResponse.json({ error: '未知操作' }, { status: 400 });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}