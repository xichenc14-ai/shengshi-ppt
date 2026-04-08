import { NextRequest, NextResponse } from 'next/server';
import { rateLimit, getRateLimitConfig } from '@/lib/rate-limit';

const GAMMA_API_BASE = 'https://public-api.gamma.app/v1.0';
const GAMMA_UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

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
  professional: `用中文生成PPT。要求：全局正文使用大文本，不要小号字。不要将列表排成表格。封面页和结尾页必须有配图。保持演讲者备注。使用无衬线字体风格。`,
  casual: `用中文生成PPT。要求：全局正文使用大文本，不要小号字。不使用外部图片，纯文字+图标+色块设计。使用无衬线字体风格。`,
  creative: `用中文生成PPT。要求：全局正文使用大文本，不要小号字。视觉风格大胆创新，色彩丰富但统一。封面页使用AI生成配图。配图风格：creative, vibrant, modern, bold colors。使用无衬线字体风格。`,
  bold: `用中文生成PPT。要求：全局正文使用大文本，不要小号字。视觉风格大胆，科技感强烈。封面页使用震撼的AI生成配图。配图风格：futuristic, technology, modern, sleek。使用无衬线字体风格。`,
  traditional: `用中文生成PPT。要求：全局正文使用大文本，不要小号字。整体风格为中国风/古典风格，使用中国传统文化元素。配色以红色、金色、墨色为主。使用无衬线字体风格。保持演讲者备注。`,
};

// POST: 直通模式 - 调用 Gamma API 并等待完成，直接返回下载链接
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
      themeId,
      numCards = 8,
      tone = 'professional',
      textMode = 'generate',
      imageSource = 'webFreeToUseCommercially',
      exportAs = 'pptx',
    } = body;

    if (!inputText?.trim()) {
      return NextResponse.json({ error: '请输入内容' }, { status: 400 });
    }

    const apiKey = process.env.GAMMA_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: 'Gamma API Key 未配置' }, { status: 500 });
    }

    // 构建最终文本
    let finalInputText = inputText.trim();
    if (finalInputText.length < 100) {
      finalInputText = `# ${finalInputText}\n\n---\n`;
    } else if (!finalInputText.includes('---')) {
      finalInputText = finalInputText.split(/\n\n+/).filter((p: string) => p.trim()).join('\n\n---\n\n');
    }

    // 图片选项
    let imageOptions: Record<string, any> = { source: imageSource };
    if (imageSource === 'aiGenerated') {
      imageOptions = { source: 'aiGenerated', model: 'flux-kontext-fast', style: 'Minimalist, clean background, negative space, professional' };
    } else if (imageSource === 'noImages') {
      imageOptions = { source: 'noImages' };
    }

    const instructions = INSTRUCTION_TEMPLATES[tone] || INSTRUCTION_TEMPLATES.professional;
    const finalThemeId = themeId || SCENE_CONFIGS.biz.themeId;

    // 步骤1：创建 Gamma 生成任务
    const createRes = await fetch(`${GAMMA_API_BASE}/generations`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-KEY': apiKey,
        'User-Agent': GAMMA_UA,
      },
      body: JSON.stringify({
        inputText: finalInputText,
        textMode,
        format: 'presentation',
        numCards,
        themeId: finalThemeId,
        additionalInstructions: instructions,
        textOptions: { amount: 'medium', tone, language: 'zh-cn' },
        imageOptions,
        cardOptions: {
          dimensions: '16x9',
          headerFooter: { bottomRight: { type: 'cardNumber' }, hideFromFirstCard: true },
        },
        exportAs,
        sharingOptions: { workspaceAccess: 'view', externalAccess: 'noAccess' },
      }),
    });

    if (!createRes.ok) {
      const errText = await createRes.text();
      console.error('Gamma API create error:', createRes.status, errText);
      return NextResponse.json({ error: `Gamma API 调用失败: ${createRes.status}` }, { status: 502 });
    }

    const createData = await createRes.json();
    const generationId = createData.generationId || createData.id;

    // 步骤2：轮询等待完成（最多 3 分钟）
    const startTime = Date.now();
    const timeoutMs = 180000;
    const pollInterval = 5000;

    while (Date.now() - startTime < timeoutMs) {
      await new Promise(r => setTimeout(r, pollInterval));

      const statusRes = await fetch(`${GAMMA_API_BASE}/generations/${generationId}`, {
        headers: { 'X-API-KEY': apiKey, 'User-Agent': GAMMA_UA },
      });

      if (!statusRes.ok) {
        continue;
      }

      const statusData = await statusRes.json();

      if (statusData.status === 'completed') {
        return NextResponse.json({
          generationId,
          downloadUrl: statusData.exportUrl || null,
          gammaUrl: statusData.gammaUrl || null,
          title: statusData.title || null,
        });
      }

      if (statusData.status === 'failed') {
        return NextResponse.json(
          { error: statusData.error || 'Gamma 生成失败' },
          { status: 502 }
        );
      }
    }

    return NextResponse.json({ error: 'Gamma 生成超时' }, { status: 504 });
  } catch (error: any) {
    console.error('Gamma direct error:', error);
    return NextResponse.json({ error: error.message || '生成失败' }, { status: 500 });
  }
}
