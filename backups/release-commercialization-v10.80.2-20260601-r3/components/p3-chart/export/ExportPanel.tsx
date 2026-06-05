'use client';

import React, { useState, useCallback } from 'react';
import type { ExportConfig, ExportFormat } from '../types';

interface ExportPanelProps {
  title: string;
  onExport: (config: ExportConfig) => Promise<void>;
  onClose: () => void;
}

const FORMAT_OPTIONS: { value: ExportFormat; label: string; desc: string }[] = [
  { value: 'png', label: 'PNG', desc: '无损图片，适合高质量导出' },
  { value: 'jpg', label: 'JPG', desc: '压缩图片，体积更小' },
  { value: 'svg', label: 'SVG', desc: '矢量图，可无限缩放' },
  { value: 'pdf', label: 'PDF', desc: '适合打印和文档嵌入' },
  { value: 'pptx', label: 'PPTX', desc: '可导入 PowerPoint 编辑' },
];

export function ExportPanel({ title, onExport, onClose }: ExportPanelProps) {
  const [format, setFormat] = useState<ExportFormat>('png');
  const [quality, setQuality] = useState(90);
  const [scale, setScale] = useState(2);
  const [includeTitle, setIncludeTitle] = useState(true);
  const [backgroundColor, setBackgroundColor] = useState('#ffffff');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleExport = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      await onExport({ format, quality, scale, backgroundColor, includeTitle });
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : '导出失败');
    } finally {
      setLoading(false);
    }
  }, [format, quality, scale, backgroundColor, includeTitle, onExport]);

  const inputStyle = 'w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500';
  const labelStyle = 'block text-sm font-medium text-gray-700 mb-1';

  return (
    <div className="bg-white rounded-xl shadow-lg p-6 max-w-md mx-auto">
      <h2 className="text-xl font-bold text-gray-800 mb-1">{title}</h2>
      <p className="text-sm text-gray-500 mb-6">选择导出格式和参数</p>

      {/* Format */}
      <div className="mb-5">
        <label className={labelStyle}>导出格式</label>
        <div className="space-y-2">
          {FORMAT_OPTIONS.map((opt) => (
            <label
              key={opt.value}
              className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                format === opt.value
                  ? 'border-indigo-500 bg-indigo-50'
                  : 'border-gray-200 hover:bg-gray-50'
              }`}
            >
              <input
                type="radio"
                name="format"
                value={opt.value}
                checked={format === opt.value}
                onChange={() => setFormat(opt.value)}
                className="text-indigo-600"
              />
              <div>
                <span className="text-sm font-medium text-gray-800">{opt.label}</span>
                <span className="text-xs text-gray-500 ml-2">{opt.desc}</span>
              </div>
            </label>
          ))}
        </div>
      </div>

      {/* Quality (for jpg/png) */}
      {(format === 'jpg' || format === 'png') && (
        <div className="mb-5">
          <label className={labelStyle}>图片质量: {quality}%</label>
          <input
            type="range"
            min="10"
            max="100"
            step="5"
            value={quality}
            onChange={(e) => setQuality(parseInt(e.target.value))}
            className="w-full"
          />
          <div className="flex justify-between text-xs text-gray-400">
            <span>低质量</span>
            <span>高质量</span>
          </div>
        </div>
      )}

      {/* Scale */}
      <div className="mb-5">
        <label className={labelStyle}>导出分辨率: {scale}x</label>
        <input
          type="range"
          min="1"
          max="4"
          step="0.5"
          value={scale}
          onChange={(e) => setScale(parseFloat(e.target.value))}
          className="w-full"
        />
        <div className="flex justify-between text-xs text-gray-400">
          <span>1x (标准)</span>
          <span>4x (超高清)</span>
        </div>
      </div>

      {/* Background Color */}
      <div className="mb-5">
        <label className={labelStyle}>背景颜色</label>
        <div className="flex gap-3">
          <input
            type="color"
            value={backgroundColor}
            onChange={(e) => setBackgroundColor(e.target.value)}
            className="w-12 h-10 rounded cursor-pointer border border-gray-300"
          />
          <input
            className={`${inputStyle} flex-1`}
            value={backgroundColor}
            onChange={(e) => setBackgroundColor(e.target.value)}
            placeholder="#ffffff"
          />
        </div>
      </div>

      {/* Include Title */}
      <div className="mb-6">
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={includeTitle}
            onChange={(e) => setIncludeTitle(e.target.checked)}
            className="rounded text-indigo-600"
          />
          <span className="text-sm text-gray-700">导出时包含标题</span>
        </label>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-600 text-sm">
          {error}
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-3 justify-end">
        <button
          onClick={onClose}
          className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg text-sm hover:bg-gray-200"
        >
          取消
        </button>
        <button
          onClick={handleExport}
          disabled={loading}
          className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm hover:bg-indigo-700 disabled:opacity-50 flex items-center gap-2"
        >
          {loading && <div className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full" />}
          {loading ? '导出中...' : `导出 ${format.toUpperCase()}`}
        </button>
      </div>
    </div>
  );
}

export default ExportPanel;
