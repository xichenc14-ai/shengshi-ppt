import { NextRequest, NextResponse } from 'next/server';
import { rateLimit, getRateLimitConfig } from '@/lib/rate-limit';

const GAMMA_API_BASE = 'https://public-api.gamma.app/v1.0';
const GAMMA_UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

// 场景 → 推荐配置映射（V6：pictographic免费 + imagen-3-flash）
const SCENE_CONFIGS: Record<string, { themeId: string; tone: string; imageSource: string; imageModel: string }> = {
  biz: { themeId: 'consultant', tone: 'professional', imageSource: 'pictographic', imageModel: 'imagen-3-flash' },
  pitch: { themeId: 'founder', tone: 'professional', imageSource: 'pictographic', imageModel: 'imagen-3-flash' },
  training: { themeId: 'icebreaker', tone: 'casual', imageSource: 'noImages', imageModel: '' },
  creative: { themeId: 'electric', tone: 'creative', imageSource: 'aiGenerated', imageModel: 'imagen-3-flash' },
  education: { themeId: 'chisel', tone: 'casual', imageSource: 'pictographic', imageModel: 'imagen-3-flash' },
  data: { themeId: 'gleam', tone: 'professional', imageSource: 'noImages', imageModel: '' },
  annual: { themeId: 'blues', tone: 'professional', imageSource: 'pictographic', imageModel: 'imagen-3-flash' },
  launch: { themeId: 'aurora', tone: 'bold', imageSource: 'aiGenerated', imageModel: 'imagen-3-flash' },
  traditional: { themeId: 'chisel', tone: 'traditional', imageSource: 'aiGenerated', imageModel: 'imagen-3-flash' },
};

const INSTRUCTION_TEMPLATES: Record<string, string> = {
  professional: `【排版规则 — 严格遵守】\n\n📐 字号规范（必须精确）：\n- 主标题（#）：≥ 44pt，加粗，居中\n- 页面标题（##）：≥ 32pt，加粗\n- 大文本要点（###）：≥ 24pt，加粗（正文必须是大文本，禁止小字）\n- 卡片标题（- **标题**）：≥ 20pt，加粗\n\n📝 内容密度（铁律）：\n- 单页正文严格控制在50-80字以内\n- 超出80字必须拆分到下一页\n- 禁止出现大段文本堆积\n- 每页只放3-4个核心要点\n- 神奇数字3与4：归纳为3或4个并列项，触发三列/四宫格布局\n\n🎨 布局触发规则（核心技巧）：\n- 3-4个并列要点 → 使用三列/四宫格卡片布局\n- 有序列表（1. 2. 3.）→ 时间轴/流程布局\n- ### 大文本短句 → 独占一行的大字正文\n- **粗体短句** → 视觉强调（放大显示）\n- 对比内容（### 优势 / ### 劣势）→ 左右对照布局\n\n📊 数据可视化（铁律）：\n- 提到数据/统计/比例时必须分配图表类型（折线图/饼图/柱状图）\n- 所有图表必须显示数据标签\n\n📌 禁止事项（绝对禁止）：\n- 禁止普通小字正文（必须是大文本）\n- 禁止将列表排成表格\n- 禁止在内容页堆砌超过4个要点\n\n【风格：专业商务】\n配色：克制优雅，主色（深蓝/深灰）+ 1个强调色（金色/橙色），大面积留白\n字体：无衬线字体（思源黑体/PingFang SC/Microsoft YaHei）\n感觉：麦肯锡/BCG/贝恩咨询PPT风格，权威可信\n\n【配图规则】\n- 封面页和结尾页必须配图\n- 配图风格（必须包含）：Minimalist, clean background, negative space, professional, high quality\n- 配图位置：右图或上图，禁止左图布局\n- 适度使用 Icons 提高可视化\n\n【语言规则】\n- 所有文字使用简体中文\n- 保持演讲者备注（通过 > 引用块）`,

  casual: `【排版规则 — 严格遵守】\n\n📐 字号规范（必须精确）：\n- 主标题（#）：≥ 44pt，加粗，居中\n- 大文本要点（###）：≥ 24pt，加粗（正文必须是大文本，禁止小字）\n\n📝 内容密度（铁律）：\n- 单页正文严格控制在50-80字以内\n- 神奇数字3与4：归纳为3或4个并列项，触发三列/四宫格布局\n\n🎨 布局触发规则：\n- 3-4个并列要点 → 使用三列/四宫格卡片布局\n- ### 大文本短句 → 独占一行的大字正文\n\n📌 禁止事项：\n- 禁止普通小字正文（必须是大文本）\n- 禁止在内容页堆砌超过4个要点\n\n【风格：简洁友好】\n配色：明亮清新，主色（蓝/绿）+ 浅色背景，适当使用圆角元素\n感觉：Notion/Figma/Slack官方演示风格，友好亲切\n\n【配图规则】\n- 不使用外部图片，纯文字+图标+色块设计\n- 可使用图标库（Font Awesome / Material Icons）\n\n【语言规则】\n- 所有文字使用简体中文\n- 保持演讲者备注（通过 > 引用块）`,

  creative: `【排版规则 — 严格遵守】\n\n📐 字号规范（必须精确）：\n- 主标题（#）：≥ 44pt，加粗，居中\n- 大文本要点（###）：≥ 24pt，加粗（正文必须是大文本，禁止小字）\n\n📝 内容密度（铁律）：\n- 单页正文严格控制在50-80字以内\n- 神奇数字3与4：归纳为3或4个并列项，触发三列/四宫格布局\n\n🎨 布局触发规则：\n- 3-4个并列要点 → 使用三列/四宫格卡片布局\n- ### 大文本短句 → 独占一行的大字正文\n\n📊 数据可视化：\n- 提到数据/统计时必须分配图表类型，强制显示数据标签\n\n📌 禁止事项：\n- 禁止普通小字正文（必须是大文本）\n- 禁止在内容页堆砌超过4个要点\n\n【风格：大胆创意】\n配色：大丰富，2-3个亮色（渐变粉/紫/橙），允许大色块背景\n感觉：Apple/特斯拉发布会风格，前卫震撼\n\n【配图规则】\n- 封面页使用AI生成配图\n- 配图风格：creative, vibrant, modern, bold colors, minimalist, negative space\n- 配图位置：右图或上图\n\n【语言规则】\n- 所有文字使用简体中文\n- 保持演讲者备注（通过 > 引用块）`,

  bold: `【排版规则 — 严格遵守】\n\n📐 字号规范（必须精确）：\n- 主标题（#）：≥ 44pt，加粗，居中\n- 大文本要点（###）：≥ 24pt，加粗（正文必须是大文本，禁止小字）\n\n📝 内容密度（铁律）：\n- 单页正文严格控制在50-80字以内\n- 神奇数字3与4：归纳为3或4个并列项，触发三列/四宫格布局\n\n🎨 布局触发规则：\n- 3-4个并列要点 → 使用三列/四宫格卡片布局\n- ### 大文本短句 → 独占一行的大字正文\n\n📊 数据可视化：\n- 提到数据/统计时必须分配图表类型，强制显示数据标签\n\n📌 禁止事项：\n- 禁止普通小字正文（必须是大文本）\n- 禁止在内容页堆砌超过4个要点\n\n【风格：高端科技】\n配色：深色主题，深蓝/深灰背景 + 亮色文字，大量使用渐变和光效\n感觉：高端科技公司品牌发布，引领未来\n\n【配图规则】\n- 封面页使用震撼的AI生成配图\n- 配图风格：futuristic, technology, modern, sleek, minimalist, negative space\n- 配图位置：右图或上图\n\n【语言规则】\n- 所有文字使用简体中文\n- 保持演讲者备注（通过 > 引用块）`,

  traditional: `【排版规则 — 严格遵守】\n\n📐 字号规范（必须精确）：\n- 主标题（#）：≥ 44pt，加粗，居中\n- 大文本要点（###）：≥ 24pt，加粗（正文必须是大文本，禁止小字）\n\n📝 内容密度（铁律）：\n- 单页正文严格控制在50-80字以内\n- 神奇数字3与4：归纳为3或4个并列项，触发三列/四宫格布局\n\n🎨 布局触发规则：\n- 3-4个并列要点 → 使用三列/四宫格卡片布局\n- ### 大文本短句 → 独占一行的大字正文\n\n📌 禁止事项：\n- 禁止普通小字正文（必须是大文本）\n- 禁止在内容页堆砌超过4个要点\n\n【风格：中国传统】\n配色：古典配色，红/金/墨/米白，祥云/水墨/古典边框装饰\n感觉：故宫/国潮品牌发布风格，典雅大气\n\n【配图规则】\n- 封面页使用中国风配图\n- 配图风格：Chinese traditional, ink wash, classical Chinese art, elegant, minimalist, negative space\n- 配图位置：右图或上图\n\n【语言规则】\n- 所有文字使用简体中文\n- 保持演讲者备注（通过 > 引用块）`,
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
      visualMetaphor,
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

    // 图片选项（V6新4种模式）
    // 1=纯净无图 2=精选套图(强调布局图) 3=定制网图 4=定制AI图
    let imageOptions: Record<string, any> = {};
    if (imageSource === 'none' || imageSource === 'noImages') {
      imageOptions = { source: 'noImages' };
    } else if (imageSource === 'emphasis') {
      // 精选套图（强调布局图，由additionalInstructions触发）
      imageOptions = { source: 'noImages' };
    } else if (imageSource === 'web') {
      imageOptions = { source: 'webFreeToUseCommercially' };
    } else if (imageSource === 'ai' || imageSource === 'aiGenerated') {
      // 定制AI图：只用普通模型，禁用高级模型
      imageOptions = { source: 'aiGenerated', model: 'imagen-3-flash', style: 'flat illustration, minimalist, clean background, negative space' };
    } else {
      imageOptions = { source: 'noImages' };
    }

    const instructions = INSTRUCTION_TEMPLATES[tone] || INSTRUCTION_TEMPLATES.professional;
    // 追加全局视觉隐喻
    const metaphorAppend = visualMetaphor
      ? `\n\n【全局视觉隐喻】\n贯穿全演示的统一意象：${visualMetaphor}。\n所有配图、图标、色块风格应与此意象一致，配图描述中必须体现该意象关键词。`
      : '';
    // 精选套图：追加强调布局图指令
    const emphasisAppend = imageSource === 'emphasis'
      ? `\n\n【精选套图-强调布局图】\n请为每一页自动配Gamma内置的强调布局图（Emphasize布局），这些是Gamma模板自带的免费装饰性图片，不需要额外credits。每页使用不同的强调图，保持视觉丰富度。`
      : '';
    const finalInstructions = instructions + metaphorAppend + emphasisAppend;
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
        additionalInstructions: finalInstructions,
        textOptions: { amount: 'medium', tone, language: 'zh-cn' },
        imageOptions,
        cardOptions: {
          dimensions: '16x9',
          headerFooter: { bottomRight: { type: 'cardNumber' }, hideFromFirstCard: true },
          cardSplit: 'inputTextBreaks', // V6新增：精确分页控制
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
