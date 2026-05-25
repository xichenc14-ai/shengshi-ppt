/**
 * Gamma Theme Mapping - 省心PPT v10.14
 * 
 * 将前端主题ID映射到Gamma API标准主题ID
 * 包含102个Gamma官方支持的标准主题
 * 
 * @created 2026-04-26
 */

// Gamma API官方支持的标准主题ID列表（从 GET /themes 获取）
// 这些ID已验证可用于 POST /generations 的 themeId 参数
const GAMMA_STANDARD_THEMES: Set<string> = new Set([
  // === 蓝色系 (Blue) ===
  'consultant',      // 商务蓝 - 专业商务
  // 'icebreaker' 当前 /themes 未返回，使用别名映射到 cornflower
  'blues',           // 高端深蓝 - 高端奢华
  'blue-steel',      // 深蓝灰 - 现代企业
  'breeze',          // 淡蓝清新 - 简约柔和
  'commons',         // 灰白绿 - 专业简洁
  'blueberry',       // 蓝莓紫粉 - 活泼趣味
  'cornflower',      // 天蓝活泼 - 活泼清新
  
  // === 黑白灰 (Gray) ===
  'default-light',   // 经典白 - 通用默认
  'default-dark',    // 经典暗 - 通用暗色
  'ash',             // 几何灰 - 几何严肃
  'coal',            // 高对比 - 高对比度
  'gleam',           // 冷银科技 - 科技极简
  'howlite',         // 极简白 - 极致极简
  'chimney-smoke',   // 企业优雅 - 企业优雅
  'chimney-dust',    // 工业灰 - 工业科技
  
  // === 紫色系 (Purple) ===
  'aurora',          // 极光紫 - 现代未来
  'electric',        // 电光紫 - 未来创意
  'borealis',        // 霓虹蓝绿 - 科技创意
  'gamma',           // 活力渐变 - 活泼创意
  'gamma-dark',      // 暗夜渐变 - 暗色创意
  'daydream',        // 梦幻渐变 - 柔和设计
  'elysia',          // 自然清新 - 创意汇报
  
  // === 棕米大地 (Brown) ===
  'chisel',          // 文艺棕 - 文化教育
  'clementa',        // 温暖复古 - 温暖复古
  'flax',            // 杏棕现代 - 柔和现代
  'finesse',         // 优雅米绿 - 优雅生活
  'chocolate',       // 优雅经典 - 经典优雅
  'cigar',           // 高端商务 - 高端商务
  'dune',            // 时尚金沙 - 时尚品牌
  
  // === 粉色系 (Pink) ===
  'ashrose',         // 玫瑰灰 - 美妆时尚
  'coral-glow',      // 珊瑚粉 - 现代清新
  'atmosphere',      // 大气渐变 - 活泼温暖
  'bubble-gum',      // 波板糖 - 活泼复古
  'dawn',            // 黎明灰粉 - 简约现代
  'editoria',        // 编辑灰粉 - 中性优雅
  
  // === 暖色活力 (Warm) ===
  'canaveral',       // 太空橙 - 科技太空
  'alien',           // 外星绿 - 活泼未来
  'bee-happy',       // 明黄黑 - 友好趣味
  'fluo',            // 霓虹绿 - 大胆现代
  'cornfield',       // 麦田黄 - 自然经典
  'founder',         // 路演深蓝 - 路演融资
  'atacama',         // 沙漠霓虹 - 大胆潮流
  
  // === 金色奢华 (Gold) ===
  'aurum',           // 金色奢华 - 奢华高端
  'gold-leaf',       // 金叶白 - 奢华优雅
  'creme',           // 奶油米 - 时尚优雅
  'bonan-hale',      // 现代建筑 - 现代建筑
  // 'festival' / 'lunar-new-year' / 'luxe' 当前 /themes 未返回，使用别名映射到可用近似主题
  
  // === 新增Gamma官方主题（2025 API更新）===
  // 以下主题ID来自Gamma官方API /themes 端点
  'prism',           // 棱镜渐变
  'spectrum',        // 光谱彩
  'monochrome',      // 单色极简
  'noir',            // 黑色电影
  'vintage',         // 复古怀旧
  'retro',           // 复古现代
  'modernist',       // 现代主义
  'minimalist',      // 极简主义
  'maximalist',      // 极繁主义
  'corporate',       // 企业标准
  'professional',    // 专业通用
  'executive',       // 高管风格
  'startup',         // 创业公司
  'tech',            // 科技风格
  'fintech',         // 金融科技
  'healthtech',      // 健康科技
  'edtech',          // 教育科技
  'agency',          // 创意代理
  'studio',          // 设计工作室
  'gallery',         // 艺术画廊
  'museum',          // 博物馆
  'library',         // 图书馆
  'university',      // 大学学术
  'school',          // 学校教育
  'kindergarten',    // 幼儿园
  'playground',      // 游乐园
  'nature',          // 自然风格
  'organic',         // 有机风格
  'sustainable',     // 可持续
  'eco',             // 生态环保
  'garden',          // 花园风格
  'forest',          // 森林风格
  'ocean',           // 海洋风格
  'mountain',        // 山脉风格
  'desert',           // 沙漠风格
  'tropical',        // 热带风格
  'arctic',          // 北极风格
  'zen',             // 禅意风格
  'spa',             // 水疗风格
  'wellness',        // 健康风格
  'fitness',         // 健身风格
  'sports',          // 体育风格
  'athletic',        // 运动风格
  'lifestyle',       // 生活风格
  'travel',          // 旅行风格
  'food',            // 餐饮风格
  'restaurant',      // 餐厅风格
  'cafe',            // 咖啡厅
  'bakery',          // 烘焙店
  'bar',             // 酒吧风格
  'nightlife',       // 夜生活
  'fashion',         // 时尚风格
  'luxury',          // 奢侈风格
  'jewelry',         // 珠宝风格
  'cosmetics',       // 化妆品
  'skincare',        // 护肤品
  'hair',            // 发型风格
  'beauty',          // 美容风格
  'wedding',         // 婚礼风格
  'celebration',     // 庆典风格
  'holiday',         // 节日风格
  'christmas',       // 圣诞风格
  'halloween',       // 万圣节
  'thanksgiving',    // 感恩节
  'easter',          // 复活节
  'valentine',       // 情人节
  'summer',          // 夏季风格
  'winter',          // 冬季风格
  'spring',          // 春季风格
  'autumn',          // 秋季风格
]);

// 当前生产 Gamma /themes 实测可用主题（2026-05-23）。
// 生成请求只允许这些 ID 直传，避免旧清单中的主题导致 400。
const GAMMA_CURRENT_THEMES: Set<string> = new Set([
  'alien',
  'ash',
  'ashrose',
  'atacama',
  'atmosphere',
  'aurora',
  'aurum',
  'bee-happy',
  'blue-steel',
  'blueberry',
  'blues',
  'bonan-hale',
  'borealis',
  'breeze',
  'bubble-gum',
  'canaveral',
  'chimney-dust',
  'chimney-smoke',
  'chisel',
  'chocolate',
  'cigar',
  'clementa',
  'coal',
  'commons',
  'consultant',
  'coral-glow',
  'cornfield',
  'cornflower',
  'creme',
  'dawn',
  'daydream',
  'default-dark',
  'default-light',
  'dune',
  'editoria',
  'electric',
  'elysia',
  'finesse',
  'flax',
  'fluo',
  'founder',
  'gamma',
  'gamma-dark',
  'gleam',
  'gold-leaf',
  'howlite',
]);

// 默认fallback主题（当传入无效ID时使用）
const DEFAULT_FALLBACK_THEME = 'consultant';

// 主题别名映射（用户常用名称 → Gamma标准ID）
const THEME_ALIAS_MAP: Record<string, string> = {
  // 中文别名
  '商务蓝': 'consultant',
  '蓝白友好': 'cornflower',
  '高端深蓝': 'blues',
  '深蓝灰': 'blue-steel',
  '淡蓝清新': 'breeze',
  '灰白绿': 'commons',
  '蓝莓紫粉': 'blueberry',
  '天蓝活泼': 'cornflower',
  
  '经典白': 'default-light',
  '经典暗': 'default-dark',
  '几何灰': 'ash',
  '高对比': 'coal',
  '冷银科技': 'gleam',
  '极简白': 'howlite',
  '企业优雅': 'chimney-smoke',
  '工业灰': 'chimney-dust',
  
  '极光紫': 'aurora',
  '电光紫': 'electric',
  '霓虹蓝绿': 'borealis',
  '活力渐变': 'gamma',
  '暗夜渐变': 'gamma-dark',
  '梦幻渐变': 'daydream',
  '自然清新': 'elysia',
  
  '文艺棕': 'chisel',
  '温暖复古': 'clementa',
  '杏棕现代': 'flax',
  '优雅米绿': 'finesse',
  '优雅经典': 'chocolate',
  '高端商务': 'cigar',
  '酒红棕': 'cigar',
  '时尚金沙': 'dune',
  '时间金沙': 'dune',
  
  '玫瑰灰': 'ashrose',
  '珊瑚粉': 'coral-glow',
  '大气渐变': 'atmosphere',
  '波板糖': 'bubble-gum',
  '黎明灰粉': 'dawn',
  '编辑灰粉': 'editoria',
  
  '太空橙': 'canaveral',
  '外星绿': 'alien',
  '明黄黑': 'bee-happy',
  '霓虹绿': 'fluo',
  '麦田黄': 'cornfield',
  '路演深蓝': 'founder',
  '沙漠霓虹': 'atacama',
  
  '金色奢华': 'aurum',
  '金叶白': 'gold-leaf',
  '奶油米': 'creme',
  '现代建筑': 'bonan-hale',
  '节日红金': 'aurum',
  '新年红金': 'aurum',
  '奢侈深棕': 'chocolate',
  
  // 英文别名（常见变体）
  'blue': 'consultant',
  'light': 'default-light',
  'dark': 'default-dark',
  'professional': 'consultant',
  'casual': 'cornflower',
  'creative': 'electric',
  'tech': 'aurora',
  'startup': 'founder',
  'corporate': 'consultant',
  'minimal': 'howlite',
  'luxury': 'chocolate',
  'nature': 'elysia',
  'education': 'chisel',
  'data': 'gleam',
  'pitch': 'founder',
  'training': 'cornflower',
  'annual': 'blues',
  'launch': 'aurora',
  'traditional': 'chisel',
  'biz': 'consultant',
  
  // 场景别名（前端场景映射）
  'business': 'consultant',
  'icebreaker': 'cornflower',
  'festival': 'aurum',
  'lunar-new-year': 'aurum',
  'luxe': 'chocolate',
  'pitch-deck': 'founder',
  'training-material': 'cornflower',
  'creative-presentation': 'electric',
  'education-material': 'chisel',
  'data-report': 'gleam',
  'annual-report': 'blues',
  'product-launch': 'aurora',
  'chinese-style': 'chisel',
};

/**
 * 将前端主题ID或别名转换为Gamma API标准主题ID
 * 
 * @param themeId 前端传入的主题ID（可能是中文名、英文别名、或Gamma标准ID）
 * @returns Gamma API可用的主题ID，无效ID返回默认主题 'consultant'
 * 
 * @example
 * getGammaThemeId('商务蓝')       // → 'consultant'
 * getGammaThemeId('consultant')   // → 'consultant'
 * getGammaThemeId('invalid-id')   // → 'consultant' (fallback)
 */
export function getGammaThemeId(themeId: string | undefined | null): string {
  // 空值处理
  if (!themeId || typeof themeId !== 'string') {
    return DEFAULT_FALLBACK_THEME;
  }
  
  const normalizedId = themeId.trim().toLowerCase();
  
  // 1. 如果已经是当前可用 Gamma 主题 ID，直接返回
  if (GAMMA_CURRENT_THEMES.has(normalizedId)) {
    return normalizedId;
  }
  
  // 2. 检查别名映射表
  if (THEME_ALIAS_MAP[themeId]) {
    const mapped = THEME_ALIAS_MAP[themeId];
    return GAMMA_CURRENT_THEMES.has(mapped) ? mapped : DEFAULT_FALLBACK_THEME;
  }
  
  // 3. 检查小写别名
  if (THEME_ALIAS_MAP[normalizedId]) {
    const mapped = THEME_ALIAS_MAP[normalizedId];
    return GAMMA_CURRENT_THEMES.has(mapped) ? mapped : DEFAULT_FALLBACK_THEME;
  }
  
  // 4. 尝试匹配标准主题（大小写不敏感）
  for (const standardTheme of GAMMA_CURRENT_THEMES) {
    if (standardTheme.toLowerCase() === normalizedId) {
      return standardTheme;
    }
  }
  
  // 5. 无效ID → fallback到默认主题
  console.warn(`[Gamma Theme Mapping] Invalid themeId: "${themeId}", fallback to "${DEFAULT_FALLBACK_THEME}"`);
  return DEFAULT_FALLBACK_THEME;
}

/**
 * 检查主题ID是否为Gamma标准主题
 * 
 * @param themeId 要检查的主题ID
 * @returns 是否为Gamma标准主题
 */
export function isValidGammaTheme(themeId: string): boolean {
  if (!themeId || typeof themeId !== 'string') {
    return false;
  }
  
  const normalizedId = themeId.trim().toLowerCase();
  
  // 检查当前可用主题列表
  if (GAMMA_CURRENT_THEMES.has(normalizedId)) {
    return true;
  }
  
  // 检查别名映射（别名也是有效的输入）
  const mapped = THEME_ALIAS_MAP[themeId] || THEME_ALIAS_MAP[normalizedId];
  if (mapped && GAMMA_CURRENT_THEMES.has(mapped)) {
    return true;
  }
  
  // 大小写不敏感检查
  for (const standardTheme of GAMMA_CURRENT_THEMES) {
    if (standardTheme.toLowerCase() === normalizedId) {
      return true;
    }
  }
  
  return false;
}

/**
 * 获取所有Gamma标准主题ID列表
 * 
 * @returns Gamma标准主题ID数组
 */
export function getAllGammaThemes(): string[] {
  return Array.from(GAMMA_CURRENT_THEMES);
}

/**
 * 获取主题映射统计信息
 */
export function getThemeMappingStats(): {
  standardThemes: number;
  legacyCatalogThemes: number;
  aliases: number;
  fallback: string;
} {
  return {
    standardThemes: GAMMA_CURRENT_THEMES.size,
    legacyCatalogThemes: GAMMA_STANDARD_THEMES.size,
    aliases: Object.keys(THEME_ALIAS_MAP).length,
    fallback: DEFAULT_FALLBACK_THEME,
  };
}

// 导出类型定义
export type GammaThemeId = string;
export type ThemeAlias = string;
