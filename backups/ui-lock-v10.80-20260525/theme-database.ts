/**
 * Theme Database — All preset themes with extended fields for P5
 *
 * Extended fields (P5):
 * - palette: string[]        — chart color palette (5-8 colors)
 * - gradient?: { from, to, angle } — optional background gradient
 * - isDeprecated: boolean     — replaces _deprecated
 * - isLocked: boolean         — locked custom themes
 * - tags: string[]            — classification tags
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
  colors: string[]; // [background, accent, font]

  // P5: Extended palette (chart colors, 5-8 colors)
  palette?: string[];

  // P5: Optional background gradient
  gradient?: { from: string; to: string; angle: number };

  // Classification
  category: ThemeColorFamily;
  colorFamily: ThemeColorFamily;
  categoryZh: string;
  emoji: string;
  style: string;
  scenes: string[];
  tags?: string[]; // P5: 商务/创意/科技/简约/奢华/温暖/节庆 etc.

  // Lifecycle
  isDeprecated?: boolean;  // replaces _deprecated (v10.43)
  replacedBy?: string;    // v10.15

  // P5: Lock flag for user custom themes
  isLocked?: boolean;
}

import { getAllGammaThemes } from '@/lib/gamma-theme-mapping';

type RawThemeData = Omit<ThemeData, 'category' | 'colorFamily' | 'categoryZh' | 'emoji'> & {
  category: string;
  categoryZh: string;
  emoji: string;
};

const RAW_THEME_DATABASE: RawThemeData[] = [
  // 🟦 蓝色系
  {
    id: 'consultant', name: 'Consultant', nameZh: '商务蓝',
    colors: ['#1E3A5F', '#2563EB', '#FFFFFF'],
    palette: ['#1E3A5F', '#2563EB', '#3B82F6', '#60A5FA', '#93C5FD', '#BFDBFE'],
    category: 'blue', categoryZh: '蓝色系', emoji: '🟦', style: '专业商务',
    scenes: ['商务汇报', '数据分析', '年度总结'],
    tags: ['商务', '专业', '正式'],
  },
  {
    id: 'icebreaker', name: 'Icebreaker', nameZh: '蓝白友好',
    colors: ['#3B82F6', '#FFFFFF', '#1E40AF'],
    palette: ['#3B82F6', '#2563EB', '#1E40AF', '#1D4ED8', '#1E3A8A', '#60A5FA'],
    category: 'blue', categoryZh: '蓝色系', emoji: '🟦', style: '专业友好',
    scenes: ['培训课件', '教育'],
    tags: ['商务', '教育'],
  },
  {
    id: 'blues', name: 'Blues', nameZh: '高端深蓝',
    colors: ['#1E3A8A', '#3B82F6', '#93C5FD'],
    palette: ['#1E3A8A', '#1E40AF', '#3B82F6', '#60A5FA', '#93C5FD', '#BFDBFE'],
    category: 'blue', categoryZh: '蓝色系', emoji: '🟦', style: '高端奢华',
    scenes: ['年度总结', '产品发布', '数据分析'],
    tags: ['商务', '专业', '正式'],
  },
  {
    id: 'blue-steel', name: 'Blue Steel', nameZh: '深蓝灰',
    colors: ['#1F2937', '#3B82F6', '#9CA3AF'],
    palette: ['#1F2937', '#3B82F6', '#60A5FA', '#9CA3AF', '#6B7280', '#374151'],
    category: 'blue', categoryZh: '蓝色系', emoji: '🟦', style: '现代企业',
    scenes: ['商务汇报', '数据分析'],
    tags: ['商务', '专业'],
  },
  {
    id: 'breeze', name: 'Breeze', nameZh: '淡蓝清新',
    colors: ['#DBEAFE', '#60A5FA', '#FFFFFF'],
    palette: ['#DBEAFE', '#60A5FA', '#3B82F6', '#BFDBFE', '#93C5FD', '#E0E7FF'],
    category: 'blue', categoryZh: '蓝色系', emoji: '🟦', style: '简约柔和',
    scenes: ['生活方式', '创意方案'],
    tags: ['简约', '创意', '活泼'],
  },
  {
    id: 'commons', name: 'Commons', nameZh: '灰白绿',
    colors: ['#F3F4F6', '#10B981', '#374151'],
    palette: ['#F3F4F6', '#10B981', '#374151', '#059669', '#34D399', '#6EE7B7'],
    category: 'blue', categoryZh: '蓝色系', emoji: '🟦', style: '专业简洁',
    scenes: ['通用', '培训课件'],
    tags: ['商务', '简约'],
  },
  {
    id: 'blueberry', name: 'Blueberry', nameZh: '蓝莓紫粉',
    colors: ['#7C3AED', '#A78BFA', '#F472B6'],
    palette: ['#7C3AED', '#A78BFA', '#F472B6', '#C084FC', '#E879F9', '#F0ABFC'],
    category: 'purple', categoryZh: '紫色系', emoji: '🟪', style: '活泼趣味',
    scenes: ['创意方案', '美妆时尚'],
    tags: ['创意', '活泼', '年轻'],
  },
  {
    id: 'cornflower', name: 'Cornflower', nameZh: '天蓝活泼',
    colors: ['#60A5FA', '#DBEAFE', '#1D4ED8'],
    palette: ['#60A5FA', '#3B82F6', '#2563EB', '#1D4ED8', '#1E40AF', '#DBEAFE'],
    category: 'blue', categoryZh: '蓝色系', emoji: '🟦', style: '活泼清新',
    scenes: ['教育', '培训课件'],
    tags: ['教育', '活泼', '年轻'],
  },

  // ⬛ 黑白灰
  {
    id: 'default-light', name: 'Basic Light', nameZh: '经典白',
    colors: ['#FFFFFF', '#111827', '#6B7280'],
    palette: ['#FFFFFF', '#111827', '#6B7280', '#374151', '#9CA3AF', '#D1D5DB'],
    category: 'gray', categoryZh: '黑白灰', emoji: '⬛', style: '通用默认',
    scenes: ['通用', '商务汇报'],
    tags: ['简约', '极简', '干净'],
  },
  {
    id: 'default-dark', name: 'Basic Dark', nameZh: '经典暗',
    colors: ['#111827', '#374151', '#9CA3AF'],
    palette: ['#111827', '#374151', '#9CA3AF', '#6B7280', '#D1D5DB', '#F3F4F6'],
    category: 'gray', categoryZh: '黑白灰', emoji: '⬛', style: '通用暗色',
    scenes: ['通用', '产品发布'],
    tags: ['科技', 'AI', '未来'],
  },
  {
    id: 'ash', name: 'Ash', nameZh: '几何灰',
    colors: ['#1F2937', '#FFFFFF', '#6B7280'],
    palette: ['#1F2937', '#FFFFFF', '#6B7280', '#374151', '#9CA3AF', '#D1D5DB'],
    category: 'gray', categoryZh: '黑白灰', emoji: '⬛', style: '几何严肃',
    scenes: ['商务汇报', '数据分析'],
    tags: ['商务', '专业', '正式'],
  },
  {
    id: 'coal', name: 'Coal', nameZh: '高对比',
    colors: ['#111827', '#FFFFFF', '#EF4444'],
    palette: ['#111827', '#FFFFFF', '#EF4444', '#F87171', '#6B7280', '#9CA3AF'],
    category: 'gray', categoryZh: '黑白灰', emoji: '⬛', style: '高对比度',
    scenes: ['产品发布', '创意方案'],
    tags: ['科技', '创意', '大胆'],
  },
  {
    id: 'gleam', name: 'Gleam', nameZh: '冷银科技',
    colors: ['#E5E7EB', '#9CA3AF', '#1F2937'],
    palette: ['#E5E7EB', '#9CA3AF', '#1F2937', '#6B7280', '#D1D5DB', '#F3F4F6'],
    category: 'gray', categoryZh: '黑白灰', emoji: '⬛', style: '科技极简',
    scenes: ['数据分析', '产品发布'],
    tags: ['科技', '简约', '未来'],
  },
  {
    id: 'howlite', name: 'Howlite', nameZh: '极简白',
    colors: ['#FFFFFF', '#111827', '#D1D5DB'],
    palette: ['#FFFFFF', '#111827', '#D1D5DB', '#6B7280', '#E5E7EB', '#F3F4F6'],
    category: 'gray', categoryZh: '黑白灰', emoji: '⬛', style: '极致极简',
    scenes: ['通用', '美妆时尚'],
    tags: ['简约', '极简', '干净'],
  },
  {
    id: 'chimney-smoke', name: 'Chimney Smoke', nameZh: '企业优雅',
    colors: ['#FFFFFF', '#6B7280', '#1F2937'],
    palette: ['#FFFFFF', '#6B7280', '#1F2937', '#374151', '#9CA3AF', '#D1D5DB'],
    category: 'gray', categoryZh: '黑白灰', emoji: '⬛', style: '企业优雅',
    scenes: ['商务汇报', '培训课件'],
    tags: ['商务', '专业', '正式'],
  },
  {
    id: 'chimney-dust', name: 'Chimney Dust', nameZh: '工业灰',
    colors: ['#374151', '#9CA3AF', '#E5E7EB'],
    palette: ['#374151', '#9CA3AF', '#E5E7EB', '#6B7280', '#D1D5DB', '#F3F4F6'],
    category: 'gray', categoryZh: '黑白灰', emoji: '⬛', style: '工业科技',
    scenes: ['数据分析', '产品发布'],
    tags: ['科技', '工业', '未来'],
  },

  // 🟪 紫色系
  {
    id: 'aurora', name: 'Aurora', nameZh: '极光紫',
    colors: ['#7C3AED', '#F472B6', '#06B6D4'],
    palette: ['#7C3AED', '#F472B6', '#06B6D4', '#8B5CF6', '#EC4899', '#14B8A6'],
    category: 'purple', categoryZh: '紫色系', emoji: '🟪', style: '现代未来',
    scenes: ['产品发布', '科技AI', '创意方案'],
    tags: ['科技', 'AI', '创意', '未来'],
  },
  {
    id: 'electric', name: 'Electric', nameZh: '电光紫',
    colors: ['#8B5CF6', '#06B6D4', '#EC4899'],
    palette: ['#8B5CF6', '#06B6D4', '#EC4899', '#A855F7', '#14B8A6', '#F472B6'],
    category: 'purple', categoryZh: '紫色系', emoji: '🟪', style: '未来创意',
    scenes: ['创意方案', '科技AI'],
    tags: ['科技', '创意', 'AI', '未来'],
  },
  {
    id: 'borealis', name: 'Borealis', nameZh: '冠虹蓝绿',
    colors: ['#065F46', '#10B981', '#34D399'],
    palette: ['#065F46', '#10B981', '#34D399', '#059669', '#6EE7B7', '#A7F3D0'],
    category: 'warm', categoryZh: '绿色活力', emoji: '🟩', style: '科技创意',
    scenes: ['科技AI', '产品发布', '创意方案'],
    tags: ['科技', '创意', '未来'],
  },
  {
    id: 'gamma', name: 'Gamma', nameZh: '活力渐变',
    colors: ['#F97316', '#EC4899', '#8B5CF6'],
    palette: ['#F97316', '#EC4899', '#8B5CF6', '#F97316', '#F472B6', '#A855F7'],
    category: 'warm', categoryZh: '暖色活力', emoji: '🟧', style: '活泼创意',
    scenes: ['创意方案', '美妆时尚'],
    tags: ['创意', '活泼', '年轻'],
  },
  {
    id: 'gamma-dark', name: 'Gamma Dark', nameZh: '暗夜渐变',
    colors: ['#1F2937', '#8B5CF6', '#F97316'],
    palette: ['#1F2937', '#8B5CF6', '#F97316', '#A855F7', '#EC4899', '#FB923C'],
    category: 'purple', categoryZh: '紫色系', emoji: '🟪', style: '暗色创意',
    scenes: ['产品发布', '科技AI'],
    tags: ['科技', 'AI', '暗色', '未来'],
  },
  {
    id: 'daydream', name: 'Daydream', nameZh: '梦幻渐变',
    colors: ['#FFFFFF', '#C4B5FD', '#F472B6'],
    palette: ['#FFFFFF', '#C4B5FD', '#F472B6', '#A78BFA', '#E879F9', '#FBCFE8'],
    category: 'purple', categoryZh: '紫色系', emoji: '🟪', style: '柔和设计',
    scenes: ['生活方式', '美妆时尚'],
    tags: ['温暖', '生活', '柔和'],
  },
  {
    id: 'elysia', name: 'Elysia', nameZh: '自然清新',
    colors: ['#A7F3D0', '#6EE7B7', '#34D399'],
    palette: ['#A7F3D0', '#6EE7B7', '#34D399', '#10B981', '#059669', '#D1FAE5'],
    category: 'warm', categoryZh: '绿色活力', emoji: '🟩', style: '创意汇报',
    scenes: ['创意方案', '生活方式', '教育培训'],
    tags: ['温暖', '生活', '自然'],
  },

  // 🟫 棕米大地
  {
    id: 'chisel', name: 'Chisel', nameZh: '文艺棕',
    colors: ['#FFFFFF', '#92400E', '#D97706'],
    palette: ['#FFFFFF', '#92400E', '#D97706', '#B45309', '#F59E0B', '#FCD34D'],
    category: 'brown', categoryZh: '棕米大地', emoji: '🟫', style: '文化教育',
    scenes: ['教育', '培训课件', '生活方式'],
    tags: ['温暖', '教育', '自然'],
  },
  {
    id: 'clementa', name: 'Clementa', nameZh: '温暖复古',
    colors: ['#FFF7ED', '#EA580C', '#78350F'],
    palette: ['#FFF7ED', '#EA580C', '#78350F', '#C2410C', '#FB923C', '#FED7AA'],
    category: 'brown', categoryZh: '棕米大地', emoji: '🟫', style: '温暖复古',
    scenes: ['生活方式', '美妆时尚'],
    tags: ['温暖', '生活', '复古'],
  },
  {
    id: 'flax', name: 'Flax', nameZh: '杏棕现代',
    colors: ['#FEF3C7', '#D97706', '#78350F'],
    palette: ['#FEF3C7', '#D97706', '#78350F', '#B45309', '#F59E0B', '#FDE68A'],
    category: 'brown', categoryZh: '棕米大地', emoji: '🟫', style: '柔和现代',
    scenes: ['生活方式', '培训课件'],
    tags: ['温暖', '生活', '自然'],
  },
  {
    id: 'finesse', name: 'Finesse', nameZh: '优雅米绿',
    colors: ['#ECE3D1', '#4F6F43', '#2F3D2E'],
    palette: ['#ECE3D1', '#4F6F43', '#2F3D2E', '#6F8F57', '#B7A381', '#D8CCB5'],
    category: 'brown', categoryZh: '棕米大地', emoji: '🟫', style: '优雅生活',
    scenes: ['美妆时尚', '生活方式'],
    tags: ['温暖', '生活', '自然'],
  },
  {
    id: 'chocolate', name: 'Chocolate', nameZh: '优雅经典',
    colors: ['#78350F', '#FEF3C7', '#451A03'],
    palette: ['#78350F', '#FEF3C7', '#451A03', '#92400E', '#D97706', '#FDE68A'],
    category: 'brown', categoryZh: '棕米大地', emoji: '🟫', style: '经典优雅',
    scenes: ['商务汇报', '年度总结'],
    tags: ['商务', '专业', '奢华'],
  },
  {
    id: 'cigar', name: 'Cigar', nameZh: '酒红棕',
    colors: ['#451A03', '#D97706', '#FEF3C7'],
    palette: ['#451A03', '#D97706', '#FEF3C7', '#78350F', '#B45309', '#FDE68A'],
    category: 'brown', categoryZh: '棕米大地', emoji: '🟫', style: '高端商务',
    scenes: ['商务汇报', '路演融资'],
    tags: ['商务', '奢华', '高端'],
  },
  {
    id: 'dune', name: 'Dune', nameZh: '时间金沙',
    colors: ['#FEF3C7', '#D97706', '#78350F'],
    palette: ['#FEF3C7', '#D97706', '#78350F', '#B45309', '#F59E0B', '#FDE68A'],
    category: 'brown', categoryZh: '棕米大地', emoji: '🟫', style: '时尚品牌',
    scenes: ['美妆时尚', '产品发布'],
    tags: ['创意', '时尚', '生活'],
  },

  // 🩷 粉色系
  {
    id: 'ashrose', name: 'Ashrose', nameZh: '玫瑰灰',
    colors: ['#FDF2F8', '#EC4899', '#9F1239'],
    palette: ['#FDF2F8', '#EC4899', '#9F1239', '#BE185D', '#F472B6', '#FBCFE8'],
    category: 'pink', categoryZh: '粉色系', emoji: '🩷', style: '美妆时尚',
    scenes: ['美妆时尚', '生活方式'],
    tags: ['创意', '时尚', '生活'],
  },
  {
    id: 'coral-glow', name: 'Coral Glow', nameZh: '珊瑚粉',
    colors: ['#FDF2F8', '#F472B6', '#BE185D'],
    palette: ['#FDF2F8', '#F472B6', '#BE185D', '#DB2777', '#EC4899', '#FBCFE8'],
    category: 'pink', categoryZh: '粉色系', emoji: '🩷', style: '现代清新',
    scenes: ['生活方式', '美妆时尚'],
    tags: ['温暖', '生活', '时尚'],
  },
  {
    id: 'atmosphere', name: 'Atmosphere', nameZh: '大气渐变',
    colors: ['#FFEDD5', '#FB923C', '#A855F7'],
    palette: ['#FFEDD5', '#FB923C', '#A855F7', '#F97316', '#C084FC', '#FDE68A'],
    category: 'pink', categoryZh: '粉色系', emoji: '🩷', style: '活泼温暖',
    scenes: ['产品发布', '创意方案'],
    tags: ['创意', '活泼', '温暖'],
  },
  {
    id: 'bubble-gum', name: 'Bubble Gum', nameZh: '波板糖',
    colors: ['#FCE7F3', '#EC4899', '#374151'],
    palette: ['#FCE7F3', '#EC4899', '#374151', '#BE185D', '#F472B6', '#FDF2F8'],
    category: 'pink', categoryZh: '粉色系', emoji: '🩷', style: '活泼复古',
    scenes: ['教育培训', '生活方式'],
    tags: ['创意', '活泼', '年轻'],
  },
  {
    id: 'dawn', name: 'Dawn', nameZh: '黎明灰粉',
    colors: ['#374151', '#F472B6', '#FFFFFF'],
    palette: ['#374151', '#F472B6', '#FFFFFF', '#EC4899', '#6B7280', '#FBCFE8'],
    category: 'pink', categoryZh: '粉色系', emoji: '🩷', style: '简约现代',
    scenes: ['创意方案', '产品发布'],
    tags: ['科技', '创意', '现代'],
  },
  {
    id: 'editoria', name: 'Editoria', nameZh: '编辑灰粉',
    colors: ['#374151', '#F9FAFB', '#EC4899'],
    palette: ['#374151', '#F9FAFB', '#EC4899', '#6B7280', '#F472B6', '#FDF2F8'],
    category: 'pink', categoryZh: '粉色系', emoji: '🩷', style: '中性优雅',
    scenes: ['美妆时尚', '生活方式'],
    tags: ['商务', '时尚', '优雅'],
  },

  // 🟧 暖色活力
  {
    id: 'canaveral', name: 'Canaveral', nameZh: '太空橙',
    colors: ['#1F2937', '#F97316', '#FDBA74'],
    palette: ['#1F2937', '#F97316', '#FDBA74', '#FB923C', '#EA580C', '#FEF3C7'],
    category: 'warm', categoryZh: '暖色活力', emoji: '🟧', style: '科技太空',
    scenes: ['产品发布', '科技AI', '路演融资'],
    tags: ['科技', '创意', '未来'],
  },
  {
    id: 'alien', name: 'Alien', nameZh: '外星绿',
    colors: ['#052E16', '#22C55E', '#86EFAC'],
    palette: ['#052E16', '#22C55E', '#86EFAC', '#16A34A', '#4ADE80', '#BBF7D0'],
    category: 'warm', categoryZh: '暖色活力', emoji: '🟧', style: '活泼未来',
    scenes: ['创意方案', '产品发布'],
    tags: ['科技', '创意', '未来', '活泼'],
  },
  {
    id: 'bee-happy', name: 'Bee Happy', nameZh: '明黄黑',
    colors: ['#FEFCE8', '#EAB308', '#1F2937'],
    palette: ['#FEFCE8', '#EAB308', '#1F2937', '#CA8A04', '#F59E0B', '#FDE68A'],
    category: 'warm', categoryZh: '暖色活力', emoji: '🟧', style: '友好趣味',
    scenes: ['教育培训', '生活方式'],
    tags: ['教育', '活泼', '温暖'],
  },
  {
    id: 'fluo', name: 'Fluo', nameZh: '冠虹绿',
    colors: ['#052E16', '#4ADE80', '#BBF7D0'],
    palette: ['#052E16', '#4ADE80', '#BBF7D0', '#22C55E', '#86EFAC', '#D1FAE5'],
    category: 'warm', categoryZh: '暖色活力', emoji: '🟧', style: '大胆现代',
    scenes: ['创意方案', '产品发布'],
    tags: ['科技', '创意', '大胆'],
  },
  {
    id: 'cornfield', name: 'Cornfield', nameZh: '麦田黄',
    colors: ['#FEF9C3', '#CA8A04', '#365314'],
    palette: ['#FEF9C3', '#CA8A04', '#365314', '#A16207', '#EAB308', '#FEF08A'],
    category: 'warm', categoryZh: '暖色活力', emoji: '🟧', style: '自然经典',
    scenes: ['生活方式', '年度总结'],
    tags: ['温暖', '生活', '自然'],
  },
  {
    id: 'founder', name: 'Founder', nameZh: '路演深蓝',
    colors: ['#1F2937', '#6366F1', '#F97316'],
    palette: ['#1F2937', '#6366F1', '#F97316', '#4F46E5', '#FB923C', '#818CF8'],
    category: 'warm', categoryZh: '暖色活力', emoji: '🟧', style: '路演融资',
    scenes: ['路演融资', '产品发布', '年度总结'],
    tags: ['商务', '科技', '高端'],
  },
  {
    id: 'atacama', name: 'Atacama', nameZh: '沙漠霓虹',
    colors: ['#1F2937', '#F43F5E', '#FBBF24'],
    palette: ['#1F2937', '#F43F5E', '#FBBF24', '#E11D48', '#FCD34D', '#FB7185'],
    category: 'warm', categoryZh: '暖色活力', emoji: '🟧', style: '大胆潮流',
    scenes: ['创意方案', '产品发布'],
    tags: ['科技', '创意', '大胆', '潮流'],
  },

  // 🪙 金色奢华
  {
    id: 'aurum', name: 'Aurum', nameZh: '金色奢华',
    colors: ['#111827', '#F59E0B', '#FCD34D'],
    palette: ['#111827', '#F59E0B', '#FCD34D', '#D97706', '#FBBF24', '#FEF3C7'],
    category: 'gold', categoryZh: '金色奢华', emoji: '🪙', style: '奢华高端',
    scenes: ['产品发布', '年度总结', '路演融资'],
    tags: ['奢华', '高端', '节庆'],
  },
  {
    id: 'gold-leaf', name: 'Gold Leaf', nameZh: '金叶白',
    colors: ['#FEF3C7', '#D97706', '#92400E'],
    palette: ['#FEF3C7', '#D97706', '#92400E', '#B45309', '#F59E0B', '#FDE68A'],
    category: 'gold', categoryZh: '金色奢华', emoji: '🪙', style: '奢华优雅',
    scenes: ['产品发布', '美妆时尚', '年度总结'],
    tags: ['奢华', '高端', '优雅'],
  },
  {
    id: 'creme', name: 'Creme', nameZh: '奶油米',
    colors: ['#FEF9C3', '#FDE68A', '#78350F'],
    palette: ['#FEF9C3', '#FDE68A', '#78350F', '#D97706', '#B45309', '#FEF3C7'],
    category: 'gold', categoryZh: '金色奢华', emoji: '🪙', style: '时尚优雅',
    scenes: ['美妆时尚', '生活方式', '创意方案'],
    tags: ['温暖', '生活', '时尚'],
  },
  {
    id: 'bonan-hale', name: 'Bonan Hale', nameZh: '现代建筑',
    colors: ['#1F2937', '#F59E0B', '#9CA3AF'],
    palette: ['#1F2937', '#F59E0B', '#9CA3AF', '#D97706', '#6B7280', '#FBBF24'],
    category: 'gold', categoryZh: '金色奢华', emoji: '🪙', style: '现代建筑',
    scenes: ['产品发布', '创意方案'],
    tags: ['科技', '创意', '现代'],
  },
  {
    id: 'festival', name: 'Festival', nameZh: '节日红金',
    colors: ['#B91C1C', '#F59E0B', '#FEF3C7'],
    palette: ['#B91C1C', '#F59E0B', '#FEF3C7', '#EF4444', '#FBBF24', '#FEE2E2'],
    category: 'gold', categoryZh: '金色奢华', emoji: '🪙', style: '节庆高端',
    scenes: ['年度总结', '产品发布'],
    tags: ['节庆', '中国风', '奢华'],
  },
  {
    id: 'lunar-new-year', name: 'Lunar New Year', nameZh: '新年红金',
    colors: ['#991B1B', '#EF4444', '#FCD34D'],
    palette: ['#991B1B', '#EF4444', '#FCD34D', '#DC2626', '#F59E0B', '#FEE2E2'],
    category: 'gold', categoryZh: '金色奢华', emoji: '🪙', style: '节庆中国风',
    scenes: ['年度总结', '生活方式'],
    tags: ['节庆', '中国风', '温暖'],
  },
  {
    id: 'luxe', name: 'Luxe', nameZh: '奢侈深棕',
    colors: ['#1C1917', '#D97706', '#F5F5F4'],
    palette: ['#1C1917', '#D97706', '#F5F5F4', '#B45309', '#F59E0B', '#FEF3C7'],
    category: 'gold', categoryZh: '金色奢华', emoji: '🪙', style: '奢侈高端',
    scenes: ['产品发布', '路演融资', '年度总结'],
    tags: ['奢华', '高端', '商务'],
  },
];

function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const normalized = (hex || '').trim().replace('#', '');
  if (!/^[0-9a-fA-F]{6}$/.test(normalized)) return null;
  const n = Number.parseInt(normalized, 16);
  return {
    r: (n >> 16) & 255,
    g: (n >> 8) & 255,
    b: n & 255,
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

function clampHue(h: number): number {
  if (h < 0) return (h % 360) + 360;
  if (h >= 360) return h % 360;
  return h;
}

// 仅用于 unmatched 诊断参考（不参与正式分组）
export function getThemeCategoryByBackground(background: string): ThemeColorFamily {
  const rgb = hexToRgb(background);
  if (!rgb) return 'whiteGray';
  const { h, s, l } = rgbToHsl(rgb.r, rgb.g, rgb.b);
  const hue = clampHue(h);
  const spread = Math.max(rgb.r, rgb.g, rgb.b) - Math.min(rgb.r, rgb.g, rgb.b);

  if (l <= 0.16 && spread <= 35) return 'black';
  if (s <= 0.08 || (s <= 0.16 && spread <= 32)) {
    return l <= 0.45 ? 'black' : 'whiteGray';
  }
  if (hue >= 250 && hue < 345) return 'purplePink';
  if (hue >= 170 && hue < 250) return 'blue';
  if (hue >= 75 && hue < 170) return 'green';
  if (hue >= 12 && hue < 75) return 'orangeBrown';
  if (hue < 12 || hue >= 345) return 'purplePink';
  return l <= 0.45 ? 'black' : 'whiteGray';
}

type CategoryMeta = { name: string; emoji: string; colors: string[] };

const CATEGORY_META: Record<ThemeColorFamily, CategoryMeta> = {
  blue: { name: '蓝色系', emoji: '🟦', colors: ['#1E3A5F', '#2563EB', '#93C5FD'] },
  orangeBrown: { name: '橙棕色系', emoji: '🟧', colors: ['#F97316', '#D97706', '#78350F'] },
  yellowCream: { name: '米黄色系', emoji: '🟨', colors: ['#FFF7ED', '#EAB308', '#4F6F43'] },
  green: { name: '绿色系', emoji: '🟩', colors: ['#065F46', '#22C55E', '#86EFAC'] },
  whiteGray: { name: '白灰色系', emoji: '⬜', colors: ['#FFFFFF', '#E5E7EB', '#9CA3AF'] },
  black: { name: '黑色系', emoji: '⬛', colors: ['#111827', '#374151', '#1F2937'] },
  purplePink: { name: '紫粉色系', emoji: '🩷', colors: ['#7C3AED', '#EC4899', '#FDF2F8'] },
};

const CATEGORY_ORDER: ThemeColorFamily[] = ['blue', 'orangeBrown', 'yellowCream', 'green', 'whiteGray', 'black', 'purplePink'];
const MAX_THEMES_PER_CATEGORY = 10;

const FIXED_THEME_COLOR_FAMILY_MAP: Record<string, ThemeColorFamily> = {
  // 蓝色系
  consultant: 'blue',
  blues: 'blue',
  'blue-steel': 'blue',
  breeze: 'blue',
  cornflower: 'blue',

  // 橙棕色系
  gamma: 'orangeBrown',
  atmosphere: 'orangeBrown',
  chocolate: 'orangeBrown',
  cigar: 'orangeBrown',

  // 米黄色系
  clementa: 'yellowCream',
  flax: 'yellowCream',
  finesse: 'yellowCream',
  dune: 'yellowCream',
  'bee-happy': 'yellowCream',
  cornfield: 'yellowCream',
  'gold-leaf': 'yellowCream',
  creme: 'yellowCream',

  // 绿色系
  borealis: 'green',
  elysia: 'green',
  alien: 'green',
  fluo: 'green',

  // 白灰色系
  chisel: 'whiteGray',
  commons: 'whiteGray',
  'default-light': 'whiteGray',
  gleam: 'whiteGray',
  howlite: 'whiteGray',
  'chimney-smoke': 'whiteGray',

  // 黑色系
  'default-dark': 'black',
  ash: 'black',
  coal: 'black',
  'chimney-dust': 'black',
  'gamma-dark': 'black',
  canaveral: 'black',
  founder: 'black',
  atacama: 'black',
  aurum: 'black',
  'bonan-hale': 'black',

  // 紫粉色系
  blueberry: 'purplePink',
  aurora: 'purplePink',
  electric: 'purplePink',
  daydream: 'purplePink',
  ashrose: 'purplePink',
  'coral-glow': 'purplePink',
  'bubble-gum': 'purplePink',
  dawn: 'purplePink',
  editoria: 'purplePink',
};

const GAMMA_AVAILABLE_THEME_IDS = new Set(getAllGammaThemes());
const seenThemeIds = new Set<string>();

export const THEME_DATABASE: ThemeData[] = RAW_THEME_DATABASE
  // 只保留 Gamma /themes 当前可用主题，彻底避免 UI 选了但 API 回退
  .filter((theme) => GAMMA_AVAILABLE_THEME_IDS.has(theme.id))
  .filter((theme) => {
    if (seenThemeIds.has(theme.id)) return false;
    seenThemeIds.add(theme.id);
    return true;
  })
  .filter((theme) => Boolean(FIXED_THEME_COLOR_FAMILY_MAP[theme.id]))
  .map((theme) => {
    const colorFamily = FIXED_THEME_COLOR_FAMILY_MAP[theme.id];
    const meta = CATEGORY_META[colorFamily];
    return {
      ...theme,
      category: colorFamily,
      colorFamily,
      categoryZh: meta.name,
      emoji: meta.emoji,
    };
  });

const UNIQUE_THEME_IDS = new Set<string>();
for (const theme of THEME_DATABASE) {
  if (UNIQUE_THEME_IDS.has(theme.id)) {
    throw new Error(`duplicate theme id in THEME_DATABASE: ${theme.id}`);
  }
  UNIQUE_THEME_IDS.add(theme.id);
}

export const UNMATCHED_THEMES = RAW_THEME_DATABASE
  .filter((theme) => GAMMA_AVAILABLE_THEME_IDS.has(theme.id))
  .filter((theme) => !FIXED_THEME_COLOR_FAMILY_MAP[theme.id])
  .map((theme) => ({
    id: theme.id,
    nameZh: theme.nameZh,
    background: theme.colors[0],
    suggestedFamily: getThemeCategoryByBackground(theme.colors[0]),
  }));

if (process.env.NODE_ENV !== 'production' && UNMATCHED_THEMES.length > 0) {
  // eslint-disable-next-line no-console
  console.warn('[theme-database] unmatchedThemes', UNMATCHED_THEMES);
}

export const COLOR_CATEGORIES: Array<{ id: ThemeColorFamily; name: string; emoji: string; count: number; colors: string[] }> = CATEGORY_ORDER.map((id) => {
  const meta = CATEGORY_META[id];
  const count = THEME_DATABASE.filter((theme) => theme.category === id).length;
  if (count > MAX_THEMES_PER_CATEGORY) {
    throw new Error(`category ${id} has ${count} themes (max ${MAX_THEMES_PER_CATEGORY})`);
  }
  return {
    id,
    name: meta.name,
    emoji: meta.emoji,
    colors: meta.colors,
    count,
  };
});

export function getThemesByCategory(category: string): ThemeData[] {
  return THEME_DATABASE.filter((t) => t.category === category);
}

export function getThemeById(id: string): ThemeData | undefined {
  return THEME_DATABASE.find((t) => t.id === id);
}

export function recommendTheme(scene: string): ThemeData | undefined {
  const sceneThemes = THEME_DATABASE.filter((t) => t.scenes.includes(scene));
  return sceneThemes[0] || THEME_DATABASE[0];
}

export const FIXED_CATEGORY_THEME_IDS: Record<ThemeColorFamily, string[]> = CATEGORY_ORDER.reduce((acc, id) => {
  acc[id] = THEME_DATABASE.filter((theme) => theme.category === id).map((theme) => theme.id);
  return acc;
}, {} as Record<ThemeColorFamily, string[]>);
