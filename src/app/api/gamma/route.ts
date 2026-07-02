import { NextRequest, NextResponse } from 'next/server';
import { rateLimit, getRateLimitConfig, getClientIP, isIPBlocked } from '@/lib/rate-limit';
import { selectBestKey, updateKeyBalance, recordKeyFailure, getAllKeys } from '@/lib/gamma-key-pool';
import { getGammaThemeId } from '@/lib/gamma-theme-mapping';
import { buildGammaImageOptions, normalizeUserInput } from '@/lib/adapters/ppt-param-adapter';
import { resolveSmartThemeId } from '@/lib/smart-theme-matcher';

const GAMMA_API_BASE = 'https://public-api.gamma.app/v1.0';
const GAMMA_UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
const PPTX_SAFE_ICON_RULES = `【PPTX安全图标与字体规范-最高优先级】
- PPTX下载必须离线完整显示，禁止使用Gamma Icons、Font Awesome、Material Icons、Ionicons、web SVG图标、外部图片型图标或任何需要远程加载的装饰图标。
- 要点标记必须使用PPTX稳定元素：圆形/胶囊形/数字徽章/短线/分隔线/色块/Unicode文字符号，确保导出PPTX后不出现破图、红叉、缺图图标。
- 图标感可以用基础矢量形状组合实现，例如圆点+线条、序号圆牌、勾选符号、箭头符号；不要插入图片格式的小图标。
- 字体层级必须符合国内PPT阅读习惯：主标题使用 # 一级标题且≥44pt；页面标题使用 ## 且≥32pt；核心要点使用 ### 或 #### 标题级大文本且≥24pt；禁止普通小字正文作为主要内容。`;

function normalizePptxSafeInstructions(instructions: string): string {
  const withoutFragileIconBlocks = String(instructions || '')
    .replace(/【图标规则】[\s\S]*?(?=\n\n【配图规则】)/g, '')
    .replace(/【图标规范-统一风格】[\s\S]*?(?=\n\n【|$)/g, '');
  return `${withoutFragileIconBlocks.trim()}\n\n${PPTX_SAFE_ICON_RULES}`;
}

function resolveLockedThemeFromIntent(intentHints: unknown, currentThemeId: string): string {
  if (!intentHints || typeof intentHints !== 'object') return currentThemeId;
  const hints = intentHints as Record<string, unknown>;
  if (!hints.themeLocked) return currentThemeId;

  const label = String(hints.themeLabel || '').trim();
  if (!label) return currentThemeId;

  return resolveSmartThemeId({
    text: label,
    fallbackThemeId: currentThemeId,
  })?.themeId || currentThemeId;
}

function buildUploadedFilesInstruction(uploadedFiles: unknown): string {
  if (!Array.isArray(uploadedFiles) || uploadedFiles.length === 0) return '';

  const fileLines = uploadedFiles
    .slice(0, 10)
    .map((file: any) => {
      const size = typeof file?.size === 'number' ? `${(file.size / 1024 / 1024).toFixed(2)}MB` : '未知大小';
      const passthrough = file?.passthrough ? '，未做站内文字提取' : '';
      return `- ${file?.name || '未命名附件'} (${file?.type || 'application/octet-stream'}, ${size}${passthrough})`;
    })
    .join('\n');

  return `\n\n【用户上传附件】\n${fileLines}\n这些附件是用户提供的生成素材。若当前 inputText 中没有附件正文，请不要编造附件中的具体事实；只根据用户需求、已确认大纲和已提取文本生成。`;
}

// 场景 → 推荐配置映射(恢复技术部验证的 pictographic)
const SCENE_CONFIGS: Record<string, { themeId: string; tone: string; imageSource: string; imageModel: string }> = {
  biz: { themeId: 'consultant', tone: 'professional', imageSource: 'pictographic', imageModel: 'imagen-3-flash' },
  pitch: { themeId: 'founder', tone: 'professional', imageSource: 'pictographic', imageModel: 'imagen-3-flash' },
  training: { themeId: 'cornflower', tone: 'casual', imageSource: 'themeAccent', imageModel: '' },
  creative: { themeId: 'electric', tone: 'creative', imageSource: 'aiGenerated', imageModel: 'imagen-3-flash' },
  education: { themeId: 'chisel', tone: 'casual', imageSource: 'pictographic', imageModel: 'imagen-3-flash' },
  data: { themeId: 'gleam', tone: 'professional', imageSource: 'themeAccent', imageModel: '' },
  annual: { themeId: 'blues', tone: 'professional', imageSource: 'pictographic', imageModel: 'imagen-3-flash' },
  launch: { themeId: 'aurora', tone: 'bold', imageSource: 'aiGenerated', imageModel: 'imagen-3-flash' },
  traditional: { themeId: 'chisel', tone: 'traditional', imageSource: 'aiGenerated', imageModel: 'imagen-3-flash' },
};

const INSTRUCTION_TEMPLATES: Record<string, string> = {
  professional: `【排版规则 - 严格遵守】

📐 字号规范(必须精确):
- 主标题(#):≥ 44pt,加粗,居中
- 页面标题(##):≥ 32pt,加粗
- 大文本要点(###):≥ 24pt,加粗(正文必须是大文本,禁止小字)
- 卡片标题(- **标题**):≥ 20pt,加粗

📝 内容密度(铁律):
- 单页正文严格控制在50-80字以内
- 超出80字必须拆分到下一页
- 禁止出现大段文本堆积
- 每页只放3-4个核心要点
- 神奇数字3与4:归纳为3或4个并列项,触发三列/四宫格布局

🎨 布局触发规则(核心技巧):
- 3-4个并列要点 → 使用三列/四宫格卡片布局
- 有序列表(1. 2. 3.)→ 时间轴/流程布局
- ### 大文本短句 → 独占一行的大字正文(非普通小字)
- **粗体短句** → 视觉强调(放大显示)
- 对比内容(### 优势 / ### 劣势)→ 左右对照布局

📊 数据可视化(铁律):
- 提到数据/统计/比例时必须分配图表类型(折线图/柱状图/饼图/散点图)
- 趋势变化 → 折线图 📈
- 数量比较 → 柱状图 📊
- 占比份额 → 饼图/环形图 🥧
- 关系分布 → 散点图 🔵
- 所有图表必须显示数据标签
- 图表标题清晰，说明数据来源

📌 禁止事项(绝对禁止):
- 禁止普通小字正文(必须是大文本)
- 禁止将列表排成表格
- 禁止表格嵌套超过2层
- 禁止在内容页堆砌超过4个要点

【风格:专业商务】
配色:克制优雅,主色(深蓝/深灰)+ 1个强调色(金色/橙色),大面积留白
字体:无衬线字体(思源黑体/PingFang SC/Microsoft YaHei)
布局:规整对称,信息密度适中,视觉层次清晰
感觉:麦肯锡/BCG/贝恩咨询PPT风格,权威可信

【图标规则】(图标是PPT视觉丰富度的核心,必须使用)
- 每一页都必须包含2-5个 Icons 图标,用于标记要点和装饰
- 图标风格:Simple, outlined, consistent stroke width, professional
- 图标颜色:与主色调保持一致
- 禁止出现没有任何图标的页面(即使是纯文字页也必须加装饰性图标)
- 推荐图标库:Font Awesome, Material Icons, Ionicons

【配图规则】(主题套图=themeAccent主题强调图,Pexels图库=pexels)
- 严格遵循 imageOptions.source（themeAccent / pexels / aiGenerated / noImages）
- source=themeAccent 时，优先主题强调图；如无法出图，改为纯文字+图标布局，不得保留空白图片框
- source=pexels/ai 时，优先对应来源配图；若取图失败，必须删除图片容器并改用图标、色块或纯文字布局，不得回退其它图片源
- 禁止固定“右侧图片槽位”而没有实际图片内容

【语言规则】
- 所有文字使用简体中文
- 保持演讲者备注(通过 > 引用块)`,

  casual: `【排版规则 - 严格遵守】

📐 字号规范(必须精确):
- 主标题(#):≥ 44pt,加粗,居中
- 页面标题(##):≥ 32pt,加粗
- 大文本要点(###):≥ 24pt,加粗(正文必须是大文本,禁止小字)

📝 内容密度(铁律):
- 单页正文严格控制在50-80字以内
- 神奇数字3与4:归纳为3或4个并列项,触发三列/四宫格布局

🎨 布局触发规则:
- 3-4个并列要点 → 使用三列/四宫格卡片布局
- ### 大文本短句 → 独占一行的大字正文

📌 禁止事项:
- 禁止普通小字正文(必须是大文本)
- 禁止在内容页堆砌超过4个要点

【风格:简洁友好】
配色:明亮清新,主色(蓝/绿)+ 浅色背景,适当使用圆角元素
字体:无衬线字体,现代感强
感觉:Notion/Figma/Slack官方演示风格,友好亲切

【图标规则】(图标是视觉核心,必须大量使用)
- 每一页都必须包含3-6个 Icons,用于标记要点和装饰
- 图标风格:Outlined, rounded, friendly, colorful
- 禁止出现没有任何图标的页面
- 推荐图标库:Font Awesome, Material Icons, Ionicons

【配图规则】
- 严格遵循 imageOptions.source（themeAccent / pexels / aiGenerated / noImages）
- 用户选网图/AI图时，如对应来源失败，允许改为纯文字+图标+色块布局，但绝不允许切换成其它图片源
- 结构页优先有图，但图片失败时必须移除图片容器，禁止空白占位框、灰框或丢图图标

【语言规则】
- 所有文字使用简体中文
- 保持演讲者备注(通过 > 引用块)`,

  creative: `【排版规则 - 严格遵守】

📐 字号规范(必须精确):
- 主标题(#):≥ 44pt,加粗,居中
- 大文本要点(###):≥ 24pt,加粗(正文必须是大文本,禁止小字)

📝 内容密度(铁律):
- 单页正文严格控制在50-80字以内
- 神奇数字3与4:归纳为3或4个并列项,触发三列/四宫格布局

🎨 布局触发规则:
- 3-4个并列要点 → 使用三列/四宫格卡片布局
- ### 大文本短句 → 独占一行的大字正文

📊 数据可视化:
- 提到数据/统计时必须分配图表类型,强制显示数据标签

📌 禁止事项:
- 禁止普通小字正文(必须是大文本)
- 禁止在内容页堆砌超过4个要点

【风格:大胆创意】
配色:大丰富,2-3个亮色(渐变粉/紫/橙),允许大色块背景
字体:无衬线字体,粗体突出
感觉:Apple/特斯拉发布会风格,前卫震撼

【图标规则】(图标是创意呈现的核心手段,必须大量使用)
- 每一页都必须包含3-6个 Icons,用于标记要点和装饰
- 图标风格:Bold, filled, colorful, creative
- 禁止出现没有任何图标的页面
- 推荐图标库:Font Awesome, Material Icons, Ionicons

【配图规则】
- 严格遵循 imageOptions.source（themeAccent / pexels / aiGenerated / noImages）
- 只有当 source=aiGenerated 时才使用 AI 生成图；source=pexels 时必须用 Pexels 图
- 配图风格: creative, minimalist, clean background, negative space

【语言规则】
- 所有文字使用简体中文
- 保持演讲者备注(通过 > 引用块)`,

  bold: `【排版规则 - 严格遵守】

📐 字号规范(必须精确):
- 主标题(#):≥ 44pt,加粗,居中
- 大文本要点(###):≥ 24pt,加粗(正文必须是大文本,禁止小字)

📝 内容密度(铁律):
- 单页正文严格控制在50-80字以内
- 神奇数字3与4:归纳为3或4个并列项,触发三列/四宫格布局

🎨 布局触发规则:
- 3-4个并列要点 → 使用三列/四宫格卡片布局
- ### 大文本短句 → 独占一行的大字正文

📊 数据可视化:
- 提到数据/统计时必须分配图表类型,强制显示数据标签

📌 禁止事项:
- 禁止普通小字正文(必须是大文本)
- 禁止在内容页堆砌超过4个要点

【风格:高端科技】
配色:深色主题,深蓝/深灰背景 + 亮色文字,大量使用渐变和光效
字体:无衬线字体,极细/极粗字重对比
感觉:高端科技公司品牌发布,引领未来

【图标规则】(图标是科技感的重要体现,必须大量使用)
- 每一页都必须包含3-6个 Icons,用于标记要点和装饰
- 图标风格:Line icons, futuristic, technology themed
- 禁止出现没有任何图标的页面
- 推荐图标库:Font Awesome, Material Icons, Ionicons

【配图规则】
- 严格遵循 imageOptions.source（themeAccent / pexels / aiGenerated / noImages）
- 只有当 source=aiGenerated 时才使用 AI 生成图；source=pexels 时必须用 Pexels 图
- 配图风格:futuristic, technology, minimalist, negative space

【语言规则】
- 所有文字使用简体中文
- 保持演讲者备注(通过 > 引用块)`,

  traditional: `【排版规则 - 严格遵守】

📐 字号规范(必须精确):
- 主标题(#):≥ 44pt,加粗,居中
- 页面标题(##):≥ 32pt,加粗
- 大文本要点(###):≥ 24pt,加粗(正文必须是大文本,禁止小字)

📝 内容密度(铁律):
- 单页正文严格控制在50-80字以内
- 神奇数字3与4:归纳为3或4个并列项,触发三列/四宫格布局

🎨 布局触发规则:
- 3-4个并列要点 → 使用三列/四宫格卡片布局
- ### 大文本短句 → 独占一行的大字正文

📌 禁止事项:
- 禁止普通小字正文(必须是大文本)
- 禁止在内容页堆砌超过4个要点

【风格:中国传统】
配色:古典配色,红/金/墨/米白,祥云/水墨/古典边框装饰
字体:标题粗体,正文宋体/黑体
感觉:故宫/国潮品牌发布风格,典雅大气

【图标规则】(图标是中国风PPT的重要装饰元素)
- 每一页都必须包含2-5个 Icons,优先使用中式风格图标
- 图标风格:Chinese traditional elements, elegant line icons
- 禁止出现没有任何图标的页面
- 推荐图标库:Font Awesome(中式元素), 自定义祥云/水墨图标

【配图规则】
- 严格遵循 imageOptions.source（themeAccent / pexels / aiGenerated / noImages）
- source=aiGenerated 时使用国风 AI 图；source=pexels 时使用国风 Pexels 图；source=themeAccent 使用主题强调图；source=noImages 时保持无图
- 配图风格:Chinese traditional, elegant, minimalist, negative space

【语言规则】
- 所有文字使用简体中文
- 保持演讲者备注(通过 > 引用块)`,
};

function buildSmartImagePolicy(source: unknown): {
  keyPageHint: string;
  contentPageHint: string;
  allowThemeAccentOnKeyPages: boolean;
  contentMustHaveImage: boolean;
  keyPageMustHaveImage: boolean;
} {
  const normalized = String(source || '').trim();
  if (normalized === 'aiGenerated') {
    return {
      keyPageHint: '结构页只有在 AI 图已成功生成且可见时才放图片；若生成失败，必须完全删除图片元素和图片容器，改用图标或色块布局，禁止保留空图槽',
      contentPageHint: '内容页只有在 AI 图已成功生成且可见时才放图片；若生成失败，必须完全删除图片元素和图片容器，改用图标+色块排版',
      allowThemeAccentOnKeyPages: false,
      contentMustHaveImage: false,
      keyPageMustHaveImage: false,
    };
  }
  if (normalized === 'pexels' || normalized === 'webFreeToUseCommercially') {
    return {
      keyPageHint: '结构页只有在 Pexels 图片已成功加载且可见时才放图片；若取图失败，必须完全删除图片元素和图片容器，改用图标或色块布局，禁止保留空图槽',
      contentPageHint: '内容页不强调大图布局；只有在 Pexels 图片已成功加载且可见时才保留插图，否则直接删除图片元素和图片容器，改用图标+色块或纯文字排版',
      allowThemeAccentOnKeyPages: false,
      contentMustHaveImage: false,
      keyPageMustHaveImage: false,
    };
  }
  if (normalized === 'noImages') {
    return {
      keyPageHint: '结构页使用纯文字、图标、色块和强调标题完成视觉，不创建任何图片元素或图片容器',
      contentPageHint: '内容页默认无图，仅使用文字、图标、色块、时间轴、卡片等无图布局',
      allowThemeAccentOnKeyPages: false,
      contentMustHaveImage: false,
      keyPageMustHaveImage: false,
    };
  }
  return {
    keyPageHint: '结构页只有在主题强调图已成功加载且可见时才使用图片；若主题图不可用，必须完全删除图片元素和图片容器，改为纯文字+图标布局',
    contentPageHint: '内容页默认不使用 Emphasize 大图布局，也不要固定右侧图片槽；如确需配图，只能在图片真实可见时插入小图或辅助图，失败则必须完全删除图片元素和图片容器，改用图标、色块或大字排版',
    allowThemeAccentOnKeyPages: true,
    contentMustHaveImage: false,
    keyPageMustHaveImage: false,
  };
}

function buildContentImageGuidance(params: {
  source: unknown;
  tone: string;
  scene: string;
  inputText: string;
}): string {
  const source = String(params.source || '');
  const tone = String(params.tone || 'professional');
  const scene = String(params.scene || 'biz');
  const text = String(params.inputText || '').toLowerCase();
  const sceneHints: Record<string, string> = {
    biz: '商务办公、团队协作、会议场景、现代写字楼',
    pitch: '创业路演、产品演示、发布会主视觉',
    training: '课堂培训、学习互动、讲解示意',
    creative: '创意概念、视觉冲击、艺术化构图',
    education: '教学场景、知识图解、校园或学习环境',
    data: '图表相关场景、分析看板、数据业务环境',
    annual: '年度回顾、里程碑、团队成果呈现',
    launch: '新品发布、科技感主视觉、舞台灯光氛围',
    '旅游出行': '城市地标、旅行目的地、景点实拍、街区漫游、在地生活方式体验',
    traditional: '中式审美、传统文化元素、留白构图',
  };
  const toneHints: Record<string, string> = {
    professional: '克制、干净、真实感、商务质感',
    casual: '友好、明亮、轻松、生活化',
    creative: '大胆、风格化、构图有张力',
    bold: '高对比、科技感、未来感',
    traditional: '典雅、含蓄、东方审美',
  };
  const keywordHint = /海|湾|滨海|度假|海景|社区/.test(text)
    ? '优先包含海岸线、社区景观、宜居生活方式等元素'
    : '优先选择与当前页标题语义直接相关的场景元素';
  const sourceHint = source === 'aiGenerated'
    ? 'AI图提示词要明确主体、场景、光线与镜头视角，避免抽象无主体画面'
    : source === 'pexels' || source === 'webFreeToUseCommercially'
      ? 'Pexels 图优先选高分辨率横向主图，避免拼贴、低清噪点与无关素材'
      : source === 'noImages'
        ? '保持无图策略，不生成图片容器，靠文字、图标和色块完成视觉'
      : '主题强调图与内容语义保持一致，避免与标题无关的装饰图';
  return `内容页配图智能引导：按页标题与要点语义选图，场景偏好=${sceneHints[scene] || '通用业务场景'}；风格偏好=${toneHints[tone] || toneHints.professional}；${keywordHint}；${sourceHint}。`;
}

// POST: 创建 Gamma 生成任务
export async function POST(request: NextRequest) {
  const ip = getClientIP(request);
  if (isIPBlocked(ip)) {
    return NextResponse.json({ error: '请求受限' }, { status: 403 });
  }
  const { allowed } = rateLimit(`gamma:${ip}`, getRateLimitConfig('/api/gamma'));
  if (!allowed) {
    return NextResponse.json({ error: '生成请求过于频繁,请稍后再试' }, { status: 429 });
  }

  // 限制 inputText 长度（防超大payload攻击）
  try {
    const body = await request.json();
    const {
      inputText,
      // 🚨 V8.2：textMode 不再从请求读取，Gamma 固定使用 preserve
      // 原因：大纲已由 outline API 预处理，Gamma 只负责排版
      // 用户选的扩充/缩减/保持，只影响 outline API，不影响 Gamma
      format = 'presentation',
      numCards,
      exportAs = 'pptx',
      themeId,
      scene = 'biz',
      tone,
      imageMode = 'auto',
      slides,
      visualMetaphor,
      strictPreserve = false,
      // 省心模式传的完整参数
      additionalInstructions,
      imageOptions,
      cardOptions,
      cardSplit,
      textOptions,
      uploadedFiles,
      auto = false,
      intentHints,
    } = body;

    // 🚨 D1: Normalize aliased fields → canonical PptUserInput
    const normalized = normalizeUserInput(body as Record<string, unknown>);
    const pageCount = normalized.pageCount ?? 8;
    const isSmartFlow = Boolean(auto) || normalized.auto === true;
    const requestedImageSource = normalized.imageSource || imageMode;
    const mappedPreviewImageOptions = buildGammaImageOptions(
      requestedImageSource,
      typeof themeId === 'string' ? themeId : undefined,
      imageOptions && typeof imageOptions === 'object'
        ? (imageOptions as Record<string, unknown>)
        : undefined
    );
    console.log('[Gamma] IMAGE_SOURCE_MAP preview=', JSON.stringify({
      requested: requestedImageSource,
      mappedSource: mappedPreviewImageOptions?.source || 'themeAccent',
      auto: isSmartFlow,
    }));

    // 支持结构化 slides 数据或纯文本 inputText
    let finalInputText: string;
    const normalizedInputText =
      typeof normalized.inputText === 'string' ? normalized.inputText : '';
    const requestInputText = typeof inputText === 'string' ? inputText : '';
    const effectiveInputText = requestInputText || normalizedInputText;
    const hasTextInput = effectiveInputText.trim().length > 0;

    if (hasTextInput) {
      // 优先使用 inputText(已由前端 buildMdV2 处理过的高质量 markdown)
      finalInputText = effectiveInputText.trim();
      // 短内容自动增强结构
      if (finalInputText.length < 100) {
        finalInputText = `# ${finalInputText}\n\n---\n`;
      } else if (!finalInputText.includes('---') && slides && slides.length > 1) {
        finalInputText = finalInputText.split(/\n\n+/).filter((p: string) => p.trim()).join('\n\n---\n\n');
      }
    } else if (slides && Array.isArray(slides) && slides.length > 0) {
      // 兜底:从结构化 slides 构建 markdown
      const markdown = slides.map((s: any) => {
        const content = (s.content || []).map((c: string) => `- ${c}`).join('\n');
        return `## ${s.title}\n\n${content}`;
      }).join('\n\n---\n\n');
      finalInputText = `# ${slides[0]?.title || 'PPT'}\n\n${markdown}`;
    } else {
      return NextResponse.json({ error: '请输入内容' }, { status: 400 });
    }

    if (!finalInputText || !finalInputText.trim()) {
      return NextResponse.json({ error: '请输入内容' }, { status: 400 });
    }

    // 🚨 V8.3 修复：短内容增强时，确保不以空标题开头
    if (finalInputText.length < 100) {
      // 如果 inputText 没有 # 开头，加一个标题
      if (!finalInputText.startsWith('#')) {
        finalInputText = `# PPT\n\n${finalInputText}\n\n---\n`;
      } else {
        finalInputText = `${finalInputText}\n\n---\n`;
      }
    } else if (!finalInputText.includes('---') && slides && slides.length > 1) {
      finalInputText = finalInputText.split(/\n\n+/).filter((p: string) => p.trim()).join('\n\n---\n\n');
    }

    // 🚨 V8: 使用Key池智能选择（替代单一环境变量）
    const selectedKey = await selectBestKey();
    const apiKey = selectedKey.key;
    console.log('[Gamma] 使用Key:', selectedKey.label, '| 余额:', selectedKey.remaining);

    const sceneConfig = SCENE_CONFIGS[scene] || SCENE_CONFIGS.biz;
    // 🚨 V10.14: 使用主题映射转换themeId
    const rawThemeId = themeId || sceneConfig.themeId;
    let finalThemeId = getGammaThemeId(rawThemeId);
    if (finalThemeId !== rawThemeId && rawThemeId !== sceneConfig.themeId) {
      console.warn(`[Gamma] ThemeId mapped: "${rawThemeId}" → "${finalThemeId}"`);
    }
    const finalTone = normalized.tone || tone || sceneConfig.tone;
    const explicitThemeRequested = Boolean(
      intentHints
      && typeof intentHints === 'object'
      && (intentHints as Record<string, unknown>).themeLocked
    );
    const explicitThemeLabel =
      intentHints && typeof intentHints === 'object'
        ? String((intentHints as Record<string, unknown>).themeLabel || '')
        : '';
    const lockedThemeId = resolveLockedThemeFromIntent(intentHints, finalThemeId);
    if (lockedThemeId !== finalThemeId) {
      console.warn(`[Gamma] INTENT_THEME_LOCK override "${finalThemeId}" -> "${lockedThemeId}" (${explicitThemeLabel || 'locked'})`);
      finalThemeId = lockedThemeId;
    }

    // 🚨 P0 Fix: 统一使用 mapImageSource 处理 imageOptions
    // 如果已传入完整的 imageOptions(省心模式)直接使用；否则从 imageMode 映射
    const finalImageOptions = buildGammaImageOptions(
      normalized.imageSource || imageMode,
      finalThemeId,
      imageOptions && typeof imageOptions === 'object'
        ? (imageOptions as Record<string, unknown>)
        : undefined
    );
    const instructions = INSTRUCTION_TEMPLATES[finalTone] || INSTRUCTION_TEMPLATES.professional;
    // P0修复：追加全局视觉隐喻（如果提供）
    const metaphorAppend = visualMetaphor
      ? `\n\n【全局视觉隐喻】\n贯穿全演示的统一意象：${visualMetaphor}。\n所有配图、图标、色块风格应与此意象一致，配图描述中必须体现该意象关键词。`
      : '';    
    // 如果已传入 additionalInstructions（省心模式），直接使用；否则生成
    const finalInstructions = normalizePptxSafeInstructions(additionalInstructions || (instructions + metaphorAppend));

    // 🚨 V8.2: Gamma 固定使用 preserve 模式（大纲已由 outline API 预处理）
    // 构建最终 additionalInstructions
    let finalAdditionalInstructions = finalInstructions
      + buildUploadedFilesInstruction(uploadedFiles);
    if (explicitThemeRequested) {
      finalAdditionalInstructions += `\n\n【用户显式主题要求-最高优先级】\n用户已明确指定主题风格/主题色为“${explicitThemeLabel || finalThemeId}”。整套PPT必须围绕该主题色展开：标题、强调色、图标、分隔线、配图氛围必须一致。禁止回退成白色极简、商务蓝默认风或其它无关主题。`;
    }
    const isNoImageMode = finalImageOptions?.source === 'noImages';
    const isThemeAccentMode = finalImageOptions?.source === 'themeAccent';
    const imagePolicy = buildSmartImagePolicy(finalImageOptions?.source);
    const keyPageImageRule = isNoImageMode
      ? '封面页、目录页、章节过渡页、结束页：保持无图，仅使用标题、图标、色块和留白完成强调布局。'
      : imagePolicy.keyPageMustHaveImage
      ? '封面页、目录页、章节过渡页、结束页：只有在图片已成功加载且可见时才使用图片。'
      : '封面页、目录页、章节过渡页、结束页：可用图则用图；图片不可用时必须改为无图文本布局，禁止空白图片容器。';
    const contentImageRule = isNoImageMode
      ? '内容页默认无图，仅使用图标、色块、时间轴、卡片、数字看板等无图布局。'
      : imagePolicy.contentMustHaveImage
      ? '内容页必须有可见图片主体（非纯图标），按“每页至少1个主视觉”执行，禁止纯文字白板。'
      : '内容页不强制每页配图；若配图失败，必须删除图片容器并改用图标+色块排版，禁止灰色占位框。';
    finalAdditionalInstructions += `\n\n【图片策略-强制】\n1. ${keyPageImageRule}${imagePolicy.keyPageHint}。\n2. ${contentImageRule}\n3. ${imagePolicy.contentPageHint}。\n4. 首页、目录页、章节过渡页、结束页允许使用强调布局主图；内容页默认不做强调大图布局，如需配图优先使用插入式图片，否则直接无图。\n5. 当来源为 pexels/ai 时，内容页一旦配图必须使用对应来源，不得偷偷替换为其它来源。\n6. 不要为了满足配图数量而创建空图片槽；宁可减少图片，也不得出现灰框、破图、加载失败图标或空白占位。\n7. 任何页面都禁止图片占位符、灰框占位、浏览器缺图图标、小山图标、文件破损图标；如果图片不可见，必须删除整个图片元素和其外层容器。\n8. 如果无法保证图片真实显示，请使用全文字、图标、色块、时间轴、卡片、数字看板等无图布局完成页面，不要保留图片区域。\n9. ${buildContentImageGuidance({ source: finalImageOptions?.source, tone: finalTone, scene, inputText: finalInputText })}`;
    if (normalized.textMode === 'preserve') {
      // 🚨 V6修复：追加CRITICAL强制指令，封锁Gamma的发散权限
      finalAdditionalInstructions += '\n\n【省心定制-强化规则】\n严格保持原文结构,每页内容不超过3-4个要点,用---分页的位置必须保留,不要自动合并或拆分页面。\n\n【CRITICAL - 强制排版引擎模式】\n你是一个排版渲染引擎（layout engine ONLY）。禁止创作、扩写或修改任何事实信息。严格按照提供的Markdown层级和\'---\'分割线生成卡片。禁止自动合并或拆分页面。全局正文强制使用大文本（### 或 **粗体**），禁止普通小字。保持所有 \'>\' 作为演讲者备注不做展示。';
      if (isThemeAccentMode && imagePolicy.allowThemeAccentOnKeyPages) {
      finalAdditionalInstructions += '\n\n【主题套图策略】\n严格使用 themeAccent，不得切换为 Pexels、AI 图或其它图片源。主题强调图仅可作为已经真实加载成功的背景装饰或插图；禁止使用 Emphasize 大图模板、固定图片槽、空白图片框和图片占位符。若主题图不可用，必须删除整个图片元素及容器，改用完整的文字、图标、色块布局。';
      }
      if (Boolean(strictPreserve)) {
        finalAdditionalInstructions += '\n\n【严格保真开关】\n禁止改写或重命名标题；禁止添加“续页”后缀；禁止在正文中注入填充提示语或额外说明。';
        if (isSmartFlow) {
    finalAdditionalInstructions += '\n【省心模式保真补充】\n在不改写正文的前提下，优先执行图片策略；若图片不可用，可退回为纯文字+图标+色块的完整布局，但绝不允许空图片容器、灰框或丢图图标。';
        } else {
          finalAdditionalInstructions += '\n【专业模式保真补充】\n保留Markdown结构即可，可按图片策略补图，但不要改变正文事实。';
        }
      }
    } else if (isThemeAccentMode) {
      finalAdditionalInstructions += '\n\n【主题套图策略】\n严格使用 themeAccent，不得切换为 Pexels、AI 图或其它图片源。主题强调图仅可作为已经真实加载成功的背景装饰或插图；禁止使用 Emphasize 大图模板、固定图片槽、空白图片框和图片占位符。若主题图不可用，必须删除整个图片元素及容器，改用完整的文字、图标、色块布局。';
    } else {
      finalAdditionalInstructions += '\n\n【Pexels/AI 关键页策略】\n封面、目录页、过渡页、结束页优先使用当前所选图片来源作为主图；若取图或生成失败，直接删除图片容器并改用文字+图标+色块完成页面，不允许回退成 themeAccent，更不允许出现缺图图标、灰框或空白图片位。内容页默认使用插入式图片或无图，不做强调大图占位。';
    }

    // 🚨 P0 Fix: 使用解构排除 slides，不使用 delete 语句
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { slides: _slides, ..._rest } = body as Record<string, unknown>;

    const gammaPayload: Record<string, unknown> = {
      inputText: finalInputText,
      textMode: 'preserve', // 固定值！Gamma只负责排版渲染
      format,
      exportAs,
      themeId: finalThemeId,
      additionalInstructions: finalAdditionalInstructions,
      cardSplit: cardSplit || 'inputTextBreaks',
      textOptions: textOptions || {
        amount: 'medium',
        tone: finalTone,
        language: 'zh-cn',
      },
      imageOptions: finalImageOptions,
      cardOptions: cardOptions || {
        dimensions: '16x9',
      },
      sharingOptions: {
        externalAccess: 'view',
      },
      numCards: pageCount,
    };

    // 🔍 DEBUG: log key fields
    console.log('[Gamma] textMode: preserve (fixed) | imageOptions:', JSON.stringify(finalImageOptions), '| imageMode:', imageMode);
    console.log('[Gamma] FULL PAYLOAD:', JSON.stringify(gammaPayload).substring(0, 2000));

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
      console.error('[Gamma] API error:', gammaResponse.status, errText);
      // 记录Key失败
      await recordKeyFailure(apiKey);
      return NextResponse.json(
        { error: `生成服务调用失败: ${gammaResponse.status}`, detail: errText.substring(0, 500) },
        { status: 502 }
      );
    }

    const gammaData = await gammaResponse.json();
    const generationId = gammaData.generationId || gammaData.id;

    // 🚨 V8: 记录积分信息（如果有返回）
    if (gammaData.credits) {
      await updateKeyBalance(apiKey, gammaData.credits.deducted, gammaData.credits.remaining);
      console.log('[Gamma] 积分扣除:', gammaData.credits.deducted, '| 剩余:', gammaData.credits.remaining);
    }

    // 🚨 D3: Artifact contract — 规范化返回结构，包含 taskId + artifact + gamma meta
    return NextResponse.json({
      generationId,
      taskId: generationId,
      status: 'success',
      message: '生成任务已创建',
      artifact: {
        pollingUrl: `/api/gamma?id=${generationId}`,
        gammaUrl: null, // 等轮询完成后才有
      },
      gamma: {
        mode: 'smart',
        contentStrategy: normalized.contentStrategy || 'auto',
        pageCount,
        themeId: finalThemeId,
      },
      config: { themeId: finalThemeId, tone: finalTone, imageMode: finalImageOptions?.source || imageMode, pageCount },
      credits: gammaData.credits, // 返回积分信息供前端使用
    });
  } catch (error: any) {
    console.error('Gamma generation error:', error);
    return NextResponse.json(
      { error: error.message || '创建生成任务失败' },
      { status: 500 }
    );
  }
}

// GET: 查询 Gamma 生成状态(前端轮询)
export async function GET(request: NextRequest) {
  // 🚨 D3 Fix Q6: 添加 rateLimit 保护（与 POST 一致）
  const ip = getClientIP(request);
  if (isIPBlocked(ip)) {
    return NextResponse.json({ error: '请求受限' }, { status: 403 });
  }
  // 状态查询与创建任务分开限流：轮询阶段允许更高频率，避免误伤前端进度查询
  const { allowed } = rateLimit(`gamma_get:${ip}`, { windowMs: 60 * 1000, maxRequests: 80 });
  if (!allowed) {
    return NextResponse.json({ error: '查询过于频繁,请稍后再试' }, { status: 429 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const generationId = searchParams.get('id');

    if (!generationId) {
      return NextResponse.json({ error: '缺少 generationId' }, { status: 400 });
    }

    // GET查询按 key 池重试，避免单 key 限流导致“已生成但状态丢失”
    const first = await selectBestKey();
    const orderedKeys = [first, ...(await getAllKeys()).filter((k) => k.key !== first.key)];
    const maxAttempts = Math.min(4, orderedKeys.length);
    let lastStatus = 502;
    let lastErrorText = '查询失败';

    for (let i = 0; i < maxAttempts; i++) {
      const current = orderedKeys[i];
      const response = await fetch(`${GAMMA_API_BASE}/generations/${generationId}`, {
        headers: {
          'X-API-KEY': current.key,
          'User-Agent': GAMMA_UA,
        },
      });

      if (!response.ok) {
        lastStatus = response.status;
        await response.text().catch(() => '');
        lastErrorText = `查询失败: ${response.status}`;
        // 仅在显式限流/鉴权失败时记失败并切换下一个 key
        if (response.status === 429 || response.status === 401 || response.status === 403 || response.status >= 500) {
          await recordKeyFailure(current.key);
          continue;
        }
        return NextResponse.json({ error: lastErrorText }, { status: 502 });
      }

      const data = await response.json();
      if (data.status === 'completed' && data.credits) {
        await updateKeyBalance(current.key, data.credits.deducted, data.credits.remaining);
      }
      return NextResponse.json(data);
    }

    return NextResponse.json({ error: `${lastErrorText}（已重试${maxAttempts}个Key）`, status: lastStatus }, { status: 502 });
  } catch (error: any) {
    console.error('Gamma status error:', error);
    return NextResponse.json({ error: error.message || '查询失败' }, { status: 500 });
  }
}
