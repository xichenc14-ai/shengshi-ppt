/**
 * Gamma 主题库
 *
 * 颜色值以 2026-06-20 人工核对表为准：
 * [背景色, 强调色, 字体色]。
 *
 * 展示分类是面向 PPT 用户的策展分类，不等同于仅按背景色机械分组；
 * 主题卡片始终使用真实颜色值渲染。
 */

export type ThemeColorFamily =
  | 'blue'
  | 'orangeBrown'
  | 'yellowCream'
  | 'green'
  | 'whiteGray'
  | 'black'
  | 'purplePink';

export interface ThemeData {
  id: string;
  name: string;
  nameZh: string;
  colors: string[];
  palette?: string[];
  gradient?: { from: string; to: string; angle: number };
  category: ThemeColorFamily;
  colorFamily: ThemeColorFamily;
  categoryZh: string;
  emoji: string;
  style: string;
  scenes: string[];
  tags?: string[];
  isDeprecated?: boolean;
  replacedBy?: string;
  isLocked?: boolean;
}

type ThemeSeed = {
  id: string;
  name: string;
  nameZh: string;
  colors: [string, string, string];
  category: ThemeColorFamily;
  style: string;
  scenes: string[];
  tags: string[];
};

type CategoryMeta = { name: string; emoji: string; colors: string[] };

const CATEGORY_META: Record<ThemeColorFamily, CategoryMeta> = {
  orangeBrown: { name: '橙棕色系', emoji: '🟧', colors: ['#FF954F', '#D2600F', '#835E54'] },
  yellowCream: { name: '米黄色系', emoji: '🟨', colors: ['#F9F6F0', '#F6EBD4', '#DA9B49'] },
  green: { name: '绿色系', emoji: '🟩', colors: ['#26A688', '#438951', '#006747'] },
  blue: { name: '蓝色系', emoji: '🟦', colors: ['#84C1FA', '#1B54DA', '#202733'] },
  purplePink: { name: '紫粉色系', emoji: '🩷', colors: ['#6237C8', '#AF41F0', '#E199BB'] },
  whiteGray: { name: '白灰色系', emoji: '⬜', colors: ['#FFFFFF', '#E8E8E3', '#888888'] },
  black: { name: '深色系', emoji: '⬛', colors: ['#252833', '#0C0524', '#1B1C1D'] },
};

export const CATEGORY_ORDER: ThemeColorFamily[] = [
  'orangeBrown',
  'yellowCream',
  'green',
  'blue',
  'purplePink',
  'whiteGray',
  'black',
];

export const MAX_THEMES_PER_CATEGORY = 8;

/**
 * 网站展示顺序：
 * 背景本身属于该色系的主题优先，白色/浅色背景、仅靠强调色补充的主题靠后。
 */
export const CATEGORY_THEME_DISPLAY_ORDER: Record<ThemeColorFamily, string[]> = {
  orangeBrown: ['wine', 'chocolate', 'terracotta', 'oasis', 'clementa', 'dialogue', 'leimoon', 'peach'],
  yellowCream: ['cornfield', 'creme', 'kraft', 'finesse', 'vanilla', 'dune', 'gold-leaf', 'oatmeal'],
  green: ['verdigris', 'sprout', 'pistachio', 'plant-shop', 'sage', 'seafoam', 'commons', 'elysia'],
  blue: ['marine', 'blue-steel', 'petrol', 'tranquil', 'cornflower', 'zephyr', 'breeze', 'consultant'],
  purplePink: ['blueberry', 'aurora', 'daydream', 'lavender', 'gamma', 'atmosphere', 'ashrose', 'coral-glow'],
  whiteGray: ['editoria', 'wireframe', 'mercury', 'gleam', 'ash', 'pearl', 'howlite', 'default-light'],
  black: ['gamma-dark', 'borealis', 'electric', 'blues', 'aurum', 'slate', 'mystique', 'stardust'],
};

const SEEDS: ThemeSeed[] = [
  // 橙棕色系
  { id: 'clementa', name: 'Clementa', nameZh: '蜜橙暖光', colors: ['#FFFFF4', '#FF954F', '#67534F'], category: 'orangeBrown', style: '温暖亲和', scenes: ['生活方式', '餐饮美食', '培训课件'], tags: ['温暖', '清新', '生活'] },
  { id: 'dialogue', name: 'Dialogue', nameZh: '赤橙跃动', colors: ['#FFFFFF', '#E04F00', '#383838'], category: 'orangeBrown', style: '醒目沟通', scenes: ['营销提案', '培训课件', '创意方案'], tags: ['活力', '沟通', '现代'] },
  { id: 'oasis', name: 'Oasis', nameZh: '沙丘暖橙', colors: ['#FFF8F0', '#D2600F', '#2B2E3C'], category: 'orangeBrown', style: '温暖现代', scenes: ['文旅介绍', '餐饮美食', '品牌介绍'], tags: ['温暖', '自然', '品牌'] },
  { id: 'terracotta', name: 'Terracotta', nameZh: '赤陶雅棕', colors: ['#FFFCFA', '#835E54', '#443728'], category: 'orangeBrown', style: '质感人文', scenes: ['文化教育', '家居生活', '品牌介绍'], tags: ['人文', '复古', '温暖'] },
  { id: 'leimoon', name: 'Leimoon', nameZh: '柑橘新章', colors: ['#FFFFFF', '#FF7047', '#55575A'], category: 'orangeBrown', style: '简洁活泼', scenes: ['营销提案', '产品介绍', '培训课件'], tags: ['活泼', '简约', '年轻'] },
  { id: 'peach', name: 'Peach', nameZh: '蜜桃柔光', colors: ['#FFFFFF', '#FFAD94', '#403C4E'], category: 'orangeBrown', style: '柔和友好', scenes: ['生活方式', '教育培训', '女性主题'], tags: ['柔和', '友好', '生活'] },
  { id: 'wine', name: 'Wine', nameZh: '酒红雅宴', colors: ['#5C2438', '#FFB393', '#F4CAB8'], category: 'orangeBrown', style: '浓郁雅致', scenes: ['餐饮美食', '品牌发布', '庆典活动'], tags: ['雅致', '浓郁', '高端'] },
  { id: 'chocolate', name: 'Chocolate', nameZh: '可可鎏金', colors: ['#403234', '#E2C2B3', '#D3C9C5'], category: 'orangeBrown', style: '沉稳高级', scenes: ['高端品牌', '美妆时尚', '商务汇报'], tags: ['高端', '沉稳', '奢华'] },

  // 米黄色系
  { id: 'creme', name: 'Creme', nameZh: '奶油米白', colors: ['#F9F6F0', '#D3C5B6', '#B2A599'], category: 'yellowCream', style: '柔和留白', scenes: ['生活方式', '美妆时尚', '作品集'], tags: ['奶油', '极简', '柔和'] },
  { id: 'kraft', name: 'Kraft', nameZh: '原野纸韵', colors: ['#EFECE6', '#E8E4DD', '#4A4A45'], category: 'yellowCream', style: '自然质朴', scenes: ['文化教育', '环保公益', '品牌故事'], tags: ['自然', '纸感', '质朴'] },
  { id: 'oatmeal', name: 'Oatmeal', nameZh: '燕麦留白', colors: ['#FFFFFF', '#E5E5E0', '#272525'], category: 'yellowCream', style: '温润极简', scenes: ['通用', '产品介绍', '作品集'], tags: ['极简', '温润', '干净'] },
  { id: 'finesse', name: 'Finesse', nameZh: '雅致米绿', colors: ['#FEF5E7', '#38512F', '#3A3630'], category: 'yellowCream', style: '自然雅致', scenes: ['生活方式', '旅游出行', '餐饮美食'], tags: ['自然', '温暖', '生活'] },
  { id: 'dune', name: 'Dune', nameZh: '金沙雅序', colors: ['#FFFDFA', '#B88E23', '#454240'], category: 'yellowCream', style: '稳重轻奢', scenes: ['商务汇报', '品牌介绍', '年度总结'], tags: ['商务', '轻奢', '稳重'] },
  { id: 'vanilla', name: 'Vanilla', nameZh: '香草森语', colors: ['#FFFDE6', '#224435', '#3B4E4E'], category: 'yellowCream', style: '自然清新', scenes: ['教育培训', '环保公益', '生活方式'], tags: ['自然', '清新', '温暖'] },
  { id: 'cornfield', name: 'Cornfield', nameZh: '麦田旧梦', colors: ['#F6EBD4', '#626C3B', '#403011'], category: 'yellowCream', style: '田园复古', scenes: ['乡村文旅', '文化教育', '品牌故事'], tags: ['田园', '复古', '自然'] },
  { id: 'gold-leaf', name: 'Gold Leaf', nameZh: '金叶轻奢', colors: ['#FFFFFF', '#DA9B49', '#2C2926'], category: 'yellowCream', style: '明亮轻奢', scenes: ['高端品牌', '商务汇报', '庆典活动'], tags: ['金色', '高端', '轻奢'] },

  // 绿色系
  { id: 'seafoam', name: 'Seafoam', nameZh: '海沫清歌', colors: ['#FFFFFF', '#26A688', '#333F70'], category: 'green', style: '清爽现代', scenes: ['环保公益', '医疗健康', '产品介绍'], tags: ['清新', '科技', '自然'] },
  { id: 'commons', name: 'Commons', nameZh: '青岚商务', colors: ['#FFFFFF', '#1C9770FF', '#464646'], category: 'green', style: '专业简洁', scenes: ['商务汇报', '培训课件', '数据分析'], tags: ['商务', '专业', '清新'] },
  { id: 'sage', name: 'Sage', nameZh: '鼠尾草境', colors: ['#FFFFFF', '#437066', '#2C3249'], category: 'green', style: '安静雅致', scenes: ['生活方式', '医疗健康', '文化教育'], tags: ['雅致', '自然', '柔和'] },
  { id: 'verdigris', name: 'Verdigris', nameZh: '青曜矩阵', colors: ['#112836', '#0A988B', '#CAD6DE'], category: 'green', style: '深色科技', scenes: ['科技AI', '数据分析', '产品发布'], tags: ['科技', '未来', '专业'] },
  { id: 'pistachio', name: 'Pistachio', nameZh: '晴果新绿', colors: ['#FAFFFA', '#438951', '#405449'], category: 'green', style: '轻快自然', scenes: ['教育培训', '生活方式', '环保公益'], tags: ['清新', '活泼', '自然'] },
  { id: 'plant-shop', name: 'Plant Shop', nameZh: '森植日常', colors: ['#FCFBF8', '#1B5F39', '#2C2821'], category: 'green', style: '植物美学', scenes: ['生活方式', '零售品牌', '环保公益'], tags: ['植物', '自然', '生活'] },
  { id: 'sprout', name: 'Sprout', nameZh: '新芽晨光', colors: ['#E5F9F2', '#006747', '#4B4A4A'], category: 'green', style: '清新成长', scenes: ['教育培训', '企业成长', '环保公益'], tags: ['成长', '清新', '自然'] },
  { id: 'elysia', name: 'Elysia', nameZh: '原野漫游', colors: ['#FAF5EB', '#3371A5', '#2B3541'], category: 'green', style: '自然叙事', scenes: ['旅游出行', '生活方式', '创意方案'], tags: ['自然', '叙事', '清新'] },

  // 蓝色系
  { id: 'consultant', name: 'Consultant', nameZh: '蓝湾智策', colors: ['#FFFFFF', '#2150FE', '#4C4C4D'], category: 'blue', style: '专业商务', scenes: ['商务汇报', '数据分析', '年度总结'], tags: ['商务', '专业', '正式'] },
  { id: 'blue-steel', name: 'Blue Steel', nameZh: '蓝曜矩阵', colors: ['#202733', '#599CE8', '#E5E0DF'], category: 'blue', style: '现代科技', scenes: ['科技AI', '产品发布', '数据分析'], tags: ['科技', '专业', '深色'] },
  { id: 'marine', name: 'Marine', nameZh: '深海蓝图', colors: ['#080E26', '#8C98CA', '#EBECEF'], category: 'blue', style: '稳健深蓝', scenes: ['商务汇报', '金融路演', '年度总结'], tags: ['商务', '深色', '稳重'] },
  { id: 'petrol', name: 'Petrol', nameZh: '海石蓝灰', colors: ['#FFFCF5', '#325F7B', '#2B4150'], category: 'blue', style: '理性雅致', scenes: ['商务汇报', '研究报告', '品牌介绍'], tags: ['理性', '专业', '雅致'] },
  { id: 'zephyr', name: 'Zephyr', nameZh: '清风天蓝', colors: ['#FFFFFF', '#4296CD', '#384653'], category: 'blue', style: '清爽友好', scenes: ['培训课件', '教育教学', '产品介绍'], tags: ['清爽', '友好', '现代'] },
  { id: 'tranquil', name: 'Tranquil', nameZh: '静谧湖蓝', colors: ['#FFFFFF', '#007EBD', '#272525'], category: 'blue', style: '明快简洁', scenes: ['通用', '医疗健康', '培训课件'], tags: ['简洁', '清新', '可靠'] },
  { id: 'cornflower', name: 'Cornflower', nameZh: '矢车菊蓝', colors: ['#F9F9FF', '#1B54DA', '#404155'], category: 'blue', style: '活泼清新', scenes: ['教育培训', '校园介绍', '创意方案'], tags: ['教育', '活泼', '年轻'] },
  { id: 'breeze', name: 'Breeze', nameZh: '晴空浅蓝', colors: ['#FFFFFF', '#84C1FA', '#1E3063'], category: 'blue', style: '轻盈柔和', scenes: ['生活方式', '培训课件', '产品介绍'], tags: ['轻盈', '柔和', '清新'] },

  // 紫粉色系
  { id: 'ashrose', name: 'Ashrose', nameZh: '雾玫瑰', colors: ['#FFFFFF', '#C7A2AC', '#6E6666'], category: 'purplePink', style: '低饱和雅致', scenes: ['美妆时尚', '生活方式', '品牌介绍'], tags: ['雅致', '女性', '柔和'] },
  { id: 'coral-glow', name: 'Coral Glow', nameZh: '珊瑚微光', colors: ['#FFFFFF', '#E199BB', '#4A4A4A'], category: 'purplePink', style: '温柔现代', scenes: ['婚礼庆典', '美妆时尚', '情感分享'], tags: ['情感', '浪漫', '柔和'] },
  { id: 'gamma', name: 'Gamma', nameZh: '活力伽马', colors: ['#FDFAF7', '#6237C8', '#272525'], category: 'purplePink', style: '品牌创意', scenes: ['创意方案', '产品发布', '营销提案'], tags: ['创意', '品牌', '活力'] },
  { id: 'atmosphere', name: 'Atmosphere', nameZh: '紫雾流光', colors: ['#FFFFFF', '#AF41F0', '#272525'], category: 'purplePink', style: '明快创意', scenes: ['创意方案', '产品发布', '美妆时尚'], tags: ['创意', '渐变', '年轻'] },
  { id: 'blueberry', name: 'Blueberry', nameZh: '蓝莓夜光', colors: ['#100C35', '#FA2F5C', '#D9E1FF'], category: 'purplePink', style: '潮流霓虹', scenes: ['潮流品牌', '产品发布', '创意方案'], tags: ['霓虹', '潮流', '深色'] },
  { id: 'daydream', name: 'Daydream', nameZh: '星梦蓝紫', colors: ['#F3F3FF', '#2D4DF2', '#00002E'], category: 'purplePink', style: '梦幻现代', scenes: ['创意方案', '教育培训', '生活方式'], tags: ['梦幻', '现代', '柔和'] },
  { id: 'aurora', name: 'Aurora', nameZh: '极光幻境', colors: ['#0D0A2C', '#581CA0', '#DCD7E5'], category: 'purplePink', style: '未来科技', scenes: ['科技AI', '产品发布', '创意方案'], tags: ['科技', '未来', '深色'] },
  { id: 'lavender', name: 'Lavender', nameZh: '薰衣草暮色', colors: ['#FBFAFF', '#5955EB', '#49495A'], category: 'purplePink', style: '柔和理性', scenes: ['教育培训', '创意方案', '产品介绍'], tags: ['柔和', '理性', '现代'] },

  // 白灰色系
  { id: 'default-light', name: 'Default Light', nameZh: '晨白简章', colors: ['#FFFFFF', '#4950BC', '#272525'], category: 'whiteGray', style: '通用清晰', scenes: ['通用', '商务汇报', '培训课件'], tags: ['通用', '简约', '干净'] },
  { id: 'pearl', name: 'Pearl', nameZh: '珍珠留白', colors: ['#FFFFFF', '#1B1B27', '#272525'], category: 'whiteGray', style: '精致极简', scenes: ['通用', '作品集', '商务汇报'], tags: ['极简', '精致', '干净'] },
  { id: 'mercury', name: 'Mercury', nameZh: '银雾灰', colors: ['#FFFFFF', '#888888', '#3D3E44'], category: 'whiteGray', style: '中性现代', scenes: ['研究报告', '商务汇报', '作品集'], tags: ['中性', '现代', '简洁'] },
  { id: 'howlite', name: 'Howlite', nameZh: '白松石留白', colors: ['#FFFFFF', '#2D2E34', '#3D3838'], category: 'whiteGray', style: '高级留白', scenes: ['通用', '美妆时尚', '作品集'], tags: ['极简', '高级', '留白'] },
  { id: 'ash', name: 'Ash', nameZh: '编辑留白', colors: ['#FCFCFC', '#1D1D1B', '#61615C'], category: 'whiteGray', style: '编辑排版', scenes: ['研究报告', '文化教育', '商务汇报'], tags: ['编辑', '专业', '极简'] },
  { id: 'wireframe', name: 'Wireframe', nameZh: '线框简报', colors: ['#F7F7F7', '#CCCCCC', '#383838'], category: 'whiteGray', style: '结构清晰', scenes: ['产品原型', '培训课件', '研究报告'], tags: ['结构', '简洁', '理性'] },
  { id: 'editoria', name: 'Editoria', nameZh: '杂志雅刊', colors: ['#E8E8E3', '#1E1E1A', '#55575A'], category: 'whiteGray', style: '杂志质感', scenes: ['品牌介绍', '文化教育', '作品集'], tags: ['杂志', '编辑', '质感'] },
  { id: 'gleam', name: 'Gleam', nameZh: '银灰秩序', colors: ['#FFFFFF', '#373B48', '#52586B'], category: 'whiteGray', style: '冷静专业', scenes: ['商务汇报', '数据分析', '产品介绍'], tags: ['商务', '专业', '冷静'] },

  // 深色系：控制纯黑数量，以蓝紫、青绿、黑金等深色主题提升可用性
  { id: 'gamma-dark', name: 'Gamma Dark', nameZh: '暗夜伽马', colors: ['#0C0524', '#9A81DF', '#E0D6DE'], category: 'black', style: '暗夜创意', scenes: ['科技AI', '产品发布', '创意方案'], tags: ['深色', '创意', '未来'] },
  { id: 'mystique', name: 'Mystique', nameZh: '霓虹魅影', colors: ['#0F0F10', '#FF6BD8', '#E0D6DE'], category: 'black', style: '霓虹时尚', scenes: ['潮流品牌', '产品发布', '美妆时尚'], tags: ['深色', '霓虹', '时尚'] },
  { id: 'blues', name: 'Blues', nameZh: '深海蓝调', colors: ['#09151A', '#609DFF', '#E2E6E9'], category: 'black', style: '深蓝专业', scenes: ['商务汇报', '科技AI', '年度总结'], tags: ['深色', '商务', '蓝色'] },
  { id: 'electric', name: 'Electric', nameZh: '电光蓝域', colors: ['#252833', '#6EB9FC', '#D6E5EF'], category: 'black', style: '冷调科技', scenes: ['科技AI', '数据分析', '产品发布'], tags: ['深色', '科技', '冷调'] },
  { id: 'borealis', name: 'Borealis', nameZh: '极地青光', colors: ['#0A081B', '#16FFBB', '#E0E4E6'], category: 'black', style: '未来青绿', scenes: ['科技AI', '产品发布', '创意方案'], tags: ['深色', '未来', '青绿'] },
  { id: 'aurum', name: 'Aurum', nameZh: '黑金鎏光', colors: ['#1B1C1D', '#D2AC47', '#CFCBBF'], category: 'black', style: '黑金高端', scenes: ['高端品牌', '商务汇报', '庆典活动'], tags: ['深色', '金色', '奢华'] },
  { id: 'stardust', name: 'Stardust', nameZh: '星尘炽橙', colors: ['#030303', '#FC8337', '#E5E0DF'], category: 'black', style: '高对比创意', scenes: ['产品发布', '创意方案', '潮流品牌'], tags: ['深色', '活力', '高对比'] },
  { id: 'slate', name: 'Slate', nameZh: '暖岩暮色', colors: ['#292C32', '#FFBC8F', '#D4D4D1'], category: 'black', style: '温暖深色', scenes: ['品牌介绍', '生活方式', '产品发布'], tags: ['深色', '温暖', '现代'] },
];

export const THEME_DATABASE: ThemeData[] = SEEDS.map((theme) => {
  const meta = CATEGORY_META[theme.category];
  return {
    ...theme,
    colorFamily: theme.category,
    categoryZh: meta.name,
    emoji: meta.emoji,
    palette: [theme.colors[1], theme.colors[2], theme.colors[0]],
  };
});

const UNIQUE_THEME_IDS = new Set<string>();
for (const theme of THEME_DATABASE) {
  if (UNIQUE_THEME_IDS.has(theme.id)) {
    throw new Error(`duplicate theme id in THEME_DATABASE: ${theme.id}`);
  }
  UNIQUE_THEME_IDS.add(theme.id);
}

export const COLOR_CATEGORIES: Array<{
  id: ThemeColorFamily;
  name: string;
  emoji: string;
  count: number;
  colors: string[];
}> = CATEGORY_ORDER.map((id) => {
  const meta = CATEGORY_META[id];
  const count = THEME_DATABASE.filter((theme) => theme.category === id).length;
  if (count !== MAX_THEMES_PER_CATEGORY) {
    throw new Error(`category ${id} has ${count} themes (required ${MAX_THEMES_PER_CATEGORY})`);
  }
  return { id, name: meta.name, emoji: meta.emoji, colors: meta.colors, count };
});

export function getThemesByCategory(category: string): ThemeData[] {
  const themes = THEME_DATABASE.filter((theme) => theme.category === category);
  const displayOrder = CATEGORY_THEME_DISPLAY_ORDER[category as ThemeColorFamily];
  if (!displayOrder) return themes;

  const rank = new Map(displayOrder.map((id, index) => [id, index]));
  return themes.sort((a, b) => {
    const family = category as ThemeColorFamily;
    const backgroundPriority = Number(backgroundMatchesFamily(b.colors[0], family))
      - Number(backgroundMatchesFamily(a.colors[0], family));
    return backgroundPriority
      || (rank.get(a.id) ?? Number.MAX_SAFE_INTEGER) - (rank.get(b.id) ?? Number.MAX_SAFE_INTEGER);
  });
}

export function getThemeById(id: string): ThemeData | undefined {
  const normalizedId = id.trim().toLowerCase();
  return THEME_DATABASE.find((theme) => theme.id === normalizedId);
}

export const RECOMMENDED_THEME_IDS = [
  'finesse',
  'daydream',
  'gold-leaf',
  'blues',
  'gamma',
  'breeze',
  'wine',
  'verdigris',
] as const;

export const DEFAULT_THEME_ID = RECOMMENDED_THEME_IDS[0];

export function getRecommendedThemes(): ThemeData[] {
  return RECOMMENDED_THEME_IDS
    .map((id) => getThemeById(id))
    .filter((theme): theme is ThemeData => Boolean(theme));
}

export function recommendTheme(scene: string): ThemeData | undefined {
  const sceneThemes = THEME_DATABASE.filter((theme) => theme.scenes.includes(scene));
  return sceneThemes[0] || THEME_DATABASE[0];
}

export const FIXED_CATEGORY_THEME_IDS: Record<ThemeColorFamily, string[]> = CATEGORY_ORDER.reduce((acc, id) => {
  acc[id] = getThemesByCategory(id).map((theme) => theme.id);
  return acc;
}, {} as Record<ThemeColorFamily, string[]>);

// 保留诊断 API；本版采用人工策展清单，因此不存在未归类主题。
export const UNMATCHED_THEMES: Array<{
  id: string;
  nameZh: string;
  background: string;
  suggestedFamily: ThemeColorFamily;
}> = [];

function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const value = hex.replace('#', '').slice(0, 6);
  if (!/^[0-9a-f]{6}$/i.test(value)) return null;
  return {
    r: Number.parseInt(value.slice(0, 2), 16),
    g: Number.parseInt(value.slice(2, 4), 16),
    b: Number.parseInt(value.slice(4, 6), 16),
  };
}

function rgbToHsl(r: number, g: number, b: number): { h: number; s: number; l: number } {
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const delta = max - min;
  const l = (max + min) / 2;
  let h = 0;
  let s = 0;
  if (delta !== 0) {
    s = delta / (1 - Math.abs(2 * l - 1));
    if (max === rn) h = ((gn - bn) / delta) % 6;
    else if (max === gn) h = (bn - rn) / delta + 2;
    else h = (rn - gn) / delta + 4;
    h *= 60;
    if (h < 0) h += 360;
  }
  return { h, s, l };
}

// 仅作颜色诊断；正式分类以人工策展结果为准。
export function getThemeCategoryByBackground(background: string): ThemeColorFamily {
  const rgb = hexToRgb(background);
  if (!rgb) return 'whiteGray';
  const { h, s, l } = rgbToHsl(rgb.r, rgb.g, rgb.b);
  const spread = Math.max(rgb.r, rgb.g, rgb.b) - Math.min(rgb.r, rgb.g, rgb.b);

  if ((l <= 0.12 && spread <= 24) || spread <= 12 || s <= 0.08) {
    return l <= 0.45 ? 'black' : 'whiteGray';
  }
  if (h >= 235 && h < 345) return 'purplePink';
  if (h >= 170 && h < 235) return 'blue';
  if (h >= 75 && h < 170) return 'green';
  if (h >= 35 && h < 75 && l >= 0.55) return 'yellowCream';
  if (h >= 12 && h < 75) return 'orangeBrown';
  if (h < 12 || h >= 345) return 'purplePink';
  return l <= 0.45 ? 'black' : 'whiteGray';
}

function backgroundMatchesFamily(background: string, family: ThemeColorFamily): boolean {
  const rgb = hexToRgb(background);
  if (!rgb) return family === 'whiteGray';
  const { l } = rgbToHsl(rgb.r, rgb.g, rgb.b);
  if (family === 'black' && l <= 0.22) return true;
  return getThemeCategoryByBackground(background) === family;
}
