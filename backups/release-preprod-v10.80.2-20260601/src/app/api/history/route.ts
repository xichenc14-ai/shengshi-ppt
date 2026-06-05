import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getClientIP, rateLimit } from '@/lib/rate-limit';
import { getSession } from '@/lib/session';

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key);
}

function readBearerUserId(request: NextRequest): string {
  const auth = request.headers.get('authorization') || '';
  const match = auth.match(/^Bearer\s+(.+)$/i);
  return match?.[1]?.trim() || '';
}

// GET: 获取用户历史记录
export async function GET(request: NextRequest) {
  const ip = getClientIP(request);
  const { allowed } = rateLimit(`history:${ip}`, { windowMs: 60000, maxRequests: 30 });
  if (!allowed) return NextResponse.json({ error: '请求过于频繁' }, { status: 429 });

  const sb = getSupabase();
  if (!sb) return NextResponse.json({ error: '服务未配置' }, { status: 503 });

  const session = await getSession();
  let sessionUserId = session.user?.id || '';
  if (!session.isLoggedIn || !sessionUserId) {
    const hintedUserId = readBearerUserId(request);
    if (hintedUserId) {
      const { data: user } = await sb.from('users').select('id').eq('id', hintedUserId).single();
      if (user?.id) sessionUserId = hintedUserId;
    }
  }
  if (!sessionUserId) {
    return NextResponse.json({ error: '请先登录' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const userId = searchParams.get('userId') || sessionUserId;
  const limit = Math.min(parseInt(searchParams.get('limit') || '20'), 50);

  if (userId !== sessionUserId) return NextResponse.json({ error: '无权限访问该记录' }, { status: 403 });

  try {
    const { data: history, error } = await sb
      .from('generation_history')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      if (String(error.message || '').includes("Could not find the table 'public.generation_history'")) {
        return NextResponse.json({ history: [], count: 0, warning: 'history_table_missing' });
      }
      throw error;
    }

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
    const session = await getSession();
    let sessionUserId = session.user?.id || '';
    if (!session.isLoggedIn || !sessionUserId) {
      const hintedUserId = readBearerUserId(request);
      if (hintedUserId) {
        const { data: user } = await sb.from('users').select('id').eq('id', hintedUserId).single();
        if (user?.id) sessionUserId = hintedUserId;
      }
    }
    if (!sessionUserId) {
      return NextResponse.json({ error: '请先登录' }, { status: 401 });
    }

    const body = await request.json();
    const { action, userId, title, slides, themeId, downloadUrl, pageCount, imageMode, id } = body;
    const effectiveUserId = userId || sessionUserId;
    if (effectiveUserId !== sessionUserId) return NextResponse.json({ error: '无权限操作该记录' }, { status: 403 });

    if (action === 'save') {
      if (!title) return NextResponse.json({ error: '缺少标题' }, { status: 400 });
      const shouldStoreSlides = process.env.HISTORY_STORE_SLIDES === 'true';
      const compactSlides = Array.isArray(slides)
        ? slides.slice(0, 20).map((s: any) => ({
            id: s?.id || '',
            title: String(s?.title || '').slice(0, 120),
          }))
        : [];

      const { data: record, error } = await sb
        .from('generation_history')
        .insert({
          user_id: effectiveUserId,
          title: title.substring(0, 200),
          slides: shouldStoreSlides ? (slides || []) : compactSlides,
          theme_id: themeId || null,
          download_url: downloadUrl || null,
          page_count: pageCount || 0,
          image_mode: imageMode || 'themeAccent',
        })
        .select()
        .single();

      if (error) {
        if (String(error.message || '').includes("Could not find the table 'public.generation_history'")) {
          return NextResponse.json({ success: true, record: null, warning: 'history_table_missing' });
        }
        throw error;
      }
      return NextResponse.json({ success: true, record });
    }

    if (action === 'delete') {
      if (!id) return NextResponse.json({ error: '缺少记录ID' }, { status: 400 });
      const { error } = await sb.from('generation_history').delete().eq('id', id).eq('user_id', effectiveUserId);
      if (error) throw error;
      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: '未知操作' }, { status: 400 });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
