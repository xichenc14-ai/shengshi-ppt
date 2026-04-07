import { NextRequest, NextResponse } from 'next/server';
import { rateLimit, getRateLimitConfig } from '@/lib/rate-limit';
import { generatePPTX } from '@/lib/pptx-generator';

export async function POST(request: NextRequest) {
  const ip = request.headers.get('x-forwarded-for') || 'unknown';
  const { allowed } = rateLimit(`gamma:${ip}`, getRateLimitConfig('/api/gamma'));
  if (!allowed) {
    return NextResponse.json({ error: '生成请求过于频繁，请稍后再试' }, { status: 429 });
  }

  try {
    const body = await request.json();
    const {
      inputText,
      themeId = 'default-light',
      numCards = 10,
      tone = 'professional',
      slides,
    } = body;

    if (!inputText && (!slides || slides.length === 0)) {
      return NextResponse.json({ error: '请输入内容' }, { status: 400 });
    }

    // 从 slides 构建
    let title = 'PPT';
    let slideInputs: any[] = [];

    if (slides && Array.isArray(slides) && slides.length > 0) {
      title = slides[0]?.title || inputText?.split('\n')[0]?.replace(/^#\s*/, '').trim() || 'PPT';
      slideInputs = slides.map((s: any) => ({
        title: s.title || '',
        subtitle: s.subtitle,
        content: s.content || [],
        type: s.type,
      }));
    } else {
      title = inputText.split('\n')[0]?.replace(/^#\s*/, '').trim() || 'PPT';
      const paragraphs = inputText.split(/\n\n+/).filter((p: string) => p.trim());
      slideInputs = paragraphs.slice(1).map((p: string) => {
        const lines = p.trim().split('\n');
        return {
          title: lines[0]?.replace(/^#+\s*/, '').trim() || '',
          content: lines.slice(1).map((l: string) => l.replace(/^[-\*]\s*/, '').trim()).filter(Boolean),
        };
      });
    }

    // 本地生成
    const { fileId, downloadUrl } = await generatePPTX({
      title,
      slides: slideInputs,
      themeId,
    });

    const generationId = `${fileId}_${Date.now()}`;

    return NextResponse.json({
      generationId,
      downloadUrl,
      message: 'PPT 生成完成',
      config: { themeId, tone, numCards },
    });
  } catch (error: any) {
    console.error('PPTX direct generation error:', error);
    return NextResponse.json({ error: error.message || 'PPT 生成失败' }, { status: 500 });
  }
}
