import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getSession } from '@/lib/session';
import { getClientIP, rateLimit } from '@/lib/rate-limit';

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key);
}

function isMissingTableError(error: unknown, tableName: string): boolean {
  const msg = String((error as { message?: string } | null)?.message || '');
  return (
    msg.includes(`Could not find the table 'public.${tableName}'`)
    || (msg.toLowerCase().includes('does not exist') && msg.toLowerCase().includes(tableName.toLowerCase()))
  );
}

export async function POST(request: NextRequest) {
  const ip = getClientIP(request);
  const { allowed } = rateLimit(`feedback:${ip}`, { windowMs: 60_000, maxRequests: 12 });
  if (!allowed) return NextResponse.json({ error: '请求过于频繁' }, { status: 429 });

  const sb = getSupabase();
  if (!sb) return NextResponse.json({ error: '服务未配置' }, { status: 503 });

  const session = await getSession();
  const userId = session.user?.id || '';
  if (!session.isLoggedIn || !userId) {
    return NextResponse.json({ error: '请先登录后再反馈' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const voteRaw = String(body?.vote || '').trim().toLowerCase();
    const vote = voteRaw === 'down' ? 'down' : voteRaw === 'up' ? 'up' : '';
    const ratingNum = Number(body?.rating);
    const rating = Number.isFinite(ratingNum) ? Math.max(1, Math.min(5, Math.round(ratingNum))) : null;
    const comment = String(body?.comment || '').trim().slice(0, 600);

    if (!vote) return NextResponse.json({ error: '请选择点赞或点踩' }, { status: 400 });
    if (!rating && !comment) return NextResponse.json({ error: '请填写评分或反馈意见' }, { status: 400 });

    const { error } = await sb.from('ppt_feedback').insert({
      user_id: userId,
      generation_id: body?.generationId ? String(body.generationId).slice(0, 120) : null,
      vote,
      rating,
      comment: comment || null,
      topic: body?.topic ? String(body.topic).slice(0, 200) : null,
      ppt_title: body?.pptTitle ? String(body.pptTitle).slice(0, 200) : null,
      page_count: Number.isFinite(Number(body?.pageCount)) ? Number(body.pageCount) : null,
      image_mode: body?.imageMode ? String(body.imageMode).slice(0, 40) : null,
    });

    if (error) {
      if (isMissingTableError(error, 'ppt_feedback')) {
        const { data: currentUser } = await sb
          .from('users')
          .select('credits')
          .eq('id', userId)
          .single();
        const fallbackDescription = JSON.stringify({
          kind: 'ppt_feedback',
          vote,
          rating,
          comment: comment || '',
          generationId: body?.generationId ? String(body.generationId).slice(0, 120) : null,
          topic: body?.topic ? String(body.topic).slice(0, 200) : null,
          pptTitle: body?.pptTitle ? String(body.pptTitle).slice(0, 200) : null,
          pageCount: Number.isFinite(Number(body?.pageCount)) ? Number(body.pageCount) : null,
          imageMode: body?.imageMode ? String(body.imageMode).slice(0, 40) : null,
        });
        const fallbackInsert = await sb.from('credit_transactions').insert({
          user_id: userId,
          amount: 0,
          balance_after: Number(currentUser?.credits || 0),
          type: 'feedback',
          description: fallbackDescription,
        });
        if (fallbackInsert.error) {
          throw fallbackInsert.error;
        }
        return NextResponse.json({ success: true, fallback: 'credit_transactions' });
      }
      throw error;
    }

    return NextResponse.json({ success: true });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : '反馈提交失败';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
