/**
 * src/charts/index.ts — P3 Charts 模块统一入口
 *
 * 渲染管线：recharts → SVG → PNG → PPT 嵌入
 *
 * 使用方式：
 * import { BarChart, parseFile, toChartDataPoints } from '@/components/p3-charts';
 */

// ============ 数据解析层 ============
export {
  parseCSV,
  parseExcel,
  parseSheet,
  parseFile,
  parseNumber,
  toChartDataPoints,
  isExcelFile,
  isCSVFile,
} from './dataParser';
export type {
  ParsedDataRow,
  ParseResult,
  ParseOptions,
} from './dataParser';

// ============ 图表组件层（8种类型）============
export {
  BarChart,
  HorizontalBarChart,
  LineChart,
  PieChart,
  AreaChart,
  RadarChart,
  ScatterChart,
  FunnelChart,
  CHART_TYPE_LABELS,
  CHART_TYPE_COUNT,
} from './components';
export type {
  ChartTypeName,
  DataPoint as ChartDataPoint,
  BarChartProps,
  HorizontalBarChartProps,
  LineChartProps,
  PieChartProps,
  AreaChartProps,
  RadarChartProps,
  ScatterChartProps,
  FunnelChartProps,
} from './components';

// ============ 渲染层 ============
export {
  renderChartToImage,
  downloadChart,
  createOffscreenRenderer,
  validateSVG,
  canvasToBlob,
} from './renderers';
export type {
  RenderOptions,
  RenderResult,
  ChartType,
} from './renderers';

// ============ 主题适配层 ============
export {
  THEME_PRESETS,
  DEFAULT_THEME,
  getCurrentTheme,
  setTheme,
  setCustomTheme,
  getChartColors,
  getPrimaryColor,
  getPieColors,
  getGridColor,
  getTextColor,
  getSubtextColor,
  getTooltipBgColor,
  getPositiveColor,
  getNegativeColor,
  buildChartStyle,
  buildGridConfig,
  buildAxisConfig,
  buildTooltipConfig,
  buildAreaGradients,
  hexToRgba,
} from './themeAdapter';
export type {
  ThemeName,
  ThemeColorSet,
  ChartStyleConfig,
} from './themeAdapter';
