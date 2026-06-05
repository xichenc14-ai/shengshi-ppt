/**
 * components/index.ts — 8种图表类型统一出口
 */

export { default as BarChart } from './BarChart';
export type { DataPoint, BarChartProps } from './BarChart';

export { default as HorizontalBarChart } from './HorizontalBarChart';
export type { HorizontalBarChartProps } from './HorizontalBarChart';

export { default as LineChart } from './LineChart';
export type { DataPoint as LineDataPoint, LineChartProps } from './LineChart';

export { default as PieChart } from './PieChart';
export type { DataPoint as PieDataPoint, PieChartProps } from './PieChart';

export { default as AreaChart } from './AreaChart';
export type { DataPoint as AreaDataPoint, AreaChartProps } from './AreaChart';

export { default as RadarChart } from './RadarChart';
export type { DataPoint as RadarDataPoint, RadarChartProps } from './RadarChart';

export { default as ScatterChart } from './ScatterChart';
export type { DataPoint as ScatterDataPoint, ScatterChartProps } from './ScatterChart';

export { default as FunnelChart } from './FunnelChart';
export type { DataPoint as FunnelDataPoint, FunnelChartProps } from './FunnelChart';

// ============ 统一图表类型映射 ============

export type ChartTypeName =
  | 'bar'
  | 'horizontalBar'
  | 'line'
  | 'pie'
  | 'area'
  | 'radar'
  | 'scatter'
  | 'funnel';

export const CHART_TYPE_LABELS: Record<ChartTypeName, string> = {
  bar: '柱状图',
  horizontalBar: '条形图',
  line: '折线图',
  pie: '饼图',
  area: '面积图',
  radar: '雷达图',
  scatter: '散点图',
  funnel: '漏斗图',
};

export const CHART_TYPE_COUNT = 8;
