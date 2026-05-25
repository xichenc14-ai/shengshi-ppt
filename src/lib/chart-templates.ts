/**
 * chart-templates.ts
 * 图表模板配置
 */

import type { ChartDataPoint, ChartType } from './chart-types';

export interface ChartTemplate {
  id: string;
  name: string;
  description: string;
  type: ChartType;
  data: ChartDataPoint[];
}

// ─── Pre-built templates ─────────────────────────────────────

export const CHART_TEMPLATES: ChartTemplate[] = [
  // Bar charts
  {
    id: 'tpl-quarterly-sales',
    name: '季度销售额',
    description: '4个季度的柱状图对比',
    type: 'bar',
    data: [
      { name: 'Q1', value: 120 },
      { name: 'Q2', value: 198 },
      { name: 'Q3', value: 156 },
      { name: 'Q4', value: 245 },
    ],
  },
  {
    id: 'tpl-product-comparison',
    name: '产品对比',
    description: '5个产品的柱状图',
    type: 'bar',
    data: [
      { name: '产品A', value: 340 },
      { name: '产品B', value: 280 },
      { name: '产品C', value: 420 },
      { name: '产品D', value: 195 },
      { name: '产品E', value: 310 },
    ],
  },
  // Line charts
  {
    id: 'tpl-monthly-trend',
    name: '月度趋势',
    description: '12个月的数据趋势折线图',
    type: 'line',
    data: [
      { name: '1月', value: 65 }, { name: '2月', value: 72 }, { name: '3月', value: 80 },
      { name: '4月', value: 78 }, { name: '5月', value: 90 }, { name: '6月', value: 105 },
      { name: '7月', value: 120 }, { name: '8月', value: 115 }, { name: '9月', value: 98 },
      { name: '10月', value: 88 }, { name: '11月', value: 95 }, { name: '12月', value: 110 },
    ],
  },
  // Pie charts
  {
    id: 'tpl-market-share',
    name: '市场份额',
    description: '环形饼图展示市场占比',
    type: 'pie',
    data: [
      { name: '本公司', value: 35 },
      { name: '竞品A', value: 28 },
      { name: '竞品B', value: 20 },
      { name: '其他', value: 17 },
    ],
  },
  {
    id: 'tpl-budget-breakdown',
    name: '预算分配',
    description: '年度预算分配饼图',
    type: 'pie',
    data: [
      { name: '人力成本', value: 40 },
      { name: '研发', value: 25 },
      { name: '营销', value: 20 },
      { name: '运营', value: 10 },
      { name: '其他', value: 5 },
    ],
  },
  // Funnel
  {
    id: 'tpl-sales-funnel',
    name: '销售漏斗',
    description: '从线索到成交的转化漏斗',
    type: 'funnel',
    data: [
      { name: '线索', value: 1000 },
      { name: '商机', value: 600 },
      { name: '报价', value: 350 },
      { name: '谈判', value: 150 },
      { name: '成交', value: 80 },
    ],
  },
  // Radar
  {
    id: 'tpl-competitor-analysis',
    name: '竞品分析',
    description: '多维度竞品对比雷达图',
    type: 'radar',
    data: [
      { name: '性能', value: 85 },
      { name: '价格', value: 70 },
      { name: '服务', value: 90 },
      { name: '质量', value: 80 },
      { name: '交付', value: 75 },
      { name: '创新', value: 95 },
    ],
  },
  // Horizontal bar
  {
    id: 'tpl-region-ranking',
    name: '区域排名',
    description: '各区域业绩排名条形图',
    type: 'horizontalBar',
    data: [
      { name: '华东区', value: 420 },
      { name: '华南区', value: 380 },
      { name: '华西区', value: 290 },
      { name: '华北区', value: 260 },
      { name: '东北区', value: 180 },
    ],
  },
];

/**
 * getTemplate — 根据 ID 获取模板
 */
export function getTemplate(id: string): ChartTemplate | undefined {
  return CHART_TEMPLATES.find((t) => t.id === id);
}

/**
 * getTemplatesByType — 按类型筛选模板
 */
export function getTemplatesByType(type: ChartType): ChartTemplate[] {
  return CHART_TEMPLATES.filter((t) => t.type === type);
}