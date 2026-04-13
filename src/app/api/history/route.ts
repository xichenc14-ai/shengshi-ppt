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
  const userId = searchParams.get('userId');
  const limit = Math.min(parseInt(searchParams.get('limit') || '20'), 50);

  if (!userId) return NextResponse.json({ error: '缺少用户ID' }, { status: 400 });

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
    const { action, userId, title, slides, themeId, downloadUrl, pageCount, imageMode } = await request.json();

    if (!userId) return NextResponse.json({ error: '缺少用户ID' }, { status: 400 });

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
