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

export const ParallelogramNode = memo(({ data, selected }: NodeProps) => {
  const d = data as unknown as NodeData;
  const fill = d.fill ?? d.color ?? '#3b82f6';
  const stroke = d.stroke ?? d.color ?? '#3b82f6';
  const textColor = d.textColor ?? '#ffffff';
  const skew = 20;

  return (
    <div
      style={{
        position: 'relative',
        width: 140,
        height: 60,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Handle type="target" position={Position.Left} style={{ background: stroke }} />
      <svg width="140" height="60" viewBox="0 0 140 60" style={{ position: 'absolute', top: 0, left: 0 }}>
        <polygon
          points={`${skew},0 140,0 140,60 ${skew},60 0,30`}
          fill={fill}
          stroke={stroke}
          strokeWidth="2"
          style={{ filter: selected ? `drop-shadow(0 0 6px ${stroke})` : undefined }}
        />
        <text
          x="70"
          y="30"
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
    </div>
  );
});
ParallelogramNode.displayName = 'ParallelogramNode';
