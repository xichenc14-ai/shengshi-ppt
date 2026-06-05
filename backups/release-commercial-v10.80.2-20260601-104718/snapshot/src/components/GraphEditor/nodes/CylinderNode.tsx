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

export const CylinderNode = memo(({ data, selected }: NodeProps) => {
  void selected;
  const d = data as unknown as NodeData;
  const fill = d.fill ?? d.color ?? '#8b5cf6';
  const stroke = d.stroke ?? d.color ?? '#8b5cf6';
  const textColor = d.textColor ?? '#ffffff';

  return (
    <div
      style={{
        position: 'relative',
        width: 100,
        height: 120,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Handle type="target" position={Position.Left} style={{ background: stroke }} />
      <svg width="100" height="120" viewBox="0 0 100 120" style={{ position: 'absolute', top: 0, left: 0 }}>
        <defs>
          <linearGradient id={`cyl-${d.label}`} x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor={fill} stopOpacity="0.8" />
            <stop offset="50%" stopColor={fill} />
            <stop offset="100%" stopColor={fill} stopOpacity="0.6" />
          </linearGradient>
        </defs>
        {/* Body */}
        <rect x="5" y="15" width="90" height="90" fill={`url(#cyl-${d.label})`} stroke={stroke} strokeWidth="2" />
        {/* Bottom ellipse */}
        <ellipse cx="50" cy="105" rx="42" ry="12" fill={fill} stroke={stroke} strokeWidth="2" />
        {/* Top ellipse */}
        <ellipse cx="50" cy="15" rx="42" ry="12" fill={fill} stroke={stroke} strokeWidth="2" />
        <text
          x="50"
          y="65"
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
CylinderNode.displayName = 'CylinderNode';
