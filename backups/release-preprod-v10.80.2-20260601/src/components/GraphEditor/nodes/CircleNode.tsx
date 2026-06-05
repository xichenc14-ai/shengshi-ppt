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

export const CircleNode = memo(({ data, selected }: NodeProps) => {
  const d = data as unknown as NodeData;
  const fill = d.fill ?? d.color ?? '#10b981';
  const stroke = d.stroke ?? d.color ?? '#10b981';
  const textColor = d.textColor ?? '#ffffff';

  return (
    <div
      style={{
        position: 'relative',
        width: 100,
        height: 100,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Handle type="target" position={Position.Left} style={{ background: stroke }} />
      <svg width="100" height="100" viewBox="0 0 100 100" style={{ position: 'absolute', top: 0, left: 0 }}>
        <circle
          cx="50"
          cy="50"
          r="45"
          fill={fill}
          stroke={stroke}
          strokeWidth="2"
          style={{ filter: selected ? `drop-shadow(0 0 6px ${stroke})` : undefined }}
        />
        <text
          x="50"
          y="50"
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
CircleNode.displayName = 'CircleNode';
