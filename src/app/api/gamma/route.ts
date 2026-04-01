import { NextRequest, NextResponse } from 'next/server';

const GAMMA_API_BASE = 'https://public-api.gamma.app/v1.0';
const GAMMA_UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

// 场景 → 推荐配置映射（基于技术部研究成果）
const SCENE_CONFIGS: Record<string, { themeId: string; tone: string; imageSource: string }> = {
  biz: { themeId: 'consultant', tone: 'professional', imageSource: 'webFreeToUseCommercially' },
  pitch: { themeId: 'founder', tone: 'professional', imageSource: 'webFreeToUseCommercially' },
  training: { themeId: 'icebreaker', tone: 'casual', imageSource: 'noImages' },
  creative: { themeId: 'electric', tone: 'creative', imageSource: 'aiGenerated' },
  education: { themeId: 'chisel', tone: 'casual', imageSource: 'noImages' },
  data: { themeId: 'gleam', tone: 'professional', imageSource: 'noImages' },
  annual: { themeId: 'blues', tone: 'professional', imageSource: 'webFreeToUseCommercially' },
  launch: { themeId: 'aurora', tone: 'bold', imageSource: 'aiGenerated' },
};

// additionalInstructions 模板（基于技术部验证的 v2.0 模板）
const INSTRUCTION_TEMPLATES = {
  professional: `用中文生成PPT。要求：
1. 全局正文使用大文本，不要小号字，适合中国用户大字号阅读偏好
2. 不要将列表排成表格形式，超过4个并列项请拆分到多页，每页3-4个用卡片布局
3. 封面页和结尾页必须有配图，过渡页建议配图
4. 内容页根据内容量自动判断是否需要配图：文字多的页面不配图，文字少的页面用图标或配图填充留白
5. 使用无衬线字体风格
6. 配图风格：professional, clean, minimalist, high quality
7. 保持演讲者备注
8. 整体风格统一，专业但不死板`,
  casual: `用中文生成PPT。要求：
1. 全局正文使用大文本，不要小号字
2. 不要将列表排成表格形式，超过4个并列项请拆分到多页
3. 不使用外部图片，纯文字+图标+色块设计
4. 内容少的页面请用图标、色块或装饰元素填充留白区域
5. 使用无衬线字体风格
6. 整体风格简洁友好
7. 保持演讲者备注`,
  creative: `用中文生成PPT。要求：
1. 全局正文使用大文本，不要小号字
2. 视觉风格大胆创新，色彩丰富但统一
3. 封面页和结尾页使用AI生成配图，风格要震撼
4. 配图风格：creative, vibrant, modern, bold colors
5. 使用无衬线字体风格
6. 保持演讲者备注
7. 整体风格现代、未来感`,
  bold: `用中文生成PPT。要求：
1. 全局正文使用大文本，不要小号字
2. 视觉风格大胆，科技感强烈
3. 封面页使用震撼的AI生成配图
4. 配图风格：futuristic, technology, modern, sleek, dark blue accent
5. 使用无衬线字体风格
6. 整体风格高端科技感`,
};

// 创建 Gamma 生成任务
export async function POST(request: NextRequest) {
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
    } = body;

    if (!inputText || inputText.trim().length === 0) {
      return NextResponse.json({ error: '请输入内容' }, { status: 400 });
    }

    const apiKey = process.env.GAMMA_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: 'Gamma API Key 未配置' }, { status: 500 });
    }

    // 根据场景获取推荐配置
    const sceneConfig = SCENE_CONFIGS[scene] || SCENE_CONFIGS.biz;
    const finalThemeId = themeId || sceneConfig.themeId;
    const finalTone = tone || sceneConfig.tone;

    // 图片模式决策
    let imageOptions: Record<string, string> = {};
    if (imageMode === 'none') {
      imageOptions = { source: 'noImages' };
    } else if (imageMode === 'ai') {
      imageOptions = { source: 'aiGenerated', model: 'flux-kontext-fast', style: 'Minimalist, clean background, negative space, professional' };
    } else {
      // auto: 跟随场景配置
      imageOptions = { source: sceneConfig.imageSource };
      if (sceneConfig.imageSource === 'aiGenerated') {
        imageOptions.model = 'flux-kontext-fast';
        imageOptions.style = 'Minimalist, clean background, negative space, professional';
      }
    }

    // 获取 additionalInstructions
    const instructions = (INSTRUCTION_TEMPLATES as any)[finalTone] || INSTRUCTION_TEMPLATES.professional;

    // 构建 inputText（如果用户输入较短，自动增强为结构化 Markdown）
    let finalInputText = inputText.trim();
    if (finalInputText.length < 100) {
      // 短主题 → 自动扩展为带分页的 Markdown，帮助 Gamma 生成更好的结构
      finalInputText = `# ${finalInputText}\n\n---\n`;
    } else if (!finalInputText.includes('---')) {
      // 较长内容但没有分页符 → 按段落自动加分页
      finalInputText = finalInputText
        .split(/\n\n+/)
        .filter((p: string) => p.trim())
        .map((p: string) => p.trim())
        .join('\n\n---\n\n');
      if (!finalInputText.startsWith('#')) {
        finalInputText = `# ${finalInputText}`;
      }
    }

    // 构建 Gamma API 请求体
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

    console.log('Gamma API request:', JSON.stringify({ ...gammaPayload, inputText: `[${gammaPayload.inputText.length} chars]` }, null, 2));

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
      config: {
        themeId: finalThemeId,
        tone: finalTone,
        imageMode: imageOptions.source,
        numCards,
      },
    });
  } catch (error: any) {
    console.error('Gamma generation error:', error);
    return NextResponse.json(
      { error: error.message || '创建生成任务失败' },
      { status: 500 }
    );
  }
}

// 查询 Gamma 生成状态
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
