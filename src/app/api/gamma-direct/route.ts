import { NextRequest, NextResponse } from 'next/server';
import { rateLimit, getRateLimitConfig, getClientIP, isIPBlocked } from '@/lib/rate-limit';
import { selectBestKey, updateKeyBalance, recordKeyFailure } from '@/lib/gamma-key-pool';
import { getGammaThemeId } from '@/lib/gamma-theme-mapping';

const GAMMA_API_BASE = 'https://public-api.gamma.app/v1.0';
const GAMMA_UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

// 场景 → 推荐配置映射(恢复技术部验证的 pictographic)
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
  professional: `【排版规则 - 严格遵守】\n\n📐 字号规范(必须精确):\n- 主标题(#):≥ 44pt,加粗,居中\n- 页面标题(##):≥ 32pt,加粗\n- 大文本要点(###):≥ 24pt,加粗(正文必须是大文本,禁止小字)\n- 卡片标题(- **标题**):≥ 20pt,加粗\n\n📝 内容密度(铁律):\n- 单页正文严格控制在50-80字以内\n- 超出80字必须拆分到下一页\n- 禁止出现大段文本堆积\n- 每页只放3-4个核心要点\n- 神奇数字3与4:归纳为3或4个并列项,触发三列/四宫格布局\n\n🎨 布局触发规则(核心技巧):\n- 3-4个并列要点 → 使用三列/四宫格卡片布局\n- 有序列表(1. 2. 3.)→ 时间轴/流程布局\n- ### 大文本短句 → 独占一行的大字正文\n- **粗体短句** → 视觉强调(放大显示)\n- 对比内容(### 优势 / ### 劣势)→ 左右对照布局\n\n📊 数据可视化(铁律):\n- 提到数据/统计/比例时必须分配图表类型(折线图/柱状图/饼图/散点图): 趋势→折线图📈, 比较→柱状图📊, 占比→饼图🥧, 关系→散点图🔵\n- 所有图表必须显示数据标签\n\n📌 禁止事项(绝对禁止):\n- 禁止普通小字正文(必须是大文本)\n- 禁止将列表排成表格\n- 禁止在内容页堆砌超过4个要点\n\n【风格:专业商务】
配色:克制优雅,主色(深蓝/深灰)+ 1个强调色(金色/橙色),大面积留白
字体:无衬线字体(思源黑体/PingFang SC/Microsoft YaHei)
感觉:麦肯锡/BCG/贝恩咨询PPT风格,权威可信

【图标规则】(图标是PPT视觉丰富度的核心,必须使用)
- 每一页都必须包含2-5个 Icons 图标,用于标记要点和装饰
- 图标风格:Simple, outlined, consistent stroke width, professional
- 禁止出现没有任何图标的页面(即使是纯文字页也必须加装饰性图标)
- 推荐图标库:Font Awesome, Material Icons, Ionicons

【配图规则】(主题套图=themeAccent主题强调图)
- 主题套图:使用Pexels高质量照片(专业摄影师拍摄,0 credits)
- 精选网图:使用webFreeToUseCommercially(免版权商用图搜索)
- 封面页和结尾页必须配高质量照片
- 内容页每页至少配1张相关照片,确保图文结合
- 照片风格(必须包含):Minimalist, clean background, negative space, professional, high quality
- 配图位置:右图或上图,禁止左图布局
- 如文字内容少于40字/页,必须额外增加配图数量

【语言规则】
- 所有文字使用简体中文
- 保持演讲者备注(通过 > 引用块)`,

  casual: `【排版规则 - 严格遵守】\n\n📐 字号规范(必须精确):\n- 主标题(#):≥ 44pt,加粗,居中\n- 大文本要点(###):≥ 24pt,加粗(正文必须是大文本,禁止小字)\n\n📝 内容密度(铁律):\n- 单页正文严格控制在50-80字以内\n- 神奇数字3与4:归纳为3或4个并列项,触发三列/四宫格布局\n\n🎨 布局触发规则:\n- 3-4个并列要点 → 使用三列/四宫格卡片布局\n- ### 大文本短句 → 独占一行的大字正文\n\n📌 禁止事项:\n- 禁止普通小字正文(必须是大文本)\n- 禁止在内容页堆砌超过4个要点\n\n【风格:简洁友好】
配色:明亮清新,主色(蓝/绿)+ 浅色背景,适当使用圆角元素
感觉:Notion/Figma/Slack官方演示风格,友好亲切

【图标规则】(图标是视觉核心,必须大量使用)
- 每一页都必须包含3-6个 Icons,用于标记要点和装饰
- 图标风格:Outlined, rounded, friendly, colorful
- 禁止出现没有任何图标的页面
- 推荐图标库:Font Awesome, Material Icons, Ionicons

【配图规则】
- 不使用外部图片,纯文字+图标+色块设计
- 内容少的页面用装饰性元素和图标补充留白
- 可使用图标库(Font Awesome / Material Icons)

【语言规则】
- 所有文字使用简体中文
- 保持演讲者备注(通过 > 引用块)`,

  creative: `【排版规则 - 严格遵守】\n\n📐 字号规范(必须精确):\n- 主标题(#):≥ 44pt,加粗,居中\n- 大文本要点(###):≥ 24pt,加粗(正文必须是大文本,禁止小字)\n\n📝 内容密度(铁律):\n- 单页正文严格控制在50-80字以内\n- 神奇数字3与4:归纳为3或4个并列项,触发三列/四宫格布局\n\n🎨 布局触发规则:\n- 3-4个并列要点 → 使用三列/四宫格卡片布局\n- ### 大文本短句 → 独占一行的大字正文\n\n📊 数据可视化:\n- 提到数据/统计时必须分配图表类型(折线图/柱状图/饼图): 趋势→折线图📈, 比较→柱状图📊, 占比→饼图🥧\n\n📌 禁止事项:\n- 禁止普通小字正文(必须是大文本)\n- 禁止在内容页堆砌超过4个要点\n\n【风格:大胆创意】
配色:大丰富,2-3个亮色(渐变粉/紫/橙),允许大色块背景
感觉:Apple/特斯拉发布会风格,前卫震撼

【图标规则】(图标是创意呈现的核心手段,必须大量使用)
- 每一页都必须包含3-6个 Icons,用于标记要点和装饰
- 图标风格:Bold, filled, colorful, creative
- 禁止出现没有任何图标的页面
- 推荐图标库:Font Awesome, Material Icons, Ionicons

【配图规则】
- 封面页使用AI生成配图
- 配图风格:creative, vibrant, modern, bold colors, minimalist, negative space
- 配图位置:右图或上图

【语言规则】
- 所有文字使用简体中文
- 保持演讲者备注(通过 > 引用块)`,

  bold: `【排版规则 - 严格遵守】\n\n📐 字号规范(必须精确):\n- 主标题(#):≥ 44pt,加粗,居中\n- 大文本要点(###):≥ 24pt,加粗(正文必须是大文本,禁止小字)\n\n📝 内容密度(铁律):\n- 单页正文严格控制在50-80字以内\n- 神奇数字3与4:归纳为3或4个并列项,触发三列/四宫格布局\n\n🎨 布局触发规则:\n- 3-4个并列要点 → 使用三列/四宫格卡片布局\n- ### 大文本短句 → 独占一行的大字正文\n\n📊 数据可视化:\n- 提到数据/统计时必须分配图表类型(折线图/柱状图/饼图): 趋势→折线图📈, 比较→柱状图📊, 占比→饼图🥧\n\n📌 禁止事项:\n- 禁止普通小字正文(必须是大文本)\n- 禁止在内容页堆砌超过4个要点\n\n【风格:高端科技】
配色:深色主题,深蓝/深灰背景 + 亮色文字,大量使用渐变和光效
感觉:高端科技公司品牌发布,引领未来

【图标规则】(图标是科技感的重要体现,必须大量使用)
- 每一页都必须包含3-6个 Icons,用于标记要点和装饰
- 图标风格:Line icons, futuristic, technology themed
- 禁止出现没有任何图标的页面
- 推荐图标库:Font Awesome, Material Icons, Ionicons

【配图规则】
- 封面页使用震撼的AI生成配图
- 配图风格:futuristic, technology, modern, sleek, minimalist, negative space
- 配图位置:右图或上图

【语言规则】
- 所有文字使用简体中文
- 保持演讲者备注(通过 > 引用块)`,

  traditional: `【排版规则 - 严格遵守】\n\n📐 字号规范(必须精确):\n- 主标题(#):≥ 44pt,加粗,居中\n- 大文本要点(###):≥ 24pt,加粗(正文必须是大文本,禁止小字)\n\n📝 内容密度(铁律):\n- 单页正文严格控制在50-80字以内\n- 神奇数字3与4:归纳为3或4个并列项,触发三列/四宫格布局\n\n🎨 布局触发规则:\n- 3-4个并列要点 → 使用三列/四宫格卡片布局\n- ### 大文本短句 → 独占一行的大字正文\n\n📌 禁止事项:\n- 禁止普通小字正文(必须是大文本)\n- 禁止在内容页堆砌超过4个要点\n\n【风格:中国传统】
配色:古典配色,红/金/墨/米白,祥云/水墨/古典边框装饰
感觉:故宫/国潮品牌发布风格,典雅大气

【图标规则】(图标是中国风PPT的重要装饰元素)
- 每一页都必须包含2-5个 Icons,优先使用中式风格图标
- 图标风格:Chinese traditional elements, elegant line icons
- 禁止出现没有任何图标的页面
- 推荐图标库:Font Awesome(中式元素), 自定义祥云/水墨图标

【配图规则】
- 封面页使用中国风配图
- 配图风格:Chinese traditional, ink wash, classical Chinese art, elegant, minimalist, negative space
- 配图位置:右图或上图

【语言规则】
- 所有文字使用简体中文
- 保持演讲者备注(通过 > 引用块)`,
};

// POST: 直通模式 - 调用 Gamma API 并等待完成,直接返回下载链接
export async function POST(request: NextRequest) {
  const ip = getClientIP(request);
  if (isIPBlocked(ip)) {
    return NextResponse.json({ error: '请求受限' }, { status: 403 });
  }
  const { allowed } = rateLimit(`gamma_direct:${ip}`, getRateLimitConfig('/api/gamma-direct'));
  if (!allowed) {
    return NextResponse.json({ error: '生成请求过于频繁,请稍后再试' }, { status: 429 });
  }

  try {
    const body = await request.json();
    const {
      inputText,
      themeId,
      numCards = 8,
      tone = 'professional',
      // 🚨 V8.2：textMode 不再从请求读取，Gamma 固定使用 preserve
      // 原因：gamma-direct 的 inputText 已经是前端处理好的 markdown
      // （可能来自 buildPreserveMarkdown 或用户手动输入的结构化内容）
      imageSource = 'webFreeToUseCommercially',
      exportAs = 'pdf',
      visualMetaphor,
    } = body;

    if (!inputText?.trim()) {
      return NextResponse.json({ error: '请输入内容' }, { status: 400 });
    }

    // 🚨 V8: 使用Key池智能选择
    const selectedKey = selectBestKey();
    const apiKey = selectedKey.key;
    console.log('[Gamma Direct] 使用Key:', selectedKey.label, '| 余额:', selectedKey.remaining);

    // 🚨 V10.14: 使用主题映射转换themeId
    const rawThemeId = themeId || SCENE_CONFIGS.biz.themeId;
    const finalThemeId = getGammaThemeId(rawThemeId);
    if (finalThemeId !== rawThemeId) {
      console.warn(`[Gamma Direct] ThemeId mapped: "${rawThemeId}" → "${finalThemeId}"`);
    }

    // 构建最终文本
    let finalInputText = inputText.trim();
    if (finalInputText.length < 100) {
      finalInputText = `# ${finalInputText}\n\n---\n`;
    } else if (!finalInputText.includes('---')) {
      finalInputText = finalInputText.split(/\n\n+/).filter((p: string) => p.trim()).join('\n\n---\n\n');
    }

    // 图片选项(与gamma/route.ts保持一致，深色主题处理)
    const darkThemes = new Set(['founder', 'aurora', 'electric', 'blues', 'gamma', 'luxe', 'aurum']);
    let imageOptions: Record<string, any> = {};
    if (imageSource === 'none' || imageSource === 'noImages') {
      imageOptions = { source: 'noImages' }; // 纯文字
    } else if (imageSource === 'theme' || imageSource === 'theme-img') {
      // 🚨 V8.5.2: 深色主题下themeAccent显示占位符，改用网图
      if (darkThemes.has(finalThemeId)) {
        imageOptions = { source: 'webFreeToUseCommercially' };
      } else {
        imageOptions = { source: 'themeAccent' };
      }
    } else if (imageSource === 'pictographic') {
      // 插图模式:深色主题用网图，浅色主题用themeAccent
      if (darkThemes.has(finalThemeId)) {
        imageOptions = { source: 'webFreeToUseCommercially' };
      } else {
        imageOptions = { source: 'themeAccent' };
      }
    } else if (imageSource === 'web') {
      imageOptions = { source: 'webFreeToUseCommercially' };
    } else if (imageSource === 'ai' || imageSource === 'aiGenerated') {
      imageOptions = { source: 'aiGenerated', model: 'imagen-3-flash', style: 'flat illustration, minimalist, clean background, negative space' };
    } else if (imageSource === 'ai-pro') {
      imageOptions = { source: 'aiGenerated', model: 'imagen-3-pro', style: 'professional, high quality, cinematic, detailed' };
    } else {
      imageOptions = { source: 'themeAccent' };
    }

    const instructions = INSTRUCTION_TEMPLATES[tone] || INSTRUCTION_TEMPLATES.professional;
    // 追加全局视觉隐喻
    const metaphorAppend = visualMetaphor
      ? `\n\n【全局视觉隐喻】\n贯穿全演示的统一意象:${visualMetaphor}。\n所有配图、图标、色块风格应与此意象一致,配图描述中必须体现该意象关键词。`
      : '';
    // 免费套图:追加强调布局图指令
    const themeAppend = (imageSource === 'theme' || imageSource === 'theme-img')
      ? `\n\n【主题套图-Pexels高质量照片】\n请为每一页配Pexels高质量照片,照片风格:professional, clean, minimalist, business context。每页使用不同的照片和Gamma内置的Emphasize强调布局,保持视觉丰富度。`
      : '';
    const finalInstructions = instructions + metaphorAppend + themeAppend;

    // 🚨 V8.2：Gamma 固定使用 preserve 模式
    // gamma-direct 的 inputText 已经是前端处理好的 markdown
    // （可能来自 buildPreserveMarkdown 或用户手动输入的结构化内容）
    // Gamma 只负责排版渲染，不做内容扩充/缩减
    const textMode = 'preserve'; // 固定值！

    const criticalInstruction = '\n\n【CRITICAL - 强制排版引擎模式】\n你是一个排版渲染引擎（layout engine ONLY）。禁止创作或修改任何事实信息。严格按照提供的Markdown层级和---分割线生成卡片。禁止自动合并或拆分页面。全局正文强制使用大文本（### 或 **粗体**），禁止普通小字。';

    // 步骤1:创建 Gamma 生成任务(恢复技术部验证的完整参数)
    const gammaPayload = {
      inputText: finalInputText,
      textMode: 'preserve', // 🚨 V8.2：固定使用 preserve
      format: 'presentation',
      numCards,
      exportAs,
      themeId: finalThemeId,
      cardSplit: 'inputTextBreaks', // 🚨 V8.2：强制精确分页
      additionalInstructions: finalInstructions + '\n\n【PPTX兼容性-图标规范】\n所有图标和装饰元素必须使用Unicode符号/emoji代替web SVG图标。' + criticalInstruction,
      textOptions: { amount: 'medium', tone, language: 'zh-cn' },
      imageOptions,
      cardOptions: { dimensions: '16x9' },
    };

    console.log('[Gamma Direct] Payload:', JSON.stringify(gammaPayload, null, 2));

    const createRes = await fetch(`${GAMMA_API_BASE}/generations`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-KEY': apiKey,
        'User-Agent': GAMMA_UA,
      },
      body: JSON.stringify(gammaPayload),
    });

    if (!createRes.ok) {
      const errText = await createRes.text();
      console.error('[Gamma Direct] API error:', createRes.status, errText);
      recordKeyFailure(apiKey);
      return NextResponse.json({
        error: `Gamma API 调用失败: ${createRes.status}`,
        detail: errText.substring(0, 500)
      }, { status: 502 });
    }

    const createData = await createRes.json();
    const generationId = createData.generationId || createData.id;

    // 🚨 V8: 记录积分信息（如果有返回）
    if (createData.credits) {
      updateKeyBalance(apiKey, createData.credits.deducted, createData.credits.remaining);
      console.log('[Gamma Direct] 积分扣除:', createData.credits.deducted, '| 剩余:', createData.credits.remaining);
    }

    return NextResponse.json({
      generationId,
      message: '直通生成任务已创建',
      credits: createData.credits,
    });
  } catch (error: any) {
    console.error('Gamma direct error:', error);
    return NextResponse.json({ error: error.message || '生成失败' }, { status: 500 });
  }
}
