import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { createClient } from '@supabase/supabase-js';
import { rateLimit, getRateLimitConfig, getClientIP, isIPBlocked } from '@/lib/rate-limit';
import { selectBestKey, updateKeyBalance, recordKeyFailure } from '@/lib/gamma-key-pool';
import { getGammaThemeId } from '@/lib/gamma-theme-mapping';
import { buildGammaImageOptions, normalizeUserInput } from '@/lib/adapters/ppt-param-adapter';
import { checkPermission } from '@/lib/membership';
import { estimateGenerationCredits } from '@/lib/generation-credits';

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
    .replace(/【图标规范-统一风格】[\s\S]*?(?=\n\n【|$)/g, '')
    .replace(/【PPTX兼容性-图标规范】[\s\S]*?(?=\n\n【|$)/g, '');
  return `${withoutFragileIconBlocks.trim()}\n\n${PPTX_SAFE_ICON_RULES}`;
}

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key);
}

async function resolveAuthUser(req: NextRequest) {
  const session = await getSession();
  if (session?.isLoggedIn && session?.user?.id) {
    return session.user;
  }

  const auth = req.headers.get('authorization') || '';
  const match = auth.match(/^Bearer\s+(.+)$/i);
  const hintedUserId = match?.[1]?.trim() || req.headers.get('x-user-id') || '';
  if (!hintedUserId) return null;

  const sb = getSupabase();
  if (!sb) return null;
  const { data: user } = await sb
    .from('users')
    .select('id,phone,nickname,avatar,credits,plan_type')
    .eq('id', hintedUserId)
    .single();
  return user || null;
}

function buildUploadedFilesInstruction(uploadedFiles: unknown): string {
  if (!Array.isArray(uploadedFiles) || uploadedFiles.length === 0) return '';

  const fileLines = uploadedFiles
    .slice(0, 10)
    .map((file: unknown) => {
      const record = file && typeof file === 'object'
        ? file as Record<string, unknown>
        : {};
      const size = typeof record.size === 'number'
        ? `${(record.size / 1024 / 1024).toFixed(2)}MB`
        : '未知大小';
      const passthrough = record.passthrough ? '，未做站内文字提取' : '';
      return `- ${String(record.name || '未命名附件')} (${String(record.type || 'application/octet-stream')}, ${size}${passthrough})`;
    })
    .join('\n');

  return `\n\n【用户上传附件】\n${fileLines}\n这些附件是用户提供的生成素材。若当前 inputText 中没有附件正文，请不要编造附件中的具体事实；只根据用户需求、已提取文本和附件元信息生成。`;
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
- 主题套图:使用 themeAccent 主题强调图
- Pexels 图库:使用 pexels 高质量图库照片(稳定优先,0 credits)
- 封面页和结尾页优先配图,若图片不可用必须删除图片容器并改为图标/色块/大字布局
- 内容页按信息密度决定是否配图,若图片不可用必须删除图片容器,不得保留空框、灰框或丢图图标
- 照片风格(必须包含):Minimalist, clean background, negative space, professional, high quality
- 配图位置:右图或上图,禁止左图布局
- 如文字内容少于40字/页,优先使用图标、色块与留白增强,不要为了凑图而保留空图片容器

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
- 严格遵循 imageOptions.source（themeAccent / pexels / aiGenerated / noImages）
- 用户选网图/AI图时，如对应来源失败，允许改为纯文字+图标+色块布局，但绝不允许切换成其它图片源
- 封面页、目录页、过渡页、结束页优先含图；若取图失败，必须删除图片容器并改用无图布局
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
- 严格遵循 imageOptions.source（themeAccent / pexels / aiGenerated / noImages）
- 只有当 source=aiGenerated 时才使用 AI 生成图；source=pexels 时必须用 Pexels 图
- 配图风格:creative, vibrant, modern, bold colors, minimalist, negative space

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
- 严格遵循 imageOptions.source（themeAccent / pexels / aiGenerated / noImages）
- 只有当 source=aiGenerated 时才使用 AI 生成图；source=pexels 时必须用 Pexels 图
- 配图风格:futuristic, technology, modern, sleek, minimalist, negative space

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
- 严格遵循 imageOptions.source（themeAccent / pexels / aiGenerated / noImages）
- source=aiGenerated 时使用国风 AI 图；source=pexels 时使用国风 Pexels 图；source=themeAccent 使用主题强调图；source=noImages 时全程无图
- 配图风格:Chinese traditional, ink wash, classical Chinese art, elegant, minimalist, negative space

【语言规则】
- 所有文字使用简体中文
- 保持演讲者备注(通过 > 引用块)`,
};

// POST: 专业模式 - 调用 Gamma API 创建生成任务
export async function POST(request: NextRequest) {
  // ===== Layer 1: Auth Guard（session + header fallback） =====
  const authedUser = await resolveAuthUser(request);
  if (!authedUser?.id) {
    console.log('[GammaDirect] AUTH_FAILED: not logged in');
    return NextResponse.json({ error: '请先登录', code: 'UNAUTHENTICATED' }, { status: 401 });
  }
  const userId = authedUser.id;
  const userCredits = authedUser.credits || 0;
  const userPlanType = authedUser.plan_type || 'free';
  console.log(`[GammaDirect] AUTH_OK userId=${userId} credits=${userCredits} plan=${userPlanType}`);

  // ===== Layer 2: IP Rate Limit =====
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
      tone = 'professional',
      imageSource = 'themeAccent',
      exportAs = 'pptx',
      visualMetaphor,
      strictPreserve = false,
      uploadedFiles,
    } = body;

    // 🚨 D1: Normalize aliased fields → canonical PptUserInput
    const normalized = normalizeUserInput(body as Record<string, unknown>);
    const pageCount = normalized.pageCount ?? 8;
    const requestedImageSource = normalized.imageSource || imageSource;
    const finalTone = normalized.tone || tone || 'professional';

    // Unified type narrowing: normalized.aiModel typed as unknown from Record cast
    // Only use non-empty strings; filter empty/whitespace strings to undefined
    let aiModel: string | undefined =
      typeof normalized.aiModel === 'string' && normalized.aiModel.trim().length > 0
        ? normalized.aiModel.trim()
        : undefined;
    if (!aiModel && String(requestedImageSource).toLowerCase().trim() === 'ai-pro') {
      aiModel = 'imagen-3-pro';
    }

    // ===== Layer 3: Input Validation =====
    const normalizedInputText = typeof normalized.inputText === 'string' ? normalized.inputText : '';
    const requestInputText = typeof inputText === 'string' ? inputText : '';
    const uploadedFileNames = Array.isArray(uploadedFiles)
      ? uploadedFiles
        .map((file: unknown) => (
          file && typeof file === 'object'
            ? String((file as Record<string, unknown>).name || '').trim()
            : ''
        ))
        .filter(Boolean)
      : [];
    const effectiveInputText = requestInputText || normalizedInputText || (
      uploadedFileNames.length > 0
        ? `请基于以下附件生成中文PPT：${uploadedFileNames.join('、')}`
        : ''
    );

    if (!effectiveInputText.trim()) {
      return NextResponse.json({ error: '请输入内容' }, { status: 400 });
    }
    if (pageCount < 1 || pageCount > 100) {
      return NextResponse.json({ error: '页数必须在1-100之间' }, { status: 400 });
    }

    // 🚨 V10.50: 先规范化 theme/image，再做权限与积分校验，避免 theme-img 等前端值被误判。
    const rawThemeId = themeId || normalized.themeId || SCENE_CONFIGS.biz.themeId;
    const finalThemeId = getGammaThemeId(rawThemeId);
    if (finalThemeId !== rawThemeId) {
      console.warn(`[Gamma Direct] ThemeId mapped: "${rawThemeId}" → "${finalThemeId}"`);
    }

    const imageOptions = buildGammaImageOptions(requestedImageSource, finalThemeId);
    const finalImageSource = String(imageOptions.source || 'themeAccent');

    // ===== Layer 4: Membership/Permission Check =====
    const permissionCheck = checkPermission(userPlanType, {
      numPages: pageCount,
      imageSource: finalImageSource,
      aiModel: aiModel,
    });
    if (!permissionCheck.allowed) {
      console.log(`[GammaDirect] QUOTA_DENIED userId=${userId} reason=${permissionCheck.reason}`);
      return NextResponse.json({
        error: permissionCheck.reason,
        code: 'QUOTA_EXCEEDED',
        requiredPlan: permissionCheck.requiredPlan,
      }, { status: 403 });
    }
    console.log(`[GammaDirect] QUOTA_OK required=${pageCount} pages imageSource=${finalImageSource}`);

    // ===== Layer 5: Credit Budget Check (before Gamma call) =====
    const creditEstimate = estimateGenerationCredits({
      numPages: pageCount,
      imageSource: finalImageSource,
      imageModel: aiModel,
    });
    if (userCredits < creditEstimate.totalCredits) {
      console.log(`[GammaDirect] CREDIT_INSUFFICIENT userId=${userId} needed=${creditEstimate.totalCredits} balance=${userCredits}`);
      return NextResponse.json({
        error: '积分不足',
        code: 'INSUFFICIENT_CREDITS',
        needed: creditEstimate.totalCredits,
        balance: userCredits,
      }, { status: 402 });
    }
    console.log(`[GammaDirect] CREDIT_CHECK_OK userId=${userId} required=${creditEstimate.totalCredits} balance=${userCredits}`);

    // ===== Layer 6: Gamma API Call (existing code unchanged) =====

    // 🚨 V8: 使用Key池智能选择
    const selectedKey = selectBestKey();
    const apiKey = selectedKey.key;
    console.log('[Gamma Direct] 使用Key:', selectedKey.label, '| 余额:', selectedKey.remaining);

    // 构建最终文本
    let finalInputText = effectiveInputText.trim();
    if (finalInputText.length < 100) {
      finalInputText = `# ${finalInputText}\n\n---\n`;
    } else if (!finalInputText.includes('---')) {
      finalInputText = finalInputText.split(/\n\n+/).filter((p: string) => p.trim()).join('\n\n---\n\n');
    }

    const instructions = INSTRUCTION_TEMPLATES[finalTone] || INSTRUCTION_TEMPLATES.professional;
    // 追加全局视觉隐喻
    const metaphorAppend = visualMetaphor
      ? `\n\n【全局视觉隐喻】\n贯穿全演示的统一意象:${visualMetaphor}。\n所有配图、图标、色块风格应与此意象一致,配图描述中必须体现该意象关键词。`
      : '';
    // 免费套图:追加强调布局图指令
    const themeAppend = (finalImageSource === 'themeAccent')
      ? `\n\n【主题套图策略】\n严格使用 themeAccent，不得切换为 Pexels、AI 图或其它图片源。主题强调图仅可作为已经真实加载成功的背景装饰或插图；禁止使用 Emphasize 大图模板、固定图片槽、空白图片框和图片占位符。若主题图不可用，必须删除整个图片元素及容器，改用完整的文字、图标、色块布局。`
      : '';
    const keyPageSourceHint =
      finalImageSource === 'pexels'
        ? '优先使用 Pexels 图（pexels）'
        : finalImageSource === 'aiGenerated'
          ? '优先使用 AI 图（aiGenerated）'
          : finalImageSource === 'noImages'
            ? '保持极简无图'
            : '使用主题强调图（themeAccent / Emphasize布局）';
    const imageStrategy = finalImageSource === 'noImages'
      ? `\n\n【图片策略-强制】\n封面页、目录页、章节过渡页、结束页保持无图，仅用标题、图标、色块和留白完成强调布局。内容页默认无图，仅使用卡片、图标、色块、时间轴等无图布局。不允许创建任何图片元素、图片容器、灰框或空占位。`
      : `\n\n【图片策略-强制】\n封面页、目录页、章节过渡页、结束页可用图则用图，${keyPageSourceHint}；若图片不可见，必须删除图片元素和图片容器，改用图标、色块和大字排版完成页面。内容页默认不使用强调大图布局，仅在图片真实可见时保留插入式图片，否则直接无图。若用户选择了 Pexels/AI 图，则内容页一旦配图必须使用对应来源（pexels 或 aiGenerated），不得替换为 themeAccent。若 pexels/ai 配图失败，必须直接删除图片容器，不允许自动回退 themeAccent，不允许输出空图片占位、灰框、浏览器缺图图标或丢图图标。`;
    const finalInstructions = normalizePptxSafeInstructions(instructions + metaphorAppend + themeAppend + imageStrategy);

    // 🚨 V8.2：Gamma 固定使用 preserve 模式
    // 专业模式的 inputText 已经是前端处理好的 markdown
    // （可能来自 buildPreserveMarkdown 或用户手动输入的结构化内容）
    // Gamma 只负责排版渲染，不做内容扩充/缩减
    //
    // textMode 语义说明：
    //   - generate: AI 扩写（我们的架构中由 outline API 处理）
    //   - condense: AI 精简（我们的架构中由 outline API 处理）
    //   - preserve: 保持原文（我们的架构中用于专业模式和确认后生成）
    // 由于 outline API 已经在预处理阶段根据 textMode 生成不同风格的大纲，
    // Gamma 在我们的架构中只承担排版渲染职责，因此固定为 'preserve'
    const criticalInstruction = '\n\n【CRITICAL - 强制排版引擎模式】\n你是一个排版渲染引擎（layout engine ONLY）。禁止创作或修改任何事实信息。严格按照提供的Markdown层级和---分割线生成卡片。禁止自动合并或拆分页面。全局正文强制使用大文本（### 或 **粗体**），禁止普通小字。';
    const strictPreserveInstruction = Boolean(strictPreserve)
      ? '\n\n【严格保真开关】\n禁止改写或重命名标题；禁止添加“续页”后缀；禁止在正文中注入填充提示语或额外说明。\n【保真补充】\n在不改写正文前提下执行图片策略；图片只有在真实可见时才可保留。若图片不可用，必须删除图片元素和图片容器，使用完整的纯文字、图标、色块或大字布局，禁止空图片槽、灰框和缺图图标。'
      : '';

    // 步骤1:创建 Gamma 生成任务(恢复技术部验证的完整参数)
    // 🚨 D1: Use canonical pageCount (aliased from numCards) in Gamma payload
    const gammaPayload = {
      inputText: finalInputText,
      textMode: 'preserve', // 🚨 V8.2：固定使用 preserve
      format: 'presentation',
      numCards: pageCount,
      exportAs,
      themeId: finalThemeId,
      cardSplit: undefined, // removed inputTextBreaks to avoid blank pages
      additionalInstructions: finalInstructions + buildUploadedFilesInstruction(uploadedFiles) + criticalInstruction + strictPreserveInstruction,
      textOptions: { amount: 'medium', tone: finalTone, language: 'zh-cn' },
      imageOptions,
      cardOptions: { dimensions: '16x9' },
      sharingOptions: {
        externalAccess: 'view',
      },
    };

    console.log('[GammaDirect] Payload:', JSON.stringify(gammaPayload, null, 2));

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
      console.error('[GammaDirect] API error:', createRes.status, errText);
      recordKeyFailure(apiKey);
      console.log(`[GammaDirect] ERROR reason=gamma_api_failed code=GAMMA_API_ERROR status=${createRes.status}`);
      return NextResponse.json({
        error: `生成服务调用失败: ${createRes.status}`,
        detail: errText.substring(0, 500)
      }, { status: 502 });
    }

    const createData = await createRes.json();
    const generationId = createData.generationId || createData.id;

    // 🚨 V8: 记录积分信息（如果有返回）
    if (createData.credits) {
      updateKeyBalance(apiKey, createData.credits.deducted, createData.credits.remaining);
      console.log('[GammaDirect] 积分扣除:', createData.credits.deducted, '| 剩余:', createData.credits.remaining);
    }

    // 🚨 D3 Fix Q3: 补充 config 字段，与 gamma/route.ts 保持一致
    return NextResponse.json({
      generationId,
      taskId: generationId,
      status: 'pending', // 专业模式不等待完成
      message: '专业模式生成任务已创建',
      artifact: {
        pollingUrl: `/api/gamma?id=${generationId}`,
      },
      config: { themeId: finalThemeId, tone: finalTone, imageMode: finalImageSource, pageCount },
      credits: createData.credits,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : '生成失败';
    console.error('Gamma direct error:', error);
    console.log(`[GammaDirect] ERROR reason=${message} code=INTERNAL_ERROR status=500`);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
