'use client';

import React, { memo } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';

interface NodeData {
  label: string;
  description?: string;
  color?: string;
  fill?: string;
  stroke?: string;
  textColor?: string;
}

export const RectNode = memo(({ data, selected }: NodeProps) => {
  const d = data as unknown as NodeData;
  const fill = d.fill ?? d.color ?? '#6366f1';
  const stroke = d.stroke ?? d.color ?? '#6366f1';
  const textColor = d.textColor ?? '#ffffff';

  return (
    <div
      style={{
        background: fill,
        border: `2px solid ${stroke}`,
        borderRadius: 8,
        padding: '12px 20px',
        minWidth: 120,
        textAlign: 'center',
        boxShadow: selected ? `0 0 0 3px ${stroke}55` : `0 2px 8px rgba(0,0,0,0.1)`,
      }}
    >
      <Handle type="target" position={Position.Left} style={{ background: stroke }} />
      <span style={{ color: textColor, fontWeight: 600, fontSize: 14, whiteSpace: 'pre-line' }}>
        {d.label}
      </span>
      <Handle type="source" position={Position.Right} style={{ background: stroke }} />
    </div>
  );
});
RectNode.displayName = 'RectNode';
