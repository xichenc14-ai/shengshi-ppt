/**
 * chart-types.ts
 * 图表模块核心类型定义
 */

// ============ Chart Types (recharts) ============

export type ChartType = 'bar' | 'horizontalBar' | 'line' | 'pie' | 'area' | 'scatter' | 'radar' | 'funnel';

export type { ChartType as P3ChartType };

// ============ Chart Data ============

export interface ChartDataPoint {
  name: string;
  value: number;
  color?: string;
  [key: string]: string | number | undefined;
}

/** 单系列数据 */
export interface SingleSeriesData {
  categories: string[];
  series: [{ name: string; data: number[] }];
}

/** 多系列数据 */
export interface MultiSeriesData {
  categories: string[];
  series: Array<{ name: string; data: number[] }>;
}

/** 饼图数据 */
export interface PieSegment {
  name: string;
  value: number;
  color?: string;
}

/** 散点图数据 */
export interface ScatterPoint {
  x: number;
  y: number;
  size?: number;
  label?: string;
}

/** 漏斗图数据 */
export interface FunnelStage {
  name: string;
  value: number;
}

/** 雷达图数据 */
export interface RadarLabels {
  labels: string[];
  series: Array<{ name: string; data: number[] }>;
}

export type ChartData = SingleSeriesData | MultiSeriesData | PieSegment[] | ScatterPoint[] | FunnelStage[] | RadarLabels;

export type ChartDataFormat = 'single' | 'multi' | 'pie' | 'scatter' | 'funnel' | 'radar';

// ============ Chart Config ============

export interface ChartConfig {
  id: string;
  type: ChartType;
  title: string;
  data: ChartDataPoint[];
  width?: number;
  height?: number;
  colors?: string[];
  showLegend?: boolean;
  showGrid?: boolean;
  showTooltip?: boolean;
  showDataLabel?: boolean;
  animationDuration?: number;
  themeId?: string;
}

// Legacy alias
export type ChartConfigLegacy = ChartConfig;

// ============ Validation ============

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

// ============ Data Import ============

export interface ImportedData {
  headers: string[];
  rows: string[][];
  series: Array<{ name: string; data: number[] }>;
  categories: string[];
}

// ============ Theme ============

export interface ThemeColors {
  primary: string;
  accent: string;
  background: string;
  chartColors: string[];
}

// ============ Chart Render Options ============

export interface ChartRenderOptions {
  width: number;
  height: number;
  themeColors: string[];
  showLegend: boolean;
  showGrid: boolean;
  showTooltip: boolean;
  showDataLabel: boolean;
  animationDuration: number;
  scale?: number; // export scale, default 2
}

// ============ Export ============

export type ExportFormat = 'png' | 'jpg' | 'svg' | 'pdf' | 'pptx';

export interface ExportConfig {
  format: ExportFormat;
  quality?: number;
  scale?: number;
  backgroundColor?: string;
  includeTitle?: boolean;
}