/**
 * ChartTypeSelector.tsx
 * 8种图表类型选择器
 */

import React from 'react';
import type { ChartType } from '@/lib/chart-types';

export interface ChartTypeOption {
  value: ChartType;
  label: string;
  icon: string;
  description: string;
}

export const CHART_TYPE_OPTIONS: ChartTypeOption[] = [
  { value: 'bar', label: '柱状图', icon: '📊', description: '比较不同类别的数值大小' },
  { value: 'horizontalBar', label: '条形图', icon: '📉', description: '横向柱状图，适合长类别名' },
  { value: 'line', label: '折线图', icon: '📈', description: '展示数据随时间变化的趋势' },
  { value: 'area', label: '面积图', icon: '🔼', description: '强调数据的累积效果' },
  { value: 'pie', label: '饼图', icon: '🍩', description: '展示各部分占整体的比例' },
  { value: 'radar', label: '雷达图', icon: '🕸️', description: '多维度对比分析' },
  { value: 'funnel', label: '漏斗图', icon: '🔻', description: '展示流程转化情况' },
  { value: 'scatter', label: '散点图', icon: '⚡', description: '展示两个变量的相关性' },
];

interface ChartTypeSelectorProps {
  value: ChartType;
  onChange: (type: ChartType) => void;
}

export function ChartTypeSelector({ value, onChange }: ChartTypeSelectorProps) {
  return (
    <div className="space-y-2">
      <label className="block text-sm font-medium text-gray-700 mb-2">图表类型</label>
      <div className="grid grid-cols-4 gap-2">
        {CHART_TYPE_OPTIONS.map((opt) => (
          <button
            key={opt.value}
            onClick={() => onChange(opt.value)}
            className={`flex flex-col items-center gap-1 p-3 rounded-lg border-2 transition-all text-sm font-medium ${
              value === opt.value
                ? 'border-indigo-500 bg-indigo-50 text-indigo-700'
                : 'border-gray-200 bg-white text-gray-700 hover:border-gray-300 hover:bg-gray-50'
            }`}
            title={opt.description}
          >
            <span className="text-xl">{opt.icon}</span>
            <span>{opt.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}