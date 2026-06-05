'use client';

import React from 'react';

export interface ToolbarProps {
  themeColor: string;
  onThemeColorChange: (color: string) => void;
  onExport: () => void;
  onPreview: () => void;
  onClear: () => void;
  isExporting?: boolean;
  direction: 'TB' | 'BT' | 'LR' | 'RL';
  onDirectionChange: (d: 'TB' | 'BT' | 'LR' | 'RL') => void;
}

const PRESET_COLORS = [
  '#6366f1', '#8b5cf6', '#a78bfa', '#ec4899',
  '#ef4444', '#f59e0b', '#10b981', '#3b82f6',
  '#64748b', '#1e293b',
];

export function GraphToolbar({
  themeColor,
  onThemeColorChange,
  onExport,
  onPreview,
  onClear,
  isExporting,
  direction,
  onDirectionChange,
}: ToolbarProps) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        padding: '8px 16px',
        background: '#fff',
        borderBottom: '1px solid #e2e8f0',
        flexWrap: 'wrap',
      }}
    >
      {/* Theme color */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <span style={{ fontSize: 12, color: '#64748b', fontWeight: 500 }}>主题色</span>
        <div style={{ display: 'flex', gap: 4 }}>
          {PRESET_COLORS.map((c) => (
            <button
              key={c}
              onClick={() => onThemeColorChange(c)}
              style={{
                width: 24,
                height: 24,
                borderRadius: '50%',
                background: c,
                border: themeColor === c ? '3px solid #1e293b' : '2px solid transparent',
                cursor: 'pointer',
                padding: 0,
              }}
              title={c}
            />
          ))}
        </div>
        <input
          type="color"
          value={themeColor}
          onChange={(e) => onThemeColorChange(e.target.value)}
          style={{ width: 28, height: 28, border: '1px solid #e2e8f0', borderRadius: 4, cursor: 'pointer' }}
        />
      </div>

      <div style={{ width: 1, height: 24, background: '#e2e8f0' }} />

      {/* Direction */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <span style={{ fontSize: 12, color: '#64748b', fontWeight: 500 }}>方向</span>
        {(['LR', 'RL', 'TB', 'BT'] as const).map((d) => (
          <button
            key={d}
            onClick={() => onDirectionChange(d)}
            style={{
              padding: '4px 8px',
              fontSize: 12,
              borderRadius: 4,
              border: direction === d ? '2px solid #6366f1' : '1px solid #e2e8f0',
              background: direction === d ? '#eef2ff' : '#fff',
              color: direction === d ? '#6366f1' : '#64748b',
              cursor: 'pointer',
              fontWeight: 500,
            }}
          >
            {d}
          </button>
        ))}
      </div>

      <div style={{ width: 1, height: 24, background: '#e2e8f0' }} />

      {/* Actions */}
      <button
        onClick={onClear}
        style={{
          padding: '6px 14px',
          fontSize: 13,
          borderRadius: 6,
          border: '1px solid #e2e8f0',
          background: '#fff',
          color: '#64748b',
          cursor: 'pointer',
          fontWeight: 500,
        }}
      >
        清空
      </button>
      <button
        onClick={onPreview}
        style={{
          padding: '6px 14px',
          fontSize: 13,
          borderRadius: 6,
          border: '1px solid #8b5cf6',
          background: '#f5f3ff',
          color: '#8b5cf6',
          cursor: 'pointer',
          fontWeight: 500,
        }}
      >
        预览 Mermaid
      </button>
      <button
        onClick={onExport}
        disabled={isExporting}
        style={{
          padding: '6px 16px',
          fontSize: 13,
          borderRadius: 6,
          border: 'none',
          background: isExporting ? '#cbd5e1' : '#6366f1',
          color: '#fff',
          cursor: isExporting ? 'not-allowed' : 'pointer',
          fontWeight: 600,
        }}
      >
        {isExporting ? '导出中...' : '导出 PNG'}
      </button>
    </div>
  );
}
