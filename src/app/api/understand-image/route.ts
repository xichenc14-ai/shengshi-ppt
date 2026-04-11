import { NextRequest, NextResponse } from 'next/server';
import { understandImage } from '@/lib/image-understand';
import { rateLimit, getRateLimitConfig } from '@/lib/rate-limit';

const MAX_IMAGE_SIZE = 5 * 1024 * 1024; // 5MB
const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

export async function POST(request: NextRequest) {
  // Rate limit
  const ip = request.headers.get('x-forwarded-for') || 'unknown';
  const { allowed } = rateLimit(`understand:${ip}`, { windowMs: 60000, maxRequests: 10 });
  if (!allowed) {
    return NextResponse.json({ error: '请求过于频繁，请稍后再试' }, { status: 429 });
  }

  try {
    const { image, mimeType } = await request.json();

    if (!image || !mimeType) {
      return NextResponse.json({ error: '缺少图片数据' }, { status: 400 });
    }

    // MIME type check
    if (!ALLOWED_MIME_TYPES.includes(mimeType)) {
      return NextResponse.json({ error: `不支持的图片格式，仅支持 ${ALLOWED_MIME_TYPES.join(', ')}` }, { status: 400 });
    }

    // Size check (base64 encoded: ~4/3 of original)
    const estimatedBytes = Math.ceil((image.length * 3) / 4);
    if (estimatedBytes > MAX_IMAGE_SIZE) {
      return NextResponse.json({ error: '图片过大，请上传5MB以内的图片' }, { status: 413 });
    }

    const text = await understandImage(image, mimeType);
    return NextResponse.json({ text });
  } catch (error: any) {
    console.error('Understand image error:', error);
    return NextResponse.json({ error: '图片识别失败', text: '[图片内容无法识别]' }, { status: 500 });
  }
}
