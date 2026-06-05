/**
 * DataInputPanel.tsx
 * 数据录入面板：手动录入 / Excel粘贴 / CSV导入
 */

'use client';

import React, { useState, useCallback, useRef } from 'react';
import { parseExcel, parseCSV } from '@/lib/data-import';
import type { ChartDataPoint } from '@/lib/chart-types';

interface DataInputPanelProps {
  value: ChartDataPoint[];
  onChange: (data: ChartDataPoint[]) => void;
  chartType: string;
}

type InputMode = 'manual' | 'excel' | 'csv';

export function DataInputPanel({ value, onChange, chartType }: DataInputPanelProps) {
  const [mode, setMode] = useState<InputMode>('manual');
  const [excelText, setExcelText] = useState('');
  const [csvText, setCSVText] = useState('');
  const [error, setError] = useState('');
  const [importInfo, setImportInfo] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  // ── Manual entry ────────────────────────────────────────────

  const [newName, setNewName] = useState('');
  const [newValue, setNewValue] = useState('');

  const addPoint = useCallback(() => {
    if (!newName.trim() || !newValue) return;
    onChange([...value, { name: newName.trim(), value: Number(newValue) }]);
    setNewName('');
    setNewValue('');
  }, [newName, newValue, value, onChange]);

  const removePoint = (i: number) => onChange(value.filter((_, idx) => idx !== i));

  // ── Excel paste ────────────────────────────────────────────

  const handleExcelPaste = useCallback(async () => {
    setError('');
    try {
      const result = await parseExcel(excelText);
      const points = result.categories.map((cat, i) => ({
        name: cat,
        value: result.series[0]?.data[i] ?? 0,
      }));
      onChange(points);
      setImportInfo(`已导入 ${result.categories.length} 行，${result.series.length} 个系列`);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Excel 解析失败';
      setError(message);
    }
  }, [excelText, onChange]);

  // ── CSV import ─────────────────────────────────────────────

  const handleCSVImport = useCallback(() => {
    setError('');
    try {
      const result = parseCSV(csvText);
      const points = result.categories.map((cat, i) => ({
        name: cat,
        value: result.series[0]?.data[i] ?? 0,
      }));
      onChange(points);
      setImportInfo(`已导入 ${result.categories.length} 行数据`);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'CSV 解析失败';
      setError(message);
    }
  }, [csvText, onChange]);

  // ── File import ─────────────────────────────────────────────

  const handleFileChange = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setError('');
    try {
      const text = await file.text();
      if (file.name.endsWith('.csv')) {
        const result = parseCSV(text);
        const points = result.categories.map((cat, i) => ({
          name: cat,
          value: result.series[0]?.data[i] ?? 0,
        }));
        onChange(points);
        setImportInfo(`已导入 ${result.categories.length} 行`);
      } else {
        const result = await parseExcel(text);
        const points = result.categories.map((cat, i) => ({
          name: cat,
          value: result.series[0]?.data[i] ?? 0,
        }));
        onChange(points);
        setImportInfo(`已导入 ${result.categories.length} 行，${result.series.length} 个系列`);
      }
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : '文件解析失败';
      setError(message);
    }
    // reset file input
    if (fileRef.current) fileRef.current.value = '';
  }, [onChange]);

  const inputStyle = 'w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500';
  const labelStyle = 'block text-sm font-medium text-gray-700 mb-1';
  const MODE_TABS: { key: InputMode; label: string }[] = [
    { key: 'manual', label: '📝 手动录入' },
    { key: 'excel', label: '📋 Excel粘贴' },
    { key: 'csv', label: '📁 CSV导入' },
  ];

  return (
    <div className="space-y-4">
      <div>
        <label className={labelStyle}>数据录入方式</label>
        <div className="flex gap-1 bg-gray-100 rounded-lg p-1">
          {MODE_TABS.map((tab) => (
            <button
              key={tab.key}
              onClick={() => { setMode(tab.key); setError(''); setImportInfo(''); }}
              className={`flex-1 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                mode === tab.key
                  ? 'bg-white text-indigo-700 shadow-sm'
                  : 'text-gray-600 hover:text-gray-800'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Manual ── */}
      {mode === 'manual' && (
        <div className="space-y-3">
          {/* chartType 保留为后续类型特化入口，避免被 tree-shaking 误删 */}
          {chartType ? null : null}
          <div className="border border-gray-200 rounded-lg overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-3 py-2 text-left text-gray-600 font-medium">名称</th>
                  <th className="px-3 py-2 text-left text-gray-600 font-medium">数值</th>
                  <th className="px-3 py-2 w-10"></th>
                </tr>
              </thead>
              <tbody>
                {value.map((pt, i) => (
                  <tr key={i} className="border-t border-gray-100">
                    <td className="px-3 py-2 text-gray-800">{pt.name}</td>
                    <td className="px-3 py-2 text-gray-800">{pt.value}</td>
                    <td className="px-3 py-2 text-center">
                      <button onClick={() => removePoint(i)} className="text-red-400 hover:text-red-600 text-xs">✕</button>
                    </td>
                  </tr>
                ))}
                {value.length === 0 && (
                  <tr>
                    <td colSpan={3} className="px-3 py-6 text-center text-gray-400 text-xs">
                      暂无数据，请添加数据点
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <div className="flex gap-2">
            <input
              className={`${inputStyle} flex-1`}
              placeholder="名称"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && addPoint()}
            />
            <input
              className={`${inputStyle} w-28`}
              type="number"
              placeholder="数值"
              value={newValue}
              onChange={(e) => setNewValue(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && addPoint()}
            />
            <button
              onClick={addPoint}
              className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm hover:bg-indigo-700 whitespace-nowrap"
            >
              添加
            </button>
          </div>
        </div>
      )}

      {/* ── Excel paste ── */}
      {mode === 'excel' && (
        <div className="space-y-3">
          <p className="text-xs text-gray-500">从 Excel 复制数据（包含列标题），在此粘贴。第一列为名称，第二列为数值。</p>
          <textarea
            className={`${inputStyle} h-32 font-mono text-xs`}
            placeholder={`名称\t数值\n产品A\t120\n产品B\t240\n产品C\t180`}
            value={excelText}
            onChange={(e) => setExcelText(e.target.value)}
          />
          <button
            onClick={handleExcelPaste}
            className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm hover:bg-indigo-700"
          >
            解析数据
          </button>
        </div>
      )}

      {/* ── CSV import ── */}
      {mode === 'csv' && (
        <div className="space-y-3">
          <div className="flex gap-3">
            <button
              onClick={() => fileRef.current?.click()}
              className="px-4 py-2 bg-white border border-gray-300 text-gray-700 rounded-lg text-sm hover:bg-gray-50"
            >
              选择文件
            </button>
            <input ref={fileRef} type="file" accept=".csv,.xlsx,.xls" className="hidden" onChange={handleFileChange} />
            <span className="text-xs text-gray-400 self-center">支持 .csv .xlsx .xls</span>
          </div>
          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-gray-200" />
            </div>
            <div className="relative flex justify-center text-xs">
              <span className="px-2 bg-white text-gray-400">或粘贴 CSV 文本</span>
            </div>
          </div>
          <textarea
            className={`${inputStyle} h-32 font-mono text-xs`}
            placeholder={`名称,数值\n产品A,120\n产品B,240`}
            value={csvText}
            onChange={(e) => setCSVText(e.target.value)}
          />
          {csvText && (
            <button
              onClick={handleCSVImport}
              className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm hover:bg-indigo-700"
            >
              解析 CSV
            </button>
          )}
        </div>
      )}

      {/* ── Status ── */}
      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-600 text-sm">{error}</div>
      )}
      {importInfo && (
        <div className="p-3 bg-green-50 border border-green-200 rounded-lg text-green-700 text-sm">{importInfo}</div>
      )}
    </div>
  );
}
