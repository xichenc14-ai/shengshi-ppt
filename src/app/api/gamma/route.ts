import { NextRequest, NextResponse } from 'next/server';
import { rateLimit, getRateLimitConfig, getClientIP, isIPBlocked } from '@/lib/rate-limit';
import { selectBestKey, updateKeyBalance, recordKeyFailure, getKeyPoolStatus, convertCreditsToUserPoints } from '@/lib/gamma-key-pool';
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
- 不使用外部图片,纯文字+图标+色块设计
- 内容少的页面用装饰性元素和图标补充留白
- 可使用图标库(Font Awesome / Material Icons)

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
- 封面页使用AI生成配图
- 配图风格:creative, vibrant, modern, bold colors, minimalist, negative space
- 配图位置:右图或上图

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
- 封面页使用震撼的AI生成配图
- 配图风格:futuristic, technology, modern, sleek, minimalist, negative space
- 配图位置:右图或上图

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
- 封面页使用中国风配图
- 配图风格:Chinese traditional, ink wash, classical Chinese art, elegant, minimalist, negative space
- 配图位置:右图或上图

【语言规则】
- 所有文字使用简体中文
- 保持演讲者备注(通过 > 引用块)`,
};

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
      numCards = 8,
      exportAs = 'pptx',
      themeId,
      scene = 'biz',
      tone,
      imageMode = 'auto',
      slides,
      visualMetaphor,
      // 省心模式传的完整参数
      additionalInstructions,
      imageOptions,
      cardOptions,
      cardSplit,
      textOptions,
    } = body;

    // 🚨 V8.2 核心原则：Gamma API 固定使用 preserve 模式
    // 无论用户选什么模式（扩充/缩减/保持），Gamma 只接收 preserve
    // 因为大纲已经由 outline API 预处理好了，Gamma 只负责排版渲染
    const textMode = 'preserve';

    // 支持结构化 slides 数据或纯文本 inputText
    let finalInputText: string;
    if (inputText && inputText.trim()) {
      // 优先使用 inputText(已由前端 buildMdV2 处理过的高质量 markdown)
      finalInputText = inputText.trim();
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
    const finalTone = tone || sceneConfig.tone;

    // ===== 图片模式处理 =====
    // 如果已传入完整的 imageOptions(省心模式),直接使用
    // 否则根据 imageMode 字符串生成
    let finalImageOptions: Record<string, any>;
    if (imageOptions && typeof imageOptions === 'object' && imageOptions.source) {
      // 省心模式:直接使用传入的 imageOptions
      finalImageOptions = imageOptions;
    } else if (imageMode === 'none') {
      finalImageOptions = { source: 'noImages' };
    } else if (imageMode === 'theme-img' || imageMode === 'theme') {
      // 主题套图：根据主题深浅选择最佳图片源
      // 深色主题(founder/aurora/electric)下themeAccent常显示占位符，改用网图
      const darkThemes = new Set(['founder', 'aurora', 'electric', 'blues', 'gamma', 'luxe', 'aurum']);
      if (darkThemes.has(finalThemeId)) {
        finalImageOptions = { source: 'webFreeToUseCommercially' };
      } else {
        finalImageOptions = { source: 'themeAccent' };
      }
    } else if (imageMode === 'web') {
      finalImageOptions = { source: 'webFreeToUseCommercially' };
    } else if (imageMode === 'ai') {
      // AI定制图：普通AI模型
      finalImageOptions = { source: 'aiGenerated', model: 'imagen-3-flash', style: 'flat illustration, minimalist, clean background, negative space' };
    } else if (imageMode === 'ai-pro') {
      // AI尊享图：高质量模型(8 credits/图)
      finalImageOptions = { source: 'aiGenerated', model: 'imagen-3-pro', style: 'professional, high quality, cinematic, detailed' };
    } else {
      finalImageOptions = { source: 'themeAccent' }; // 主题套图，默认推荐
    }

    const instructions = INSTRUCTION_TEMPLATES[finalTone] || INSTRUCTION_TEMPLATES.professional;
    // P0修复：追加全局视觉隐喻（如果提供）
    const metaphorAppend = visualMetaphor
      ? `\n\n【全局视觉隐喻】\n贯穿全演示的统一意象：${visualMetaphor}。\n所有配图、图标、色块风格应与此意象一致，配图描述中必须体现该意象关键词。`
      : '';    
    // 如果已传入 additionalInstructions（省心模式），直接使用；否则生成
    const finalInstructions = additionalInstructions || (instructions + metaphorAppend);

    // 构建最终的 additionalInstructions（根据模式追加不同指令）
    let finalAdditionalInstructions = finalInstructions + '\n\n【图标规范-统一风格】\n使用Gamma内置的图标系统(Icons),保持风格统一:简洁、线性、单色、与主题色一致。禁止混用不同风格的图标(不要同时使用emoji和线性图标)。每页2-4个图标,用于要点标记和视觉装饰。禁止出现无图标的页面。';
    if (textMode === 'preserve') {
      // 🚨 V6修复：追加CRITICAL强制指令，封锁Gamma的发散权限
      finalAdditionalInstructions += '\n\n【省心定制-强化规则】\n严格保持原文结构,每页内容不超过3-4个要点,用---分页的位置必须保留,不要自动合并或拆分页面。\n\n【CRITICAL - 强制排版引擎模式】\n你是一个排版渲染引擎（layout engine ONLY）。禁止创作、扩写或修改任何事实信息。严格按照提供的Markdown层级和\'---\'分割线生成卡片。禁止自动合并或拆分页面。全局正文强制使用大文本（### 或 **粗体**），禁止普通小字。保持所有 \'>\' 作为演讲者备注不做展示。';
      if (imageMode === 'theme-img' || imageMode === 'theme') {
        finalAdditionalInstructions += '\n\n【视觉丰富度-强制规则】\n1. 每页必须使用Gamma内置的Emphasize卡片布局(主题强调布局图),每页不同的布局变体\n2. 每页必须有视觉元素(图片/插图/图标/装饰),禁止出现纯文字页\n3. 使用主题套图(themeAccent)作为配图来源,确保图片与内容主题匹配\n4. 封面页和结尾页必须使用大幅背景图/强调图\n5. 数据页使用卡片式布局展示指标,配合图标和色彩区分';
      }
    } else if (imageMode === 'theme-img' || imageMode === 'theme') {
      finalAdditionalInstructions += '\n\n【视觉丰富度-强制规则】\n1. 每页必须配图:使用Pexels高质量照片,风格professional/clean/minimalist\n2. 每页使用Gamma内置的Emphasize强调布局,每页不同的布局变体\n3. 封面页和结尾页必须使用大幅背景图\n4. 禁止出现纯文字页,每页必须有视觉元素';
    }

    // 🚨 V8.2：Gamma 固定使用 preserve 模式（大纲已由 outline API 预处理）
    // 无论用户选什么模式（扩充/缩减/保持），Gamma 只接收 preserve
    const gammaPayload: Record<string, any> = {
      inputText: finalInputText,
      textMode: 'preserve', // 固定值！Gamma只负责排版渲染
      format,
      numCards,
      exportAs,
      themeId: finalThemeId,
      additionalInstructions: finalAdditionalInstructions,
      // 🚨 V8.2：强制精确分页（preserve 模式必须）
      cardSplit: cardSplit || 'inputTextBreaks',
      // textOptions 在 preserve 模式下会被 Gamma 忽略（根据API警告）
      // 但仍保留以备将来 API 更新
      textOptions: textOptions || {
        amount: 'medium',
        tone: finalTone,
        language: 'zh-cn',
      },
      imageOptions: finalImageOptions,
      cardOptions: cardOptions || {
        dimensions: '16x9',
      },
      // 🚨 V8.6: 不传 slides 参数（Gamma API 不接受此参数，可能导致 400）
      // P0 Fix: 明确删除 slides 字段，确保不被发送到 Gamma
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
    }; delete (gammaPayload as any).slides;

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
        { error: `Gamma API 调用失败: ${gammaResponse.status}`, detail: errText.substring(0, 500) },
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

    return NextResponse.json({
      generationId,
      message: '生成任务已创建',
      config: { themeId: finalThemeId, tone: finalTone, imageMode: finalImageOptions?.source || imageMode, numCards },
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
  try {
    // GET查询可以使用任意key（generationId不依赖key）
    const selectedKey = selectBestKey();
    const apiKey = selectedKey.key;

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
    
    // 🚨 V8: 更新积分信息（completed状态时）
    if (data.status === 'completed' && data.credits) {
      updateKeyBalance(apiKey, data.credits.deducted, data.credits.remaining);
    }
    
    return NextResponse.json(data);
  } catch (error: any) {
    console.error('Gamma status error:', error);
    return NextResponse.json({ error: error.message || '查询失败' }, { status: 500 });
  }
}
