/**
 * ChartEditor/index.tsx
 * 图表编辑器主组件
 * 集成 ChartTypeSelector / DataInputPanel / ChartPreview
 */

'use client';

import React, { useState, useCallback } from 'react';
import { ChartTypeSelector } from './ChartTypeSelector';
import { DataInputPanel } from './DataInputPanel';
import { ChartPreview } from './ChartPreview';
import type { ChartType, ChartDataPoint, ChartConfig } from '@/lib/chart-types';
import { getThemeTokens } from '@/lib/theme/getThemeTokens';
import { nanoid } from 'nanoid';

interface ChartEditorProps {
  initialConfig?: Partial<ChartConfig>;
  onSave: (config: ChartConfig) => void;
  onCancel: () => void;
}

export function ChartEditor({ initialConfig, onSave, onCancel }: ChartEditorProps) {
  const [type, setType] = useState<ChartType>((initialConfig?.type as ChartType) ?? 'bar');
  const [title, setTitle] = useState(initialConfig?.title ?? '');
  const [data, setData] = useState<ChartDataPoint[]>(initialConfig?.data ?? []);
  const [showLegend, setShowLegend] = useState(initialConfig?.showLegend ?? true);
  const [showGrid, setShowGrid] = useState(initialConfig?.showGrid ?? true);
  const [showTooltip, setShowTooltip] = useState(initialConfig?.showTooltip ?? true);
  const [showDataLabel, setShowDataLabel] = useState(initialConfig?.showDataLabel ?? false);
  const [activeTab, setActiveTab] = useState<'data' | 'options'>('data');

  const themeId = initialConfig?.themeId;
  const themeColors = themeId ? getThemeTokens(themeId).chartColors : undefined;
  const palette = themeColors ?? [
    '#4F46E5', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6',
    '#06B6D4', '#84CC16', '#F97316', '#EC4899', '#6366F1',
  ];

  const handleSave = useCallback(() => {
    const config: ChartConfig = {
      id: initialConfig?.id ?? `chart-${nanoid(6)}`,
      type,
      title,
      data,
      colors: palette,
      showLegend,
      showGrid,
      showTooltip,
      showDataLabel,
      animationDuration: 500,
      themeId: initialConfig?.themeId,
    };
    onSave(config);
  }, [type, title, data, palette, showLegend, showGrid, showTooltip, showDataLabel, initialConfig, onSave]);

  const inputStyle = 'w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500';
  const labelStyle = 'block text-sm font-medium text-gray-700 mb-1';

  return (
    <div className="bg-white rounded-xl shadow-lg p-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-bold text-gray-800">图表编辑器</h2>
        <button onClick={onCancel} className="text-gray-400 hover:text-gray-600 text-xl">✕</button>
      </div>

      <div className="mb-5">
        <label className={labelStyle}>图表标题</label>
        <input
          className={inputStyle}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="输入图表标题（可选）"
        />
      </div>

      <div className="mb-6">
        <ChartTypeSelector value={type} onChange={setType} />
      </div>

      <div className="flex gap-1 mb-4 bg-gray-100 rounded-lg p-1">
        {(['data', 'options'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`flex-1 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              activeTab === tab
                ? 'bg-white text-indigo-700 shadow-sm'
                : 'text-gray-600 hover:text-gray-800'
            }`}
          >
            {tab === 'data' ? '📊 数据' : '⚙️ 选项'}
          </button>
        ))}
      </div>

      {activeTab === 'data' && (
        <div>
          <DataInputPanel value={data} onChange={setData} chartType={type} />

          {data.length > 0 && (
            <div className="mt-6">
              <label className={labelStyle}>实时预览</label>
              <div className="border border-gray-200 rounded-lg p-4 bg-gray-50">
                <ChartPreview
                  type={type}
                  data={data}
                  colors={palette}
                  title={title}
                  showLegend={showLegend}
                  showGrid={showGrid}
                  showTooltip={showTooltip}
                  showDataLabel={showDataLabel}
                  height={300}
                />
              </div>
            </div>
          )}
        </div>
      )}

      {activeTab === 'options' && (
        <div className="space-y-4">
          <div>
            <label className={labelStyle}>显示选项</label>
            <div className="space-y-2">
              {[
                { label: '显示图例', value: showLegend, setter: setShowLegend },
                { label: '显示网格线', value: showGrid, setter: setShowGrid },
                { label: '显示悬停提示', value: showTooltip, setter: setShowTooltip },
                { label: '显示数据标签', value: showDataLabel, setter: setShowDataLabel },
              ].map(({ label, value, setter }) => (
                <label key={label} className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={value}
                    onChange={(e) => setter(e.target.checked)}
                    className="rounded text-indigo-600"
                  />
                  <span className="text-sm text-gray-700">{label}</span>
                </label>
              ))}
            </div>
          </div>
        </div>
      )}

      <div className="flex gap-3 justify-end mt-6 pt-4 border-t border-gray-100">
        <button
          onClick={onCancel}
          className="px-5 py-2 bg-gray-100 text-gray-700 rounded-lg text-sm hover:bg-gray-200"
        >
          取消
        </button>
        <button
          onClick={handleSave}
          className="px-5 py-2 bg-indigo-600 text-white rounded-lg text-sm hover:bg-indigo-700 font-medium"
        >
          保存图表
        </button>
      </div>
    </div>
  );
}