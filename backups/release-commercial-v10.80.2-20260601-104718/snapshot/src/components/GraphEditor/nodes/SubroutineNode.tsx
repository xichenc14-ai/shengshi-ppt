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

export const SubroutineNode = memo(({ data, selected }: NodeProps) => {
  const d = data as unknown as NodeData;
  const fill = d.fill ?? d.color ?? '#64748b';
  const stroke = d.stroke ?? d.color ?? '#64748b';
  const textColor = d.textColor ?? '#ffffff';

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
        {/* Top tab */}
        <rect x="35" y="0" width="70" height="12" rx="3" fill={stroke} />
        {/* Main body */}
        <rect
          x="0"
          y="10"
          width="140"
          height="50"
          rx="4"
          fill={fill}
          stroke={stroke}
          strokeWidth="2"
          style={{ filter: selected ? `drop-shadow(0 0 6px ${stroke})` : undefined }}
        />
        <text
          x="70"
          y="38"
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
SubroutineNode.displayName = 'SubroutineNode';
