'use client';

import React, { useState, useEffect } from 'react';
import type { Node } from '@xyflow/react';
import type { XyflowNode } from '@/lib/graph/mermaid-converter';

export interface PropertiesPanelProps {
  selectedNode: Node | null;
  onUpdateNode: (id: string, data: Partial<XyflowNode['data']>) => void;
  onDeleteNode: (id: string) => void;
}

export function PropertiesPanel({ selectedNode, onUpdateNode, onDeleteNode }: PropertiesPanelProps) {
  const [localData, setLocalData] = useState<Record<string, string>>({});

  useEffect(() => {
    if (selectedNode) {
      setLocalData({
        label: (selectedNode.data as { label?: string }).label ?? '',
        description: (selectedNode.data as { description?: string }).description ?? '',
        color: (selectedNode.data as { color?: string }).color ?? '#6366f1',
        textColor: (selectedNode.data as { textColor?: string }).textColor ?? '#ffffff',
      });
    }
  }, [selectedNode]);

  if (!selectedNode) {
    return (
      <div
        style={{
          width: 240,
          borderLeft: '1px solid #e2e8f0',
          background: '#fff',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#94a3b8',
          fontSize: 13,
          padding: 20,
          textAlign: 'center',
        }}
      >
        选择节点以编辑属性
      </div>
    );
  }

  const handleChange = (field: string, value: string) => {
    setLocalData((prev) => ({ ...prev, [field]: value }));
    onUpdateNode(selectedNode.id, { [field]: value });
  };

  return (
    <div
      style={{
        width: 240,
        borderLeft: '1px solid #e2e8f0',
        background: '#fff',
        padding: '16px 12px',
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
        overflowY: 'auto',
      }}
    >
      <div style={{ fontSize: 11, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
        节点属性
      </div>

      {/* Node type badge */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <span style={{ fontSize: 12, color: '#64748b' }}>类型</span>
        <span
          style={{
            padding: '2px 8px',
            borderRadius: 4,
            background: '#f1f5f9',
            color: '#6366f1',
            fontSize: 12,
            fontWeight: 600,
          }}
        >
          {selectedNode.type}
        </span>
      </div>

      {/* Label */}
      <div>
        <label style={{ fontSize: 12, color: '#64748b', display: 'block', marginBottom: 4 }}>标签</label>
        <textarea
          value={localData.label ?? ''}
          onChange={(e) => handleChange('label', e.target.value)}
          rows={2}
          style={{
            width: '100%',
            border: '1px solid #e2e8f0',
            borderRadius: 6,
            padding: '6px 8px',
            fontSize: 13,
            resize: 'vertical',
            fontFamily: 'inherit',
            boxSizing: 'border-box',
          }}
        />
      </div>

      {/* Description */}
      <div>
        <label style={{ fontSize: 12, color: '#64748b', display: 'block', marginBottom: 4 }}>描述</label>
        <textarea
          value={localData.description ?? ''}
          onChange={(e) => handleChange('description', e.target.value)}
          rows={2}
          style={{
            width: '100%',
            border: '1px solid #e2e8f0',
            borderRadius: 6,
            padding: '6px 8px',
            fontSize: 13,
            resize: 'vertical',
            fontFamily: 'inherit',
            boxSizing: 'border-box',
          }}
        />
      </div>

      {/* Colors */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
        <div>
          <label style={{ fontSize: 12, color: '#64748b', display: 'block', marginBottom: 4 }}>填充色</label>
          <input
            type="color"
            value={localData.color ?? '#6366f1'}
            onChange={(e) => handleChange('color', e.target.value)}
            style={{ width: '100%', height: 32, border: '1px solid #e2e8f0', borderRadius: 6, cursor: 'pointer' }}
          />
        </div>
        <div>
          <label style={{ fontSize: 12, color: '#64748b', display: 'block', marginBottom: 4 }}>文字色</label>
          <input
            type="color"
            value={localData.textColor ?? '#ffffff'}
            onChange={(e) => handleChange('textColor', e.target.value)}
            style={{ width: '100%', height: 32, border: '1px solid #e2e8f0', borderRadius: 6, cursor: 'pointer' }}
          />
        </div>
      </div>

      {/* Delete */}
      <button
        onClick={() => onDeleteNode(selectedNode.id)}
        style={{
          marginTop: 8,
          padding: '8px',
          fontSize: 13,
          borderRadius: 6,
          border: '1px solid #fecaca',
          background: '#fef2f2',
          color: '#ef4444',
          cursor: 'pointer',
          fontWeight: 500,
        }}
      >
        删除节点
      </button>
    </div>
  );
}
