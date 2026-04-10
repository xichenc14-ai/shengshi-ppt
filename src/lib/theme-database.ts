export interface GammaTheme {
  id: string;
  name: string;
  nameZh: string;
  colors: string[];
  category: 'blue' | 'gray' | 'purple' | 'brown' | 'pink' | 'warm' | 'gold';
  categoryZh: string;
  emoji: string;
  style: string;
  scenes: string[];
}

export const THEME_DATABASE: GammaTheme[] = [
  // 🟦 蓝色系
  { id: 'consultant', name: 'Consultant', nameZh: '商务蓝', colors: ['#1E3A5F', '#2563EB', '#FFFFFF'], category: 'blue', categoryZh: '蓝色系', emoji: '🟦', style: '专业商务', scenes: ['商务汇报', '数据分析', '年度总结'] },
  { id: 'icebreaker', name: 'Icebreaker', nameZh: '蓝白友好', colors: ['#3B82F6', '#FFFFFF', '#1E40AF'], category: 'blue', categoryZh: '蓝色系', emoji: '🟦', style: '专业友好', scenes: ['培训课件', '教育'] },
  { id: 'blues', name: 'Blues', nameZh: '高端深蓝', colors: ['#1E3A8A', '#3B82F6', '#93C5FD'], category: 'blue', categoryZh: '蓝色系', emoji: '🟦', style: '高端奢华', scenes: ['年度总结', '产品发布', '数据分析'] },
  { id: 'blue-steel', name: 'Blue Steel', nameZh: '深蓝灰', colors: ['#1F2937', '#3B82F6', '#9CA3AF'], category: 'blue', categoryZh: '蓝色系', emoji: '🟦', style: '现代企业', scenes: ['商务汇报', '数据分析'] },
  { id: 'breeze', name: 'Breeze', nameZh: '淡蓝清新', colors: ['#DBEAFE', '#60A5FA', '#FFFFFF'], category: 'blue', categoryZh: '蓝色系', emoji: '🟦', style: '简约柔和', scenes: ['生活方式', '创意方案'] },
  { id: 'commons', name: 'Commons', nameZh: '灰白绿', colors: ['#F3F4F6', '#10B981', '#374151'], category: 'blue', categoryZh: '蓝色系', emoji: '🟦', style: '专业简洁', scenes: ['通用', '培训课件'] },
  { id: 'blueberry', name: 'Blueberry', nameZh: '蓝莓紫粉', colors: ['#7C3AED', '#A78BFA', '#F472B6'], category: 'blue', categoryZh: '蓝色系', emoji: '🟦', style: '活泼趣味', scenes: ['创意方案', '美妆时尚'] },
  { id: 'cornflower', name: 'Cornflower', nameZh: '天蓝活泼', colors: ['#60A5FA', '#DBEAFE', '#1D4ED8'], category: 'blue', categoryZh: '蓝色系', emoji: '🟦', style: '活泼清新', scenes: ['教育', '培训课件'] },

  // ⬛ 黑白灰
  { id: 'default-light', name: 'Basic Light', nameZh: '经典白', colors: ['#FFFFFF', '#111827', '#6B7280'], category: 'gray', categoryZh: '黑白灰', emoji: '⬛', style: '通用默认', scenes: ['通用', '商务汇报'] },
  { id: 'default-dark', name: 'Basic Dark', nameZh: '经典暗', colors: ['#111827', '#374151', '#9CA3AF'], category: 'gray', categoryZh: '黑白灰', emoji: '⬛', style: '通用暗色', scenes: ['通用', '产品发布'] },
  { id: 'ash', name: 'Ash', nameZh: '几何灰', colors: ['#1F2937', '#FFFFFF', '#6B7280'], category: 'gray', categoryZh: '黑白灰', emoji: '⬛', style: '几何严肃', scenes: ['商务汇报', '数据分析'] },
  { id: 'coal', name: 'Coal', nameZh: '高对比', colors: ['#111827', '#FFFFFF', '#EF4444'], category: 'gray', categoryZh: '黑白灰', emoji: '⬛', style: '高对比度', scenes: ['产品发布', '创意方案'] },
  { id: 'gleam', name: 'Gleam', nameZh: '冷银科技', colors: ['#E5E7EB', '#9CA3AF', '#1F2937'], category: 'gray', categoryZh: '黑白灰', emoji: '⬛', style: '科技极简', scenes: ['数据分析', '产品发布'] },
  { id: 'howlite', name: 'Howlite', nameZh: '极简白', colors: ['#FFFFFF', '#111827', '#D1D5DB'], category: 'gray', categoryZh: '黑白灰', emoji: '⬛', style: '极致极简', scenes: ['通用', '美妆时尚'] },
  { id: 'chimney-smoke', name: 'Chimney Smoke', nameZh: '企业优雅', colors: ['#FFFFFF', '#6B7280', '#1F2937'], category: 'gray', categoryZh: '黑白灰', emoji: '⬛', style: '企业优雅', scenes: ['商务汇报', '培训课件'] },
  { id: 'chimney-dust', name: 'Chimney Dust', nameZh: '工业灰', colors: ['#374151', '#9CA3AF', '#E5E7EB'], category: 'gray', categoryZh: '黑白灰', emoji: '⬛', style: '工业科技', scenes: ['数据分析', '产品发布'] },

  // 🟪 紫色系
  { id: 'aurora', name: 'Aurora', nameZh: '极光紫', colors: ['#7C3AED', '#F472B6', '#06B6D4'], category: 'purple', categoryZh: '紫色系', emoji: '🟪', style: '现代未来', scenes: ['产品发布', '科技AI', '创意方案'] },
  { id: 'electric', name: 'Electric', nameZh: '电光紫', colors: ['#8B5CF6', '#06B6D4', '#EC4899'], category: 'purple', categoryZh: '紫色系', emoji: '🟪', style: '未来创意', scenes: ['创意方案', '科技AI'] },
  { id: 'borealis', name: 'Borealis', nameZh: '霓虹蓝绿', colors: ['#065F46', '#10B981', '#34D399'], category: 'warm', categoryZh: '绿色活力', emoji: '🟩', style: '科技创意', scenes: ['科技AI', '产品发布', '创意方案'] },
  { id: 'gamma', name: 'Gamma', nameZh: '活力渐变', colors: ['#F97316', '#EC4899', '#8B5CF6'], category: 'purple', categoryZh: '紫色系', emoji: '🟪', style: '活泼创意', scenes: ['创意方案', '美妆时尚'] },
  { id: 'gamma-dark', name: 'Gamma Dark', nameZh: '暗夜渐变', colors: ['#1F2937', '#8B5CF6', '#F97316'], category: 'purple', categoryZh: '紫色系', emoji: '🟪', style: '暗色创意', scenes: ['产品发布', '科技AI'] },
  { id: 'daydream', name: 'Daydream', nameZh: '梦幻渐变', colors: ['#FFFFFF', '#C4B5FD', '#F472B6'], category: 'purple', categoryZh: '紫色系', emoji: '🟪', style: '柔和设计', scenes: ['生活方式', '美妆时尚'] },
  { id: 'elysia', name: 'Elysia', nameZh: '自然清新', colors: ['#A7F3D0', '#6EE7B7', '#34D399'], category: 'warm', categoryZh: '绿色活力', emoji: '🟩', style: '创意汇报', scenes: ['创意方案', '生活方式', '教育培训'] },

  // 🟫 棕米大地
  { id: 'chisel', name: 'Chisel', nameZh: '文艺棕', colors: ['#FFFFFF', '#92400E', '#D97706'], category: 'brown', categoryZh: '棕米大地', emoji: '🟫', style: '文化教育', scenes: ['教育', '培训课件', '生活方式'] },
  { id: 'clementa', name: 'Clementa', nameZh: '温暖复古', colors: ['#FFF7ED', '#EA580C', '#78350F'], category: 'brown', categoryZh: '棕米大地', emoji: '🟫', style: '温暖复古', scenes: ['生活方式', '美妆时尚'] },
  { id: 'flax', name: 'Flax', nameZh: '杏棕现代', colors: ['#FEF3C7', '#D97706', '#78350F'], category: 'brown', categoryZh: '棕米大地', emoji: '🟫', style: '柔和现代', scenes: ['生活方式', '培训课件'] },
  { id: 'finesse', name: 'Finesse', nameZh: '优雅米绿', colors: ['#FAFAF9', '#65A30D', '#A3E635'], category: 'brown', categoryZh: '棕米大地', emoji: '🟫', style: '优雅生活', scenes: ['美妆时尚', '生活方式'] },
  { id: 'chocolate', name: 'Chocolate', nameZh: '优雅经典', colors: ['#78350F', '#FEF3C7', '#451A03'], category: 'brown', categoryZh: '棕米大地', emoji: '🟫', style: '经典优雅', scenes: ['商务汇报', '年度总结'] },
  { id: 'cigar', name: 'Cigar', nameZh: '高端商务', colors: ['#451A03', '#D97706', '#FEF3C7'], category: 'brown', categoryZh: '棕米大地', emoji: '🟫', style: '高端商务', scenes: ['商务汇报', '路演融资'] },
  { id: 'dune', name: 'Dune', nameZh: '时尚金沙', colors: ['#FEF3C7', '#D97706', '#78350F'], category: 'brown', categoryZh: '棕米大地', emoji: '🟫', style: '时尚品牌', scenes: ['美妆时尚', '产品发布'] },

  // 🩷 粉色系
  { id: 'ashrose', name: 'Ashrose', nameZh: '玫瑰灰', colors: ['#FDF2F8', '#EC4899', '#9F1239'], category: 'pink', categoryZh: '粉色系', emoji: '🩷', style: '美妆时尚', scenes: ['美妆时尚', '生活方式'] },
  { id: 'coral-glow', name: 'Coral Glow', nameZh: '珊瑚粉', colors: ['#FDF2F8', '#F472B6', '#BE185D'], category: 'pink', categoryZh: '粉色系', emoji: '🩷', style: '现代清新', scenes: ['生活方式', '美妆时尚'] },
  { id: 'atmosphere', name: 'Atmosphere', nameZh: '大气渐变', colors: ['#FFEDD5', '#FB923C', '#A855F7'], category: 'pink', categoryZh: '粉色系', emoji: '🩷', style: '活泼温暖', scenes: ['产品发布', '创意方案'] },
  { id: 'bubble-gum', name: 'Bubble Gum', nameZh: '波板糖', colors: ['#FCE7F3', '#EC4899', '#374151'], category: 'pink', categoryZh: '粉色系', emoji: '🩷', style: '活泼复古', scenes: ['教育培训', '生活方式'] },
  { id: 'dawn', name: 'Dawn', nameZh: '黎明灰粉', colors: ['#374151', '#F472B6', '#FFFFFF'], category: 'pink', categoryZh: '粉色系', emoji: '🩷', style: '简约现代', scenes: ['创意方案', '产品发布'] },
  { id: 'editoria', name: 'Editoria', nameZh: '编辑灰粉', colors: ['#374151', '#F9FAFB', '#EC4899'], category: 'pink', categoryZh: '粉色系', emoji: '🩷', style: '中性优雅', scenes: ['美妆时尚', '生活方式'] },

  // 🟧 暖色活力
  { id: 'canaveral', name: 'Canaveral', nameZh: '太空橙', colors: ['#1F2937', '#F97316', '#FDBA74'], category: 'warm', categoryZh: '暖色活力', emoji: '🟧', style: '科技太空', scenes: ['产品发布', '科技AI', '路演融资'] },
  { id: 'alien', name: 'Alien', nameZh: '外星绿', colors: ['#052E16', '#22C55E', '#86EFAC'], category: 'warm', categoryZh: '暖色活力', emoji: '🟧', style: '活泼未来', scenes: ['创意方案', '产品发布'] },
  { id: 'bee-happy', name: 'Bee Happy', nameZh: '明黄黑', colors: ['#FEFCE8', '#EAB308', '#1F2937'], category: 'warm', categoryZh: '暖色活力', emoji: '🟧', style: '友好趣味', scenes: ['教育培训', '生活方式'] },
  { id: 'fluo', name: 'Fluo', nameZh: '霓虹绿', colors: ['#052E16', '#4ADE80', '#BBF7D0'], category: 'warm', categoryZh: '暖色活力', emoji: '🟧', style: '大胆现代', scenes: ['创意方案', '产品发布'] },
  { id: 'cornfield', name: 'Cornfield', nameZh: '麦田黄', colors: ['#FEF9C3', '#CA8A04', '#365314'], category: 'warm', categoryZh: '暖色活力', emoji: '🟧', style: '自然经典', scenes: ['生活方式', '年度总结'] },
  { id: 'founder', name: 'Founder', nameZh: '路演深蓝', colors: ['#1F2937', '#6366F1', '#F97316'], category: 'warm', categoryZh: '暖色活力', emoji: '🟧', style: '路演融资', scenes: ['路演融资', '产品发布', '年度总结'] },
  { id: 'atacama', name: 'Atacama', nameZh: '沙漠霓虹', colors: ['#1F2937', '#F43F5E', '#FBBF24'], category: 'warm', categoryZh: '暖色活力', emoji: '🟧', style: '大胆潮流', scenes: ['创意方案', '产品发布'] },

  // 🪙 金色奢华
  { id: 'aurum', name: 'Aurum', nameZh: '金色奢华', colors: ['#111827', '#F59E0B', '#FCD34D'], category: 'gold', categoryZh: '金色奢华', emoji: '🪙', style: '奢华高端', scenes: ['产品发布', '年度总结', '路演融资'] },
  { id: 'gold-leaf', name: 'Gold Leaf', nameZh: '金叶白', colors: ['#FEF3C7', '#D97706', '#92400E'], category: 'gold', categoryZh: '金色奢华', emoji: '🪙', style: '奢华优雅', scenes: ['产品发布', '美妆时尚', '年度总结'] },
  { id: 'creme', name: 'Creme', nameZh: '奶油米', colors: ['#FEF9C3', '#FDE68A', '#78350F'], category: 'gold', categoryZh: '金色奢华', emoji: '🪙', style: '时尚优雅', scenes: ['美妆时尚', '生活方式', '创意方案'] },
  { id: 'bonan-hale', name: 'Bonan Hale', nameZh: '现代建筑', colors: ['#1F2937', '#F59E0B', '#9CA3AF'], category: 'gold', categoryZh: '金色奢华', emoji: '🪙', style: '现代建筑', scenes: ['产品发布', '创意方案'] },
  { id: 'festival', name: 'Festival', nameZh: '节日红金', colors: ['#B91C1C', '#F59E0B', '#FEF3C7'], category: 'gold', categoryZh: '金色奢华', emoji: '🪙', style: '节庆高端', scenes: ['年度总结', '产品发布'] },
  { id: 'lunar-new-year', name: 'Lunar New Year', nameZh: '新年红金', colors: ['#991B1B', '#EF4444', '#FCD34D'], category: 'gold', categoryZh: '金色奢华', emoji: '🪙', style: '节庆中国风', scenes: ['年度总结', '生活方式'] },
  { id: 'luxe', name: 'Luxe', nameZh: '奢侈深棕', colors: ['#1C1917', '#D97706', '#F5F5F4'], category: 'gold', categoryZh: '金色奢华', emoji: '🪙', style: '奢侈高端', scenes: ['产品发布', '路演融资', '年度总结'] },
];

export const COLOR_CATEGORIES: Array<{ id: string; name: string; emoji: string; count: number; colors: string[] }> = [
  { id: 'blue', name: '蓝色系', emoji: '🟦', count: 8, colors: ['#1E3A5F', '#2563EB', '#3B82F6'] },
  { id: 'gray', name: '黑白灰', emoji: '⬛', count: 8, colors: ['#1F2937', '#374151', '#6B7280'] },
  { id: 'purple', name: '紫色系', emoji: '🟪', count: 5, colors: ['#7C3AED', '#A78BFA', '#06B6D4'] },
  { id: 'brown', name: '棕米大地', emoji: '🟫', count: 7, colors: ['#92400E', '#D97706', '#78350F'] },
  { id: 'pink', name: '粉色系', emoji: '🩷', count: 6, colors: ['#FDF2F8', '#EC4899', '#BE185D'] },
  { id: 'warm', name: '暖色活力', emoji: '🟧', count: 9, colors: ['#1F2937', '#F97316', '#22C55E'] },
  { id: 'gold', name: '金色奢华', emoji: '🪙', count: 7, colors: ['#111827', '#F59E0B', '#FCD34D'] },
];

export function getThemesByCategory(category: string): GammaTheme[] {
  return THEME_DATABASE.filter(t => t.category === category);
}

export function getThemeById(id: string): GammaTheme | undefined {
  return THEME_DATABASE.find(t => t.id === id);
}

export function recommendTheme(scene: string): GammaTheme | undefined {
  const sceneThemes = THEME_DATABASE.filter(t => t.scenes.includes(scene));
  return sceneThemes[0] || THEME_DATABASE[0];
}
