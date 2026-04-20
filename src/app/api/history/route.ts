import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getClientIP, rateLimit } from '@/lib/rate-limit';

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key);
}

// GET: 获取用户历史记录
export async function GET(request: NextRequest) {
  const ip = getClientIP(request);
  const { allowed } = rateLimit(`history:${ip}`, { windowMs: 60000, maxRequests: 30 });
  if (!allowed) return NextResponse.json({ error: '请求过于频繁' }, { status: 429 });

  const sb = getSupabase();
  if (!sb) return NextResponse.json({ error: '服务未配置' }, { status: 503 });

  const { searchParams } = new URL(request.url);
  const authHeader = request.headers.get('authorization');
  const authUserId = authHeader?.replace(/^Bearer\s+/i, '').trim();
  const userId = searchParams.get('userId');
  const limit = Math.min(parseInt(searchParams.get('limit') || '20'), 50);

  // 🚨 安全：验证用户身份（禁止查看他人历史）
  if (!userId || userId !== authUserId) {
    return NextResponse.json({ error: '无权访问此用户的历史记录' }, { status: 403 });
  }

  try {
    const { data: history, error } = await sb
      .from('generation_history')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) throw error;

    return NextResponse.json({ history: history || [], count: history?.length || 0 });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

// POST: 创建/保存历史记录
export async function POST(request: NextRequest) {
  const ip = getClientIP(request);
  const { allowed } = rateLimit(`history:${ip}`, { windowMs: 60000, maxRequests: 20 });
  if (!allowed) return NextResponse.json({ error: '请求过于频繁' }, { status: 429 });

  const sb = getSupabase();
  if (!sb) return NextResponse.json({ error: '服务未配置' }, { status: 503 });

  try {
    const { action, title, slides, themeId, downloadUrl, pageCount, imageMode } = await request.json();

    // 🚨 安全：从 Authorization header 获取用户身份，禁止从 body 传入 userId
    const authHeader = request.headers.get('authorization');
    const userId = authHeader?.replace(/^Bearer\s+/i, '').trim();
    if (!userId || userId === '00000000-0000-0000-000000000000') {
      return NextResponse.json({ error: '请先登录' }, { status: 401 });
    }

    if (action === 'save') {
      if (!title) return NextResponse.json({ error: '缺少标题' }, { status: 400 });

      const { data: record, error } = await sb
        .from('generation_history')
        .insert({
          user_id: userId,
          title: title.substring(0, 200),
          slides: slides || [],
          theme_id: themeId || null,
          download_url: downloadUrl || null,
          page_count: pageCount || 0,
          image_mode: imageMode || 'noImages',
        })
        .select()
        .single();

      if (error) throw error;
      return NextResponse.json({ success: true, record });
    }

    if (action === 'delete') {
      const { id } = await request.json();
      if (!id) return NextResponse.json({ error: '缺少记录ID' }, { status: 400 });
      const { error } = await sb.from('generation_history').delete().eq('id', id).eq('user_id', userId);
      if (error) throw error;
      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: '未知操作' }, { status: 400 });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
