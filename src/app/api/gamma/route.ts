import { NextRequest, NextResponse } from 'next/server';
import { rateLimit, getRateLimitConfig } from '@/lib/rate-limit';

const GAMMA_API_BASE = 'https://public-api.gamma.app/v1.0';
const GAMMA_UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

// 场景 → 推荐配置映射（V6 升级：pictographic免费插图 + imagen-3-flash）
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
  professional: `【排版规则 — 严格遵守】

📐 字号规范（必须精确）：
- 主标题（#）：≥ 44pt，加粗，居中
- 页面标题（##）：≥ 32pt，加粗
- 大文本要点（###）：≥ 24pt，加粗（正文必须是大文本，禁止小字）
- 卡片标题（- **标题**）：≥ 20pt，加粗

📝 内容密度（铁律）：
- 单页正文严格控制在50-80字以内
- 超出80字必须拆分到下一页
- 禁止出现大段文本堆积
- 每页只放3-4个核心要点
- 神奇数字3与4：归纳为3或4个并列项，触发三列/四宫格布局

🎨 布局触发规则（核心技巧）：
- 3-4个并列要点 → 使用三列/四宫格卡片布局
- 有序列表（1. 2. 3.）→ 时间轴/流程布局
- ### 大文本短句 → 独占一行的大字正文（非普通小字）
- **粗体短句** → 视觉强调（放大显示）
- 对比内容（### 优势 / ### 劣势）→ 左右对照布局

📊 数据可视化（铁律）：
- 提到数据/统计/比例时必须分配图表类型（折线图/饼图/柱状图）
- 所有图表必须显示数据标签

📌 禁止事项（绝对禁止）：
- 禁止普通小字正文（必须是大文本）
- 禁止将列表排成表格
- 禁止表格嵌套超过2层
- 禁止在内容页堆砌超过4个要点

【风格：专业商务】
配色：克制优雅，主色（深蓝/深灰）+ 1个强调色（金色/橙色），大面积留白
字体：无衬线字体（思源黑体/PingFang SC/Microsoft YaHei）
布局：规整对称，信息密度适中，视觉层次清晰
感觉：麦肯锡/BCG/贝恩咨询PPT风格，权威可信

【配图规则】
- 封面页和结尾页必须配图
- 配图风格（必须包含）：Minimalist, clean background, negative space, professional, high quality
- 配图位置：右图或上图，禁止左图布局
- 适度使用 Icons 提高可视化

【语言规则】
- 所有文字使用简体中文
- 保持演讲者备注（通过 > 引用块）`,

  casual: `【排版规则 — 严格遵守】

📐 字号规范（必须精确）：
- 主标题（#）：≥ 44pt，加粗，居中
- 页面标题（##）：≥ 32pt，加粗
- 大文本要点（###）：≥ 24pt，加粗（正文必须是大文本，禁止小字）

📝 内容密度（铁律）：
- 单页正文严格控制在50-80字以内
- 神奇数字3与4：归纳为3或4个并列项，触发三列/四宫格布局

🎨 布局触发规则：
- 3-4个并列要点 → 使用三列/四宫格卡片布局
- ### 大文本短句 → 独占一行的大字正文

📌 禁止事项：
- 禁止普通小字正文（必须是大文本）
- 禁止在内容页堆砌超过4个要点

【风格：简洁友好】
配色：明亮清新，主色（蓝/绿）+ 浅色背景，适当使用圆角元素
字体：无衬线字体，现代感强
感觉：Notion/Figma/Slack官方演示风格，友好亲切

【配图规则】
- 不使用外部图片，纯文字+图标+色块设计
- 用色块、图标、几何图形填充视觉空间
- 可使用图标库（Font Awesome / Material Icons）

【语言规则】
- 所有文字使用简体中文
- 保持演讲者备注（通过 > 引用块）`,

  creative: `【排版规则 — 严格遵守】

📐 字号规范（必须精确）：
- 主标题（#）：≥ 44pt，加粗，居中
- 大文本要点（###）：≥ 24pt，加粗（正文必须是大文本，禁止小字）

📝 内容密度（铁律）：
- 单页正文严格控制在50-80字以内
- 神奇数字3与4：归纳为3或4个并列项，触发三列/四宫格布局

🎨 布局触发规则：
- 3-4个并列要点 → 使用三列/四宫格卡片布局
- ### 大文本短句 → 独占一行的大字正文

📊 数据可视化：
- 提到数据/统计时必须分配图表类型，强制显示数据标签

📌 禁止事项：
- 禁止普通小字正文（必须是大文本）
- 禁止在内容页堆砌超过4个要点

【风格：大胆创意】
配色：大丰富，2-3个亮色（渐变粉/紫/橙），允许大色块背景
字体：无衬线字体，粗体突出
感觉：Apple/特斯拉发布会风格，前卫震撼

【配图规则】
- 封面页使用AI生成配图
- 配图风格：creative, vibrant, modern, bold colors, minimalist, negative space
- 配图位置：右图或上图

【语言规则】
- 所有文字使用简体中文
- 保持演讲者备注（通过 > 引用块）`,

  bold: `【排版规则 — 严格遵守】

📐 字号规范（必须精确）：
- 主标题（#）：≥ 44pt，加粗，居中
- 大文本要点（###）：≥ 24pt，加粗（正文必须是大文本，禁止小字）

📝 内容密度（铁律）：
- 单页正文严格控制在50-80字以内
- 神奇数字3与4：归纳为3或4个并列项，触发三列/四宫格布局

🎨 布局触发规则：
- 3-4个并列要点 → 使用三列/四宫格卡片布局
- ### 大文本短句 → 独占一行的大字正文

📊 数据可视化：
- 提到数据/统计时必须分配图表类型，强制显示数据标签

📌 禁止事项：
- 禁止普通小字正文（必须是大文本）
- 禁止在内容页堆砌超过4个要点

【风格：高端科技】
配色：深色主题，深蓝/深灰背景 + 亮色文字，大量使用渐变和光效
字体：无衬线字体，极细/极粗字重对比
感觉：高端科技公司品牌发布，引领未来

【配图规则】
- 封面页使用震撼的AI生成配图
- 配图风格：futuristic, technology, modern, sleek, minimalist, negative space
- 配图位置：右图或上图

【语言规则】
- 所有文字使用简体中文
- 保持演讲者备注（通过 > 引用块）`,

  traditional: `【排版规则 — 严格遵守】

📐 字号规范（必须精确）：
- 主标题（#）：≥ 44pt，加粗，居中
- 页面标题（##）：≥ 32pt，加粗
- 大文本要点（###）：≥ 24pt，加粗（正文必须是大文本，禁止小字）

📝 内容密度（铁律）：
- 单页正文严格控制在50-80字以内
- 神奇数字3与4：归纳为3或4个并列项，触发三列/四宫格布局

🎨 布局触发规则：
- 3-4个并列要点 → 使用三列/四宫格卡片布局
- ### 大文本短句 → 独占一行的大字正文

📌 禁止事项：
- 禁止普通小字正文（必须是大文本）
- 禁止在内容页堆砌超过4个要点

【风格：中国传统】
配色：古典配色，红/金/墨/米白，祥云/水墨/古典边框装饰
字体：标题粗体，正文宋体/黑体
感觉：故宫/国潮品牌发布风格，典雅大气

【配图规则】
- 封面页使用中国风配图
- 配图风格：Chinese traditional, ink wash, classical Chinese art, elegant, minimalist, negative space
- 配图位置：右图或上图

【语言规则】
- 所有文字使用简体中文
- 保持演讲者备注（通过 > 引用块）`,
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
      visualMetaphor,
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

    // 图片模式（V6 升级：三级别方案 + pictographic免费插图）
    // 级别1=标准版（默认pictographic免费），级别2=AI生图（imagen-3-flash），级别3=AI高级（flux-kontext-pro）
    let imageOptions: Record<string, any> = {};
    if (imageMode === 'none') {
      // 级别1-纯净无图
      imageOptions = { source: 'noImages' };
    } else if (imageMode === 'ai') {
      // 级别2-AI生图版（imagen-3-flash: 2 credits，性价比最高）
      imageOptions = { source: 'aiGenerated', model: 'imagen-3-flash', style: 'flat illustration, minimalist, clean background, negative space' };
    } else if (imageMode === 'ai-premium') {
      // 级别3-AI高级图版（需批准，flux-kontext-pro: 20 credits）
      imageOptions = { source: 'aiGenerated', model: 'flux-kontext-pro', style: 'flat illustration, minimalist, clean background, negative space, professional' };
    } else {
      // 默认级别1-标准版：pictographic（免费插图/摘要图，效果好且0 credits）
      imageOptions = { source: 'pictographic' };
    }

    const instructions = INSTRUCTION_TEMPLATES[finalTone] || INSTRUCTION_TEMPLATES.professional;
    // P0修复：追加全局视觉隐喻（如果提供）
    const metaphorAppend = visualMetaphor
      ? `\n\n【全局视觉隐喻】\n贯穿全演示的统一意象：${visualMetaphor}。\n所有配图、图标、色块风格应与此意象一致，配图描述中必须体现该意象关键词。`
      : '';
    const finalInstructions = instructions + metaphorAppend;

    // V6升级：cardSplit精确分页（inputTextBreaks严格按---分页，避免Gamma乱拆分）
    const gammaPayload: Record<string, any> = {
      inputText: finalInputText,
      textMode, // generate=标准/g直通，preserve=省心定制
      format,
      numCards,
      themeId: finalThemeId,
      additionalInstructions: finalInstructions,
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
        cardSplit: 'inputTextBreaks', // V6新增：严格按---分页
      },
      exportAs,
      sharingOptions: {
        workspaceAccess: 'view',
        externalAccess: 'noAccess',
      },
      // V6新增：preserve模式（省心定制）追加强布局指令
      ...(textMode === 'preserve' && {
        additionalInstructions: finalInstructions + '\n\n【省心定制-强化规则】\n严格保持原文结构，每页内容不超过3-4个要点，用---分页的位置必须保留，不要自动合并或拆分页面。'
      }),
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
