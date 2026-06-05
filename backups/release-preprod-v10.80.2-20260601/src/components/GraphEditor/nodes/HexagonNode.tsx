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

export const HexagonNode = memo(({ data, selected }: NodeProps) => {
  const d = data as unknown as NodeData;
  const fill = d.fill ?? d.color ?? '#ec4899';
  const stroke = d.stroke ?? d.color ?? '#ec4899';
  const textColor = d.textColor ?? '#ffffff';

  return (
    <div
      style={{
        position: 'relative',
        width: 130,
        height: 80,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Handle type="target" position={Position.Left} style={{ background: stroke }} />
      <svg width="130" height="80" viewBox="0 0 130 80" style={{ position: 'absolute', top: 0, left: 0 }}>
        <polygon
          points="25,0 105,0 130,40 105,80 25,80 0,40"
          fill={fill}
          stroke={stroke}
          strokeWidth="2"
          style={{ filter: selected ? `drop-shadow(0 0 6px ${stroke})` : undefined }}
        />
        <text
          x="65"
          y="40"
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
HexagonNode.displayName = 'HexagonNode';
