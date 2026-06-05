/**
 * themeAdapter.ts — 主题色适配器
 * 将 PPT 主题色自动应用到图表配色方案
 * 禁止在图表组件中硬编码颜色！
 */

// ============ 类型定义 ============

export type ThemeName = 'default' | 'corporate' | 'vibrant' | 'elegant' | 'fresh' | 'warm';

export interface ThemeColorSet {
  primary: string;         // 主色（第一数据系列）
  secondary: string;       // 第二数据系列
  tertiary: string;        // 第三数据系列
  quaternary: string;      // 第四数据系列
  quinary: string;         // 第五数据系列
  background: string;      // 背景色
  text: string;            // 主文本色
  subtext: string;         // 次文本色
  grid: string;            // 网格线颜色
  tooltip: string;         // 提示框背景
  positive: string;        // 正向/增长色
  negative: string;        // 负向/下降色
  // 饼图配色（有序）
  pieColors: string[];
}

// recharts color format: string (hex)
export type RechartsColor = string;

// ============ 预设主题色板 ============

export const THEME_PRESETS: Record<ThemeName, ThemeColorSet> = {
  default: {
    primary: '#6366F1',
    secondary: '#8B5CF6',
    tertiary: '#EC4899',
    quaternary: '#F59E0B',
    quinary: '#10B981',
    background: '#FFFFFF',
    text: '#1F2937',
    subtext: '#6B7280',
    grid: '#E5E7EB',
    tooltip: '#1F2937',
    positive: '#10B981',
    negative: '#EF4444',
    pieColors: ['#6366F1', '#8B5CF6', '#EC4899', '#F59E0B', '#10B981', '#06B6D4', '#EF4444'],
  },

  corporate: {
    primary: '#1A365D',
    secondary: '#2B6CB0',
    tertiary: '#3182CE',
    quaternary: '#4299E1',
    quinary: '#63B3ED',
    background: '#F7FAFC',
    text: '#1A202C',
    subtext: '#4A5568',
    grid: '#CBD5E0',
    tooltip: '#1A202C',
    positive: '#38A169',
    negative: '#E53E3E',
    pieColors: ['#1A365D', '#2B6CB0', '#3182CE', '#4299E1', '#63B3ED', '#90CDF4', '#BEE3F8'],
  },

  vibrant: {
    primary: '#FF6B6B',
    secondary: '#4ECDC4',
    tertiary: '#45B7D1',
    quaternary: '#96CEB4',
    quinary: '#FFEAA7',
    background: '#FFFFFF',
    text: '#2D3436',
    subtext: '#636E72',
    grid: '#DFE6E9',
    tooltip: '#2D3436',
    positive: '#00B894',
    negative: '#D63031',
    pieColors: ['#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7', '#FDCB6E', '#E17055'],
  },

  elegant: {
    primary: '#2C3E50',
    secondary: '#8E6F3E',
    tertiary: '#B8860B',
    quaternary: '#CD9B1D',
    quinary: '#DAA520',
    background: '#FDFAF5',
    text: '#2C3E50',
    subtext: '#7F8C8D',
    grid: '#E8E0D5',
    tooltip: '#2C3E50',
    positive: '#27AE60',
    negative: '#C0392B',
    pieColors: ['#2C3E50', '#8E6F3E', '#B8860B', '#CD9B1D', '#DAA520', '#F4D03F', '#535C68'],
  },

  fresh: {
    primary: '#00C853',
    secondary: '#1E88E5',
    tertiary: '#8E24AA',
    quaternary: '#F4511E',
    quinary: '#6D4C41',
    background: '#FAFAFA',
    text: '#212121',
    subtext: '#757575',
    grid: '#E0E0E0',
    tooltip: '#212121',
    positive: '#00C853',
    negative: '#D50000',
    pieColors: ['#00C853', '#1E88E5', '#8E24AA', '#F4511E', '#6D4C41', '#039BE5', '#C6FF00'],
  },

  warm: {
    primary: '#E65100',
    secondary: '#F57C00',
    tertiary: '#FFB300',
    quaternary: '#6D4C41',
    quinary: '#795548',
    background: '#FFF8E1',
    text: '#3E2723',
    subtext: '#5D4037',
    grid: '#D7CCC8',
    tooltip: '#3E2723',
    positive: '#2E7D32',
    negative: '#B71C1C',
    pieColors: ['#E65100', '#F57C00', '#FFB300', '#6D4C41', '#795548', '#FF8A65', '#FFCC80'],
  },
};

// ============ 默认主题 ============

export const DEFAULT_THEME: ThemeName = 'default';

// ============ 主题上下文（可从外部注入） ============

let _currentTheme: ThemeName = DEFAULT_THEME;
let _customTheme: ThemeColorSet | null = null;

/**
 * 获取当前激活的主题
 */
export function getCurrentTheme(): ThemeColorSet {
  if (_customTheme) return _customTheme;
  return THEME_PRESETS[_currentTheme];
}

/**
 * 设置当前主题
 */
export function setTheme(theme: ThemeName): void {
  _currentTheme = theme;
  _customTheme = null;
}

/**
 * 设置自定义主题色板
 */
export function setCustomTheme(colors: ThemeColorSet): void {
  _customTheme = colors;
}

// ============ 图表配色提取 ============

/**
 * 获取图表系列颜色数组（用于 recharts）
 * @param count 需要的颜色数量
 */
export function getChartColors(count: number = 5): RechartsColor[] {
  const theme = getCurrentTheme();
  const baseColors = [
    theme.primary,
    theme.secondary,
    theme.tertiary,
    theme.quaternary,
    theme.quinary,
  ];

  // 如果需求数量 <= 5，直接返回
  if (count <= baseColors.length) {
    return baseColors.slice(0, count);
  }

  // 补充 pieColors
  const allColors = [...baseColors, ...theme.pieColors];
  const result: RechartsColor[] = [];
  for (let i = 0; i < count; i++) {
    result.push(allColors[i % allColors.length]);
  }
  return result;
}

/**
 * 获取柱状图/折线图的单一颜色（用于单系列图表）
 */
export function getPrimaryColor(): RechartsColor {
  return getCurrentTheme().primary;
}

/**
 * 获取饼图配色数组
 */
export function getPieColors(count?: number): RechartsColor[] {
  const theme = getCurrentTheme();
  if (count !== undefined && count <= theme.pieColors.length) {
    return theme.pieColors.slice(0, count);
  }
  return theme.pieColors;
}

/**
 * 获取网格线颜色
 */
export function getGridColor(): RechartsColor {
  return getCurrentTheme().grid;
}

/**
 * 获取文本颜色
 */
export function getTextColor(): RechartsColor {
  return getCurrentTheme().text;
}

/**
 * 获取次要文本颜色
 */
export function getSubtextColor(): RechartsColor {
  return getCurrentTheme().subtext;
}

/**
 * 获取提示框背景色
 */
export function getTooltipBgColor(): RechartsColor {
  return getCurrentTheme().tooltip;
}

/**
 * 获取正向/增长色
 */
export function getPositiveColor(): RechartsColor {
  return getCurrentTheme().positive;
}

/**
 * 获取负向/下降色
 */
export function getNegativeColor(): RechartsColor {
  return getCurrentTheme().negative;
}

// ============ 图表通用样式工厂 ============

export interface ChartStyleConfig {
  theme?: ThemeName;
  primaryColor?: string;
  showGrid?: boolean;
  animationDuration?: number;
}

/**
 * 生成图表通用样式配置（用于 Recharts 属性）
 */
export function buildChartStyle(config: ChartStyleConfig = {}) {
  const theme = config.theme ?? _currentTheme;
  const themeColors = THEME_PRESETS[theme];

  return {
    // 通用颜色
    colors: getChartColors(8),
    // 网格
    showGrid: config.showGrid ?? true,
    // 动画
    animationDuration: config.animationDuration ?? 800,
    // 文本
    labelColor: themeColors.text,
    labelFontSize: 12,
    // 背景（透明，便于嵌入PPT）
    backgroundColor: 'transparent',
    // 主题对象（用于自定义场景）
    theme: themeColors,
  };
}

/**
 * 生成 Recharts CartesianGrid 配置
 */
export function buildGridConfig() {
  return {
    strokeDasharray: '3 3',
    stroke: getGridColor(),
    vertical: false,
  };
}

/**
 * 生成 Recharts CartesianAxis 配置
 */
export function buildAxisConfig() {
  const theme = getCurrentTheme();
  return {
    tick: {
      fill: theme.subtext,
      fontSize: 11,
    },
    axisLine: {
      stroke: theme.grid,
    },
    tickLine: false as const,
  };
}

/**
 * 生成 Recharts Tooltip 配置
 */
export function buildTooltipConfig() {
  const theme = getCurrentTheme();
  return {
    contentStyle: {
      backgroundColor: theme.tooltip,
      border: 'none',
      borderRadius: 6,
      color: '#FFFFFF',
      fontSize: 12,
    },
    itemStyle: {
      color: '#FFFFFF',
    },
    labelStyle: {
      color: 'rgba(255,255,255,0.7)',
    },
  };
}

// ============ 渐变色生成（用于面积图） ============

/**
 * 为面积图生成渐变色 ID（配合 SVG defs 使用）
 * 注意：渐变色需在 SVG 中通过 <linearGradient> 定义
 */
export function generateAreaGradientIds(baseColor: string, count: number): string[] {
  return Array.from({ length: count }, (_, i) => `area-gradient-${i}`);
}

/**
 * 将 hex 颜色转换为 rgba
 */
export function hexToRgba(hex: string, alpha: number = 1): string {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!result) return hex;

  const r = parseInt(result[1], 16);
  const g = parseInt(result[2], 16);
  const b = parseInt(result[3], 16);

  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

/**
 * 生成面积图渐变色定义（SVG <defs>）
 */
export function buildAreaGradients(colors: RechartsColor[]): Array<{ id: string; color: string; rgba: string }> {
  return colors.map((color, i) => ({
    id: `area-gradient-${i}`,
    color,
    rgba: hexToRgba(color, 0.4),
  }));
}
