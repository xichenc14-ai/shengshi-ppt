'use client';

import React, { memo } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';

interface NodeData {
  label: string;
  color?: string;
  fill?: string;
  stroke?: string;
  textColor?: string;
}

export const DiamondNode = memo(({ data, selected }: NodeProps) => {
  const d = data as unknown as NodeData;
  const fill = d.fill ?? d.color ?? '#f59e0b';
  const stroke = d.stroke ?? d.color ?? '#f59e0b';
  const textColor = d.textColor ?? '#ffffff';

  return (
    <div
      style={{
        position: 'relative',
        width: 120,
        height: 120,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Handle type="target" position={Position.Left} style={{ background: stroke }} />
      <svg width="120" height="120" viewBox="0 0 120 120" style={{ position: 'absolute', top: 0, left: 0 }}>
        <polygon
          points="60,5 115,60 60,115 5,60"
          fill={fill}
          stroke={stroke}
          strokeWidth="2"
          style={{ filter: selected ? `drop-shadow(0 0 6px ${stroke})` : undefined }}
        />
        <text
          x="60"
          y="60"
          textAnchor="middle"
          dominantBaseline="middle"
          fill={textColor}
          fontSize="12"
          fontWeight="600"
        >
          {d.label}
        </text>
      </svg>
      <Handle type="source" position={Position.Right} style={{ background: stroke }} />
      <Handle type="target" position={Position.Top} style={{ background: stroke }} />
      <Handle type="source" position={Position.Bottom} style={{ background: stroke }} />
    </div>
  );
});
DiamondNode.displayName = 'DiamondNode';
