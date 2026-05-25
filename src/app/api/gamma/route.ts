import { NextRequest, NextResponse } from 'next/server';
import { rateLimit, getRateLimitConfig, getClientIP, isIPBlocked } from '@/lib/rate-limit';
import { selectBestKey, updateKeyBalance, recordKeyFailure, getAllKeys } from '@/lib/gamma-key-pool';
import { getGammaThemeId } from '@/lib/gamma-theme-mapping';
import { buildGammaImageOptions, normalizeUserInput } from '@/lib/adapters/ppt-param-adapter';

const GAMMA_API_BASE = 'https://public-api.gamma.app/v1.0';
const GAMMA_UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

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

【配图规则】(主题套图=themeAccent主题强调图,精选网图=webFreeToUseCommercially)
- 主题套图:使用Pexels高质量照片(专业摄影师,0 credits)
- 精选网图:使用webFreeToUseCommercially(免版权商用图搜索)
- 封面页和结尾页必须配高质量照片/网图
- 内容页每页至少配1张相关图片,确保图文结合
- 图片风格(必须包含):Minimalist, clean background, negative space, professional, high quality
- 配图位置:右图或上图,禁止左图布局
- 如文字内容少于40字/页,必须额外增加配图数量

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
- 严格遵循 imageOptions.source（themeAccent / webFreeToUseCommercially / aiGenerated）
- 禁止与用户选择冲突：用户选网图/AI图时，不可改回纯文字页
- 封面页、目录页、过渡页、结束页必须含图（至少主题强调图）

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
- 严格遵循 imageOptions.source（themeAccent / webFreeToUseCommercially / aiGenerated）
- 只有当 source=aiGenerated 时才使用 AI 生成图；source=web 时必须用网图
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
- 严格遵循 imageOptions.source（themeAccent / webFreeToUseCommercially / aiGenerated）
- 只有当 source=aiGenerated 时才使用 AI 生成图；source=web 时必须用网图
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
- 严格遵循 imageOptions.source（themeAccent / webFreeToUseCommercially / aiGenerated）
- source=aiGenerated 时使用国风 AI 图；source=web 时使用国风网图；source=themeAccent 使用主题强调图
- 配图风格:Chinese traditional, elegant, minimalist, negative space

【语言规则】
- 所有文字使用简体中文
- 保持演讲者备注(通过 > 引用块)`,
};

function buildSmartImagePolicy(source: unknown): {
  keyPageHint: string;
  contentPageHint: string;
} {
  const normalized = String(source || '').trim();
  if (normalized === 'aiGenerated') {
    return {
      keyPageHint: '结构页优先使用主题强调图（themeAccent）形成统一视觉锚点',
      contentPageHint: '内容页默认使用 AI 图（aiGenerated）；仅在生成失败时回退为 themeAccent',
    };
  }
  if (normalized === 'webFreeToUseCommercially') {
    return {
      keyPageHint: '结构页优先使用主题强调图（themeAccent）形成统一视觉锚点',
      contentPageHint: '内容页默认使用网图（webFreeToUseCommercially）；仅在检索失败时回退为 themeAccent',
    };
  }
  return {
    keyPageHint: '结构页使用主题强调图（themeAccent / Emphasize布局）',
    contentPageHint: '内容页需按主题语义补足可见主图，必要时可使用 web/ai 获取更贴题图片，失败时回退 themeAccent',
  };
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
    } = body;

    // 🚨 D1: Normalize aliased fields → canonical PptUserInput
    const normalized = normalizeUserInput(body as Record<string, unknown>);
    const pageCount = normalized.pageCount ?? 8;
    const isSmartFlow = Boolean(auto) || normalized.auto === true;

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
    const selectedKey = selectBestKey();
    const apiKey = selectedKey.key;
    console.log('[Gamma] 使用Key:', selectedKey.label, '| 余额:', selectedKey.remaining);

    const sceneConfig = SCENE_CONFIGS[scene] || SCENE_CONFIGS.biz;
    // 🚨 V10.14: 使用主题映射转换themeId
    const rawThemeId = themeId || sceneConfig.themeId;
    const finalThemeId = getGammaThemeId(rawThemeId);
    if (finalThemeId !== rawThemeId && rawThemeId !== sceneConfig.themeId) {
      console.warn(`[Gamma] ThemeId mapped: "${rawThemeId}" → "${finalThemeId}"`);
    }
    const finalTone = normalized.tone || tone || sceneConfig.tone;

    // 🚨 P0 Fix: 统一使用 mapImageSource 处理 imageOptions
    // 如果已传入完整的 imageOptions(省心模式)直接使用；否则从 imageMode 映射
    const finalImageOptions = buildGammaImageOptions(
      normalized.imageSource || imageMode,
      finalThemeId,
      imageOptions && typeof imageOptions === 'object'
        ? (imageOptions as Record<string, unknown>)
        : undefined
    );
    if (finalImageOptions?.source === 'noImages') {
      finalImageOptions.source = 'themeAccent';
    }

    const instructions = INSTRUCTION_TEMPLATES[finalTone] || INSTRUCTION_TEMPLATES.professional;
    // P0修复：追加全局视觉隐喻（如果提供）
    const metaphorAppend = visualMetaphor
      ? `\n\n【全局视觉隐喻】\n贯穿全演示的统一意象：${visualMetaphor}。\n所有配图、图标、色块风格应与此意象一致，配图描述中必须体现该意象关键词。`
      : '';    
    // 如果已传入 additionalInstructions（省心模式），直接使用；否则生成
    const finalInstructions = additionalInstructions || (instructions + metaphorAppend);

    // 🚨 V8.2: Gamma 固定使用 preserve 模式（大纲已由 outline API 预处理）
    // 构建最终 additionalInstructions
    let finalAdditionalInstructions = finalInstructions
      + buildUploadedFilesInstruction(uploadedFiles)
      + '\n\n【图标规范-统一风格】\n使用Gamma内置的图标系统(Icons),保持风格统一:简洁、线性、单色、与主题色一致。禁止混用不同风格的图标(不要同时使用emoji和线性图标)。每页2-4个图标,用于要点标记和视觉装饰。禁止出现无图标的页面。';
    const isThemeAccentMode = finalImageOptions?.source === 'themeAccent';
    const imagePolicy = buildSmartImagePolicy(finalImageOptions?.source);
    finalAdditionalInstructions += `\n\n【图片策略-强制】\n1. 封面页、目录页、章节过渡页、结束页：必须配图，${imagePolicy.keyPageHint}。\n2. 内容页必须有可见图片主体（非纯图标），按“每页至少1个主视觉”执行，禁止纯文字白板。\n3. ${imagePolicy.contentPageHint}。\n4. 当来源为 web/ai 时，内容页一旦配图必须使用对应来源，不得偷偷替换为其它来源。\n5. 当来源为 web/ai 时，内容页中至少 70% 页面使用该来源配图（仅文字极密页可例外）。\n6. 任何页面都禁止空图片占位、灰框占位或无图输出；若失败必须即时回退 themeAccent 保证有图。`;
    if (normalized.textMode === 'preserve') {
      // 🚨 V6修复：追加CRITICAL强制指令，封锁Gamma的发散权限
      finalAdditionalInstructions += '\n\n【省心定制-强化规则】\n严格保持原文结构,每页内容不超过3-4个要点,用---分页的位置必须保留,不要自动合并或拆分页面。\n\n【CRITICAL - 强制排版引擎模式】\n你是一个排版渲染引擎（layout engine ONLY）。禁止创作、扩写或修改任何事实信息。严格按照提供的Markdown层级和\'---\'分割线生成卡片。禁止自动合并或拆分页面。全局正文强制使用大文本（### 或 **粗体**），禁止普通小字。保持所有 \'>\' 作为演讲者备注不做展示。';
      if (isThemeAccentMode) {
        finalAdditionalInstructions += '\n\n【主题套图策略】\n首页、目录页、过渡页、结束页必须使用主题强调图；内容页默认图标+色块，只有内容稀疏时再加图。禁止输出无图页面。';
      }
      if (Boolean(strictPreserve)) {
        finalAdditionalInstructions += '\n\n【严格保真开关】\n禁止改写或重命名标题；禁止添加“续页”后缀；禁止在正文中注入填充提示语或额外说明。';
        if (isSmartFlow) {
          finalAdditionalInstructions += '\n【省心模式保真补充】\n在不改写正文的前提下，必须执行图片策略：为结构页和关键页补足可见配图，禁止输出纯文字大白板。';
        } else {
          finalAdditionalInstructions += '\n【专业模式保真补充】\n保留Markdown结构即可，可按图片策略补图，但不要改变正文事实。';
        }
      }
    } else if (isThemeAccentMode) {
      finalAdditionalInstructions += '\n\n【主题套图策略】\n首页、目录页、过渡页、结束页必须使用主题强调图；内容页按留白情况择优补图，不强制每页都上图，但禁止无图页面。';
    } else {
      finalAdditionalInstructions += '\n\n【网图/AI图关键页策略】\n首屏封面必须有可见主图，不允许纯文字封面；若本次图片源检索或生成失败，必须回退为主题强调图(themeAccent)保证封面有图。';
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
      recordKeyFailure(apiKey);
      return NextResponse.json(
        { error: `生成服务调用失败: ${gammaResponse.status}`, detail: errText.substring(0, 500) },
        { status: 502 }
      );
    }

    const gammaData = await gammaResponse.json();
    const generationId = gammaData.generationId || gammaData.id;

    // 🚨 V8: 记录积分信息（如果有返回）
    if (gammaData.credits) {
      updateKeyBalance(apiKey, gammaData.credits.deducted, gammaData.credits.remaining);
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
    const first = selectBestKey();
    const orderedKeys = [first, ...getAllKeys().filter((k) => k.key !== first.key)];
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
          recordKeyFailure(current.key);
          continue;
        }
        return NextResponse.json({ error: lastErrorText }, { status: 502 });
      }

      const data = await response.json();
      if (data.status === 'completed' && data.credits) {
        updateKeyBalance(current.key, data.credits.deducted, data.credits.remaining);
      }
      return NextResponse.json(data);
    }

    return NextResponse.json({ error: `${lastErrorText}（已重试${maxAttempts}个Key）`, status: lastStatus }, { status: 502 });
  } catch (error: any) {
    console.error('Gamma status error:', error);
    return NextResponse.json({ error: error.message || '查询失败' }, { status: 500 });
  }
}
