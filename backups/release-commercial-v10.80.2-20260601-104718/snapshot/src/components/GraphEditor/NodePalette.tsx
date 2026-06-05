'use client';

import React from 'react';
import type { NodeShape } from '@/lib/graph/mermaid-converter';

export interface NodePaletteProps {
  onAddNode: (type: NodeShape) => void;
  themeColor: string;
}

interface NodeOption {
  type: NodeShape;
  label: string;
  color: string;
  icon: React.ReactNode;
}

const NODE_OPTIONS: NodeOption[] = [
  {
    type: 'rect',
    label: '矩形',
    color: '#6366f1',
    icon: (
      <svg width="40" height="24" viewBox="0 0 40 24">
        <rect x="1" y="1" width="38" height="22" rx="4" fill="#6366f1" />
      </svg>
    ),
  },
  {
    type: 'diamond',
    label: '菱形',
    color: '#f59e0b',
    icon: (
      <svg width="32" height="32" viewBox="0 0 32 32">
        <polygon points="16,2 30,16 16,30 2,16" fill="#f59e0b" />
      </svg>
    ),
  },
  {
    type: 'circle',
    label: '圆形',
    color: '#10b981',
    icon: (
      <svg width="32" height="32" viewBox="0 0 32 32">
        <circle cx="16" cy="16" r="14" fill="#10b981" />
      </svg>
    ),
  },
  {
    type: 'cylinder',
    label: '圆柱',
    color: '#8b5cf6',
    icon: (
      <svg width="32" height="40" viewBox="0 0 32 40">
        <rect x="2" y="8" width="28" height="28" rx="4" fill="#8b5cf6" />
        <ellipse cx="16" cy="8" rx="14" ry="5" fill="#8b5cf6" opacity="0.7" />
        <ellipse cx="16" cy="36" rx="14" ry="5" fill="#8b5cf6" />
      </svg>
    ),
  },
  {
    type: 'parallelogram',
    label: '平行四边形',
    color: '#3b82f6',
    icon: (
      <svg width="40" height="24" viewBox="0 0 40 24">
        <polygon points="6,0 40,0 34,24 0,24" fill="#3b82f6" />
      </svg>
    ),
  },
  {
    type: 'hexagon',
    label: '六边形',
    color: '#ec4899',
    icon: (
      <svg width="40" height="28" viewBox="0 0 40 28">
        <polygon points="8,0 32,0 40,14 32,28 8,28 0,14" fill="#ec4899" />
      </svg>
    ),
  },
  {
    type: 'subroutine',
    label: '子程序',
    color: '#64748b',
    icon: (
      <svg width="40" height="28" viewBox="0 0 40 28">
        <rect x="8" y="0" width="24" height="6" rx="2" fill="#64748b" />
        <rect x="1" y="6" width="38" height="20" rx="3" fill="#64748b" />
      </svg>
    ),
  },
  {
    type: 'text',
    label: '文本',
    color: '#374151',
    icon: (
      <svg width="40" height="20" viewBox="0 0 40 20">
        <text x="4" y="15" fontSize="13" fontWeight="700" fill="#374151">文字</text>
      </svg>
    ),
  },
];

export function NodePalette({ onAddNode, themeColor }: NodePaletteProps) {
  void themeColor;
  return (
    <div
      style={{
        width: 160,
        borderRight: '1px solid #e2e8f0',
        background: '#fff',
        padding: '12px 8px',
        display: 'flex',
        flexDirection: 'column',
        gap: 4,
        overflowY: 'auto',
      }}
    >
      <div style={{ fontSize: 11, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.08em', padding: '0 4px 8px' }}>
        节点类型
      </div>
      {NODE_OPTIONS.map((opt) => (
        <button
          key={opt.type}
          onClick={() => onAddNode(opt.type)}
          title={`添加 ${opt.label}`}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            padding: '8px 10px',
            borderRadius: 6,
            border: '1px solid #f1f5f9',
            background: '#fafafa',
            cursor: 'pointer',
            textAlign: 'left',
            transition: 'all 0.15s',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = '#f1f5f9';
            e.currentTarget.style.borderColor = opt.color + '55';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = '#fafafa';
            e.currentTarget.style.borderColor = '#f1f5f9';
          }}
        >
          {opt.icon}
          <span style={{ fontSize: 13, color: '#475569', fontWeight: 500 }}>{opt.label}</span>
        </button>
      ))}

      <div style={{ fontSize: 11, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.08em', padding: '12px 4px 6px', borderTop: '1px solid #f1f5f9', marginTop: 4 }}>
        提示
      </div>
      <div style={{ fontSize: 11, color: '#94a3b8', padding: '0 4px', lineHeight: 1.6 }}>
        点击节点添加到画布，从一个节点的连接点拖拽到另一个节点即可连线。
      </div>
    </div>
  );
}
