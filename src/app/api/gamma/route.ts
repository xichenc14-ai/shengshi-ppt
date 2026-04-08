import { NextRequest, NextResponse } from 'next/server';
import { rateLimit, getRateLimitConfig } from '@/lib/rate-limit';

const GAMMA_API_BASE = 'https://public-api.gamma.app/v1.0';
const GAMMA_UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

// 场景 → 推荐配置映射
const SCENE_CONFIGS: Record<string, { themeId: string; tone: string; imageSource: string }> = {
  biz: { themeId: 'consultant', tone: 'professional', imageSource: 'webFreeToUseCommercially' },
  pitch: { themeId: 'founder', tone: 'professional', imageSource: 'webFreeToUseCommercially' },
  training: { themeId: 'icebreaker', tone: 'casual', imageSource: 'noImages' },
  creative: { themeId: 'electric', tone: 'creative', imageSource: 'aiGenerated' },
  education: { themeId: 'chisel', tone: 'casual', imageSource: 'noImages' },
  data: { themeId: 'gleam', tone: 'professional', imageSource: 'noImages' },
  annual: { themeId: 'blues', tone: 'professional', imageSource: 'webFreeToUseCommercially' },
  launch: { themeId: 'aurora', tone: 'bold', imageSource: 'aiGenerated' },
  traditional: { themeId: 'chisel', tone: 'traditional', imageSource: 'aiGenerated' },
};

const INSTRUCTION_TEMPLATES: Record<string, string> = {
  professional: `用中文生成PPT。要求：
1. 全局正文使用大文本，不要小号字
2. 不要将列表排成表格，超过4个并列项请拆分到多页
3. 封面页和结尾页必须有配图
4. 保持演讲者备注
5. 使用无衬线字体风格`,
  casual: `用中文生成PPT。要求：
1. 全局正文使用大文本，不要小号字
2. 不使用外部图片，纯文字+图标+色块设计
3. 使用无衬线字体风格`,
  creative: `用中文生成PPT。要求：
1. 全局正文使用大文本，不要小号字
2. 视觉风格大胆创新，色彩丰富但统一
3. 封面页使用AI生成配图
4. 配图风格：creative, vibrant, modern, bold colors
5. 使用无衬线字体风格`,
  bold: `用中文生成PPT。要求：
1. 全局正文使用大文本，不要小号字
2. 视觉风格大胆，科技感强烈
3. 封面页使用震撼的AI生成配图
4. 配图风格：futuristic, technology, modern, sleek
5. 使用无衬线字体风格`,
  traditional: `用中文生成PPT。要求：
1. 全局正文使用大文本，不要小号字
2. 整体风格为中国风/古典风格，使用中国传统文化元素
3. 配色以红色、金色、墨色为主
4. 使用无衬线字体风格
5. 保持演讲者备注`,
};

// POST: 创建 Gamma 生成任务
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
      textMode = 'generate',
      format = 'presentation',
      numCards = 8,
      exportAs = 'pptx',
      themeId,
      scene = 'biz',
      tone,
      imageMode = 'auto',
      slides,
    } = body;

    // 支持结构化 slides 数据或纯文本 inputText
    let finalInputText: string;
    if (inputText && inputText.trim()) {
      // 优先使用 inputText（已由前端 buildMdV2 处理过的高质量 markdown）
      finalInputText = inputText.trim();
      // 短内容自动增强结构
      if (finalInputText.length < 100) {
        finalInputText = `# ${finalInputText}\n\n---\n`;
      } else if (!finalInputText.includes('---') && slides && slides.length > 1) {
        finalInputText = finalInputText.split(/\n\n+/).filter((p: string) => p.trim()).join('\n\n---\n\n');
      }
    } else if (slides && Array.isArray(slides) && slides.length > 0) {
      // 兜底：从结构化 slides 构建 markdown
      const markdown = slides.map((s: any) => {
        const content = (s.content || []).map((c: string) => `- ${c}`).join('\n');
        return `## ${s.title}\n\n${content}`;
      }).join('\n\n---\n\n');
      finalInputText = `# ${slides[0]?.title || 'PPT'}\n\n${markdown}`;
    } else if (inputText) {
      finalInputText = inputText.trim();
      // 短内容自动增强结构
      if (finalInputText.length < 100) {
        finalInputText = `# ${finalInputText}\n\n---\n`;
      } else if (!finalInputText.includes('---')) {
        finalInputText = finalInputText.split(/\n\n+/).filter((p: string) => p.trim()).join('\n\n---\n\n');
      }
    } else {
      return NextResponse.json({ error: '请输入内容' }, { status: 400 });
    }

    if (!finalInputText) {
      return NextResponse.json({ error: '请输入内容' }, { status: 400 });
    }

    const apiKey = process.env.GAMMA_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: 'Gamma API Key 未配置' }, { status: 500 });
    }

    const sceneConfig = SCENE_CONFIGS[scene] || SCENE_CONFIGS.biz;
    const finalThemeId = themeId || sceneConfig.themeId;
    const finalTone = tone || sceneConfig.tone;

    // 图片模式
    let imageOptions: Record<string, any> = {};
    if (imageMode === 'none') {
      imageOptions = { source: 'noImages' };
    } else if (imageMode === 'ai') {
      imageOptions = { source: 'aiGenerated', model: 'flux-kontext-fast', style: 'Minimalist, clean background, negative space, professional' };
    } else {
      imageOptions = { source: sceneConfig.imageSource };
      if (sceneConfig.imageSource === 'aiGenerated') {
        imageOptions.model = 'flux-kontext-fast';
        imageOptions.style = scene === 'traditional'
          ? 'Chinese traditional, ink wash, classical Chinese art, elegant calligraphy'
          : 'Minimalist, clean background, negative space, professional';
      }
    }

    const instructions = INSTRUCTION_TEMPLATES[finalTone] || INSTRUCTION_TEMPLATES.professional;

    const gammaPayload: Record<string, any> = {
      inputText: finalInputText,
      textMode,
      format,
      numCards,
      themeId: finalThemeId,
      additionalInstructions: instructions,
      textOptions: {
        amount: 'medium',
        tone: finalTone,
        language: 'zh-cn',
      },
      imageOptions,
      cardOptions: {
        dimensions: '16x9',
        headerFooter: {
          bottomRight: { type: 'cardNumber' },
          hideFromFirstCard: true,
        },
      },
      exportAs,
      sharingOptions: {
        workspaceAccess: 'view',
        externalAccess: 'noAccess',
      },
    };

    // 创建 Gamma 生成任务
    const gammaResponse = await fetch(`${GAMMA_API_BASE}/generations`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-KEY': apiKey,
        'User-Agent': GAMMA_UA,
      },
      body: JSON.stringify(gammaPayload),
    });

    if (!gammaResponse.ok) {
      const errText = await gammaResponse.text();
      console.error('Gamma API error:', gammaResponse.status, errText);
      return NextResponse.json(
        { error: `Gamma API 调用失败: ${gammaResponse.status}` },
        { status: 502 }
      );
    }

    const gammaData = await gammaResponse.json();
    const generationId = gammaData.generationId || gammaData.id;

    return NextResponse.json({
      generationId,
      message: '生成任务已创建',
      config: { themeId: finalThemeId, tone: finalTone, imageMode: imageOptions.source, numCards },
    });
  } catch (error: any) {
    console.error('Gamma generation error:', error);
    return NextResponse.json(
      { error: error.message || '创建生成任务失败' },
      { status: 500 }
    );
  }
}

// GET: 查询 Gamma 生成状态（前端轮询）
export async function GET(request: NextRequest) {
  try {
    const apiKey = process.env.GAMMA_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: 'Gamma API Key 未配置' }, { status: 500 });
    }

    const { searchParams } = new URL(request.url);
    const generationId = searchParams.get('id');

    if (!generationId) {
      return NextResponse.json({ error: '缺少 generationId' }, { status: 400 });
    }

    const response = await fetch(`${GAMMA_API_BASE}/generations/${generationId}`, {
      headers: {
        'X-API-KEY': apiKey,
        'User-Agent': GAMMA_UA,
      },
    });

    if (!response.ok) {
      return NextResponse.json({ error: `查询失败: ${response.status}` }, { status: 502 });
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error: any) {
    console.error('Gamma status error:', error);
    return NextResponse.json({ error: error.message || '查询失败' }, { status: 500 });
  }
}
