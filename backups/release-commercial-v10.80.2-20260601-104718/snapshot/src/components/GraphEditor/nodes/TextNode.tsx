'use client';

import React, { memo } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';

interface NodeData {
  label: string;
  color?: string;
  textColor?: string;
}

export const TextNode = memo(({ data, selected }: NodeProps) => {
  const d = data as unknown as NodeData;
  const textColor = d.textColor ?? d.color ?? '#374151';
  const bgColor = selected ? '#f1f5f9' : 'transparent';

  return (
    <div
      style={{
        background: bgColor,
        padding: '8px 16px',
        minWidth: 80,
        textAlign: 'center',
        border: selected ? '2px dashed #94a3b8' : '2px dashed transparent',
        borderRadius: 4,
      }}
    >
      <Handle type="target" position={Position.Left} style={{ background: '#94a3b8' }} />
      <span
        style={{
          color: textColor,
          fontSize: 16,
          fontWeight: 700,
          whiteSpace: 'pre-line',
        }}
      >
        {d.label}
      </span>
      <Handle type="source" position={Position.Right} style={{ background: '#94a3b8' }} />
    </div>
  );
});
TextNode.displayName = 'TextNode';
