import { NextRequest, NextResponse } from 'next/server';
import { understandImage } from '@/lib/image-understand';
import { rateLimit } from '@/lib/rate-limit';
import { createClient } from '@supabase/supabase-js';
import { getSession } from '@/lib/session';
import { getAttachmentPolicy, isPaidPlan, type AttachmentMode } from '@/lib/attachment-policy';

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key);
}

const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_DAILY_UPLOADS = 10; // 单用户每日上传限制

export async function POST(request: NextRequest) {
  // Rate limit
  const ip = request.headers.get('x-forwarded-for') || 'unknown';
  const { allowed } = rateLimit(`understand:${ip}`, { windowMs: 60000, maxRequests: 10 });
  if (!allowed) {
    return NextResponse.json({ error: '请求过于频繁，请稍后再试' }, { status: 429 });
  }

  try {
    const session = await getSession();
    if (!session.isLoggedIn || !session.user?.id) {
      return NextResponse.json({ error: '请先登录' }, { status: 401 });
    }

    const { image, mimeType, mode: rawMode } = await request.json();
    const mode: AttachmentMode = rawMode === 'smart' ? 'smart' : 'direct';
    if (mode === 'smart' && !isPaidPlan(session.user.plan_type)) {
      return NextResponse.json({ error: '省心模式为会员专享功能' }, { status: 403 });
    }
    const policy = getAttachmentPolicy(session.user.plan_type, mode);
    if (policy.maxImageBytes <= 0) {
      return NextResponse.json({ error: '图片附件为会员能力' }, { status: 403 });
    }
    const dailyLimit = rateLimit(`understand_daily:${session.user.id}`, {
      windowMs: 24 * 60 * 60 * 1000,
      maxRequests: MAX_DAILY_UPLOADS,
    });
    if (!dailyLimit.allowed) {
      return NextResponse.json({ error: `每日图片解析上限${MAX_DAILY_UPLOADS}次，明天再来吧` }, { status: 429 });
    }

    if (!image || !mimeType) {
      return NextResponse.json({ error: '缺少图片数据' }, { status: 400 });
    }

    // 每日上传总量限制
    const sessionId = session.user.id;
    const sb = getSupabase();
    if (sb) {
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);
      const { count } = await sb
        .from('image_uploads')
        .select('id', { count: 'exact', head: true })
        .eq('session_id', sessionId)
        .gte('created_at', todayStart.toISOString());
      if ((count || 0) >= MAX_DAILY_UPLOADS) {
        return NextResponse.json({ error: `每日上传上限${MAX_DAILY_UPLOADS}次，明天再来吧` }, { status: 429 });
      }
    }

    // MIME type check
    if (!ALLOWED_MIME_TYPES.includes(mimeType)) {
      return NextResponse.json({ error: `不支持的图片格式，仅支持 ${ALLOWED_MIME_TYPES.join(', ')}` }, { status: 400 });
    }

    // Size check (base64 encoded: ~4/3 of original)
    const estimatedBytes = Math.ceil((image.length * 3) / 4);
    if (estimatedBytes > policy.maxImageBytes) {
      return NextResponse.json({ error: '图片过大，请上传2.5MB以内的图片' }, { status: 413 });
    }

    const text = await understandImage(image, mimeType);
    if (sb) {
      await sb.from('image_uploads').insert({
        session_id: sessionId,
        mime_type: mimeType,
        size_bytes: estimatedBytes,
      }).then(() => undefined);
    }
    return NextResponse.json({ text });
  } catch (error: unknown) {
    console.error('Understand image error:', error);
    return NextResponse.json({ error: '图片识别失败', text: '[图片内容无法识别]' }, { status: 500 });
  }
}
