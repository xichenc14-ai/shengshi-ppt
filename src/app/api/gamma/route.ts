import { NextRequest, NextResponse } from 'next/server';
import { rateLimit, getRateLimitConfig } from '@/lib/rate-limit';
import { generatePPTX } from '@/lib/pptx-generator';

// 场景 → 主题映射
const SCENE_THEME_MAP: Record<string, string> = {
  biz: 'consultant',
  pitch: 'founder',
  training: 'icebreaker',
  creative: 'electric',
  education: 'chisel',
  data: 'gleam',
  annual: 'blues',
  launch: 'aurora',
  traditional: 'chisel',
};

// POST: 本地生成 PPT（纯内存，兼容 Vercel Serverless）
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
      numCards = 8,
      themeId,
      scene = 'biz',
      tone = 'professional',
      imageMode = 'noImages',
      slides,
    } = body;

    if (!inputText && (!slides || slides.length === 0)) {
      return NextResponse.json({ error: '请输入内容' }, { status: 400 });
    }

    // 确定主题
    const finalThemeId = themeId || SCENE_THEME_MAP[scene] || 'consultant';

    // 从 slides 构建 PPT 结构
    let title = 'PPT';
    let slideInputs: any[] = [];

    if (slides && Array.isArray(slides) && slides.length > 0) {
      // 优先使用结构化 slides 数据
      title = slides[0]?.title || inputText?.split('\n')[0]?.replace(/^#\s*/, '').trim() || 'PPT';
      slideInputs = slides.map((s: any) => ({
        title: s.title || '',
        subtitle: s.subtitle,
        content: s.content || [],
        type: s.type,
      }));
    } else {
      // 兜底：从纯文本解析
      title = inputText.split('\n')[0]?.replace(/^#\s*/, '').trim() || 'PPT';
      const paragraphs = inputText.split(/\n\n+/).filter((p: string) => p.trim());
      slideInputs = paragraphs.slice(1).map((p: string) => {
        const lines = p.trim().split('\n');
        return {
          title: lines[0]?.replace(/^#+\s*/, '').trim() || '',
          content: lines.slice(1).map(l => l.replace(/^[-\*]\s*/, '').trim()).filter(Boolean),
        };
      });
    }

    // 生成 PPT（纯内存，不写磁盘）
    const { fileId, base64 } = await generatePPTX({
      title,
      slides: slideInputs,
      themeId: finalThemeId,
    });

    return NextResponse.json({
      generationId: `${fileId}_${Date.now()}`,
      downloadUrl: `data:application/vnd.openxmlformats-officedocument.presentationml.presentation;base64,${base64}`,
      base64,
      filename: `省心PPT_${title.substring(0, 20)}.pptx`,
      message: 'PPT 生成完成',
      config: { themeId: finalThemeId, tone, imageMode, numCards },
    });
  } catch (error: any) {
    console.error('PPTX generation error:', error);
    return NextResponse.json({ error: error.message || 'PPT 生成失败' }, { status: 500 });
  }
}

// GET: 查询状态（本地生成是同步的，不需要查询）
export async function GET(request: NextRequest) {
  return NextResponse.json({ error: '此接口已弃用，本地生成无需轮询' }, { status: 410 });
}
