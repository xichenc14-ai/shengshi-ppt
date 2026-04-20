/**
 * Gamma 配置共享模块
 * 目的：消除 gamma/route.ts 和 gamma-direct/route.ts 之间的代码重复
 * 所有配置、模板、工具函数统一在此维护
 */

import type { KeyInfo } from './gamma-key-pool';

// ===== 常量 =====

/** 深色主题集合（这些主题下 themeAccent 常显示占位符，需改用网图） */
export const DARK_THEMES = new Set([
  'founder', 'aurora', 'electric', 'blues',
  'gamma', 'luxe', 'aurum',
]);

/** Gamma API UA */
export const GAMMA_UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

// ===== 配置 =====

/** 场景 → 推荐配置映射 */
export const SCENE_CONFIGS: Record<string, {
  themeId: string;
  tone: string;
  imageSource: string;
  imageModel: string;
}> = {
  biz:         { themeId: 'consultant',  tone: 'professional', imageSource: 'pictographic', imageModel: 'imagen-3-flash' },
  pitch:       { themeId: 'founder',     tone: 'professional', imageSource: 'pictographic', imageModel: 'imagen-3-flash' },
  training:    { themeId: 'icebreaker',  tone: 'casual',      imageSource: 'noImages',     imageModel: '' },
  creative:    { themeId: 'electric',    tone: 'creative',    imageSource: 'aiGenerated',  imageModel: 'imagen-3-flash' },
  education:   { themeId: 'chisel',      tone: 'casual',      imageSource: 'pictographic', imageModel: 'imagen-3-flash' },
  data:        { themeId: 'gleam',       tone: 'professional', imageSource: 'noImages',    imageModel: '' },
  annual:      { themeId: 'blues',       tone: 'professional', imageSource: 'pictographic', imageModel: 'imagen-3-flash' },
  launch:      { themeId: 'aurora',      tone: 'bold',        imageSource: 'aiGenerated',  imageModel: 'imagen-3-flash' },
  traditional: { themeId: 'chisel',      tone: 'traditional', imageSource: 'aiGenerated',  imageModel: 'imagen-3-flash' },
};

/** 风格模板提示词 */
export const INSTRUCTION_TEMPLATES: Record<string, string> = {
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
- 图表标题清晰,说明数据来源

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

// ===== 工具函数 =====

/**
 * 构建 imageOptions（根据 imageSource 和 themeId 智能选择图片源）
 * 深色主题下 themeAccent 常显示占位符，自动改用网图
 */
export function buildImageOptions(imageSource: string, themeId: string): Record<string, any> {
  if (imageSource === 'none' || imageSource === 'noImages') {
    return { source: 'noImages' };
  }
  if (imageSource === 'theme' || imageSource === 'theme-img') {
    return DARK_THEMES.has(themeId)
      ? { source: 'webFreeToUseCommercially' }
      : { source: 'themeAccent' };
  }
  if (imageSource === 'pictographic') {
    return DARK_THEMES.has(themeId)
      ? { source: 'webFreeToUseCommercially' }
      : { source: 'themeAccent' };
  }
  if (imageSource === 'web') {
    return { source: 'webFreeToUseCommercially' };
  }
  if (imageSource === 'ai' || imageSource === 'aiGenerated') {
    return { source: 'aiGenerated', model: 'imagen-3-flash', style: 'flat illustration, minimalist, clean background, negative space' };
  }
  if (imageSource === 'ai-pro') {
    return { source: 'aiGenerated', model: 'imagen-3-pro', style: 'professional, high quality, cinematic, detailed' };
  }
  return { source: 'themeAccent' };
}

/**
 * 统一追加图标规范（解决 gamma-direct 缺少此指令的问题）
 */
export function appendIconInstructions(instructions: string): string {
  return instructions + '\n\n【图标规范-统一风格】\n使用Gamma内置的图标系统(Icons),保持风格统一:简洁、线性、单色、与主题色一致。禁止混用不同风格的图标(不要同时使用emoji和线性图标)。每页2-4个图标,用于要点标记和视觉装饰。禁止出现无图标的页面。';
}
