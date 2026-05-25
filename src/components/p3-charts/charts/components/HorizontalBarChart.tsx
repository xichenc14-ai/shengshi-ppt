/**
 * HorizontalBarChart.tsx — 条形图组件（水平柱状图）
 * 本质上是 BarChart 组件的 horizontal 模式
 */

import React from 'react';
import BarChartComponent, { DataPoint, BarChartProps } from './BarChart';

export interface HorizontalBarChartProps extends Omit<BarChartProps, 'direction'> {}

const HorizontalBarChart: React.FC<HorizontalBarChartProps> = (props) => {
  return <BarChartComponent {...props} direction="horizontal" />;
};

export default HorizontalBarChart;
