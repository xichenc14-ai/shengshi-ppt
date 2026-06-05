'use client';

import React, { useState, useCallback } from 'react';
import type { ChartConfig, ChartType, ChartDataPoint } from '../types';

interface ChartEditorProps {
  initialConfig: ChartConfig;
  onSave: (config: ChartConfig) => void;
  onCancel: () => void;
}

const CHART_TYPES: { value: ChartType; label: string }[] = [
  { value: 'bar', label: '柱状图' },
  { value: 'line', label: '折线图' },
  { value: 'area', label: '面积图' },
  { value: 'pie', label: '饼图' },
  { value: 'scatter', label: '散点图' },
  { value: 'radar', label: '雷达图' },
  { value: 'funnel', label: '漏斗图' },
];

const PRESET_PALETTES = [
  ['#4F46E5', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6'],
  ['#6366F1', '#8B5CF6', '#A855F7', '#D946EF', '#EC4899'],
  ['#06B6D4', '#0EA5E9', '#3B82F6', '#6366F1', '#8B5CF6'],
  ['#84CC16', '#22C55E', '#10B981', '#14B8A6', '#06B6D4'],
  ['#F97316', '#EF4444', '#DC2626', '#B91C1C', '#991B1B'],
];

export function ChartEditor({ initialConfig, onSave, onCancel }: ChartEditorProps) {
  const [config, setConfig] = useState<ChartConfig>(initialConfig);
  const [newPointName, setNewPointName] = useState('');
  const [newPointValue, setNewPointValue] = useState('');

  const update = (patch: Partial<ChartConfig>) => setConfig((c) => ({ ...c, ...patch }));

  const addDataPoint = useCallback(() => {
    if (!newPointName.trim() || !newPointValue) return;
    const newPoint: ChartDataPoint = { name: newPointName.trim(), value: Number(newPointValue) };
    update({ data: [...config.data, newPoint] });
    setNewPointName('');
    setNewPointValue('');
  }, [newPointName, newPointValue, config.data]);

  const removeDataPoint = (index: number) => {
    update({ data: config.data.filter((_, i) => i !== index) });
  };

  const handleSave = () => {
    onSave(config);
  };

  const inputStyle = 'w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500';
  const labelStyle = 'block text-sm font-medium text-gray-700 mb-1';

  return (
    <div className="bg-white rounded-xl shadow-lg p-6 max-w-2xl mx-auto">
      <h2 className="text-xl font-bold text-gray-800 mb-6">图表编辑器</h2>

      {/* Basic Info */}
      <div className="space-y-4 mb-6">
        <div>
          <label className={labelStyle}>图表标题</label>
          <input
            className={inputStyle}
            value={config.title}
            onChange={(e) => update({ title: e.target.value })}
            placeholder="输入图表标题"
          />
        </div>
        <div>
          <label className={labelStyle}>图表类型</label>
          <div className="grid grid-cols-4 gap-2">
            {CHART_TYPES.map((t) => (
              <button
                key={t.value}
                onClick={() => update({ type: t.value })}
                className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                  config.type === t.value
                    ? 'bg-indigo-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Data Points */}
      <div className="mb-6">
        <label className={labelStyle}>数据点</label>
        <div className="border border-gray-200 rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-3 py-2 text-left text-gray-600 font-medium">名称</th>
                <th className="px-3 py-2 text-left text-gray-600 font-medium">数值</th>
                <th className="px-3 py-2 w-12"></th>
              </tr>
            </thead>
            <tbody>
              {config.data.map((point, i) => (
                <tr key={i} className="border-t border-gray-100">
                  <td className="px-3 py-2 text-gray-800">{point.name}</td>
                  <td className="px-3 py-2 text-gray-800">{point.value}</td>
                  <td className="px-3 py-2">
                    <button
                      onClick={() => removeDataPoint(i)}
                      className="text-red-500 hover:text-red-700 text-xs"
                    >
                      删除
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Add new data point */}
        <div className="flex gap-2 mt-3">
          <input
            className={`${inputStyle} flex-1`}
            placeholder="名称"
            value={newPointName}
            onChange={(e) => setNewPointName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && addDataPoint()}
          />
          <input
            className={`${inputStyle} w-24`}
            type="number"
            placeholder="数值"
            value={newPointValue}
            onChange={(e) => setNewPointValue(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && addDataPoint()}
          />
          <button
            onClick={addDataPoint}
            className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm hover:bg-indigo-700"
          >
            添加
          </button>
        </div>
      </div>

      {/* Color Palette */}
      <div className="mb-6">
        <label className={labelStyle}>配色方案</label>
        <div className="grid grid-cols-5 gap-2">
          {PRESET_PALETTES.map((palette, i) => (
            <button
              key={i}
              onClick={() => update({ colors: palette })}
              className="flex h-8 rounded overflow-hidden border-2 transition-all"
              style={{ borderColor: config.colors?.join(',') === palette.join(',') ? '#4F46E5' : 'transparent' }}
            >
              {palette.map((color, j) => (
                <div key={j} style={{ background: color, flex: 1 }} />
              ))}
            </button>
          ))}
        </div>
      </div>

      {/* Options */}
      <div className="mb-6">
        <label className={labelStyle}>显示选项</label>
        <div className="flex gap-4">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={config.showLegend ?? true}
              onChange={(e) => update({ showLegend: e.target.checked })}
              className="rounded text-indigo-600"
            />
            <span className="text-sm text-gray-700">图例</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={config.showGrid ?? true}
              onChange={(e) => update({ showGrid: e.target.checked })}
              className="rounded text-indigo-600"
            />
            <span className="text-sm text-gray-700">网格线</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={config.showTooltip ?? true}
              onChange={(e) => update({ showTooltip: e.target.checked })}
              className="rounded text-indigo-600"
            />
            <span className="text-sm text-gray-700">悬停提示</span>
          </label>
        </div>
      </div>

      {/* Actions */}
      <div className="flex gap-3 justify-end">
        <button
          onClick={onCancel}
          className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg text-sm hover:bg-gray-200"
        >
          取消
        </button>
        <button
          onClick={handleSave}
          className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm hover:bg-indigo-700"
        >
          保存图表
        </button>
      </div>
    </div>
  );
}

export default ChartEditor;
