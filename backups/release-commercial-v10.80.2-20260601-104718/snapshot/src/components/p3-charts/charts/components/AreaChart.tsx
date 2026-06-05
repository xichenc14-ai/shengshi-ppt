/**
 * AreaChart.tsx — 面积图组件
 */

import React from 'react';
import {
  AreaChart as RechartsAreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import {
  buildGridConfig,
  buildAxisConfig,
  buildTooltipConfig,
  getChartColors,
} from '../themeAdapter';

export interface DataPoint {
  name: string;
  value?: number;
  [key: string]: string | number | undefined;
}

export interface AreaChartProps {
  data: DataPoint[];
  width?: number | string;
  height?: number;
  colors?: string[];
  showGrid?: boolean;
  showLegend?: boolean;
  showTooltip?: boolean;
  smooth?: boolean;
  fillOpacity?: number;     // 面积填充透明度 0-1
  animationDuration?: number;
  title?: string;
}

type AreaTooltipEntry = { name?: string; value?: unknown; color?: string };
type AreaTooltipProps = { active?: boolean; payload?: AreaTooltipEntry[]; label?: string };

const AreaTooltipContent: React.FC<AreaTooltipProps> = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{
      background: '#1F2937',
      border: 'none',
      borderRadius: 6,
      padding: '8px 12px',
      fontSize: 12,
      color: '#fff',
    }}>
      <p style={{ margin: 0, color: 'rgba(255,255,255,0.7)', marginBottom: 4 }}>{label}</p>
      {payload.map((entry, idx) => (
        <p key={idx} style={{ margin: 0, color: entry.color }}>
          {entry.name}: {typeof entry.value === 'number' ? entry.value.toLocaleString() : String(entry.value ?? '')}
        </p>
      ))}
    </div>
  );
};

const AreaChartComponent: React.FC<AreaChartProps> = ({
  data,
  width = '100%',
  height = 300,
  colors,
  showGrid = true,
  showLegend = true,
  showTooltip = true,
  smooth = true,
  fillOpacity = 0.3,
  animationDuration = 800,
  title,
}) => {
  const colorList = colors ?? getChartColors(6);
  const series = Object.keys(data.length > 0 ? data[0] : {}).filter(k => k !== 'name');

  return (
    <div style={{ width, height: height + (title ? 30 : 0) }}>
      {title && (
        <p style={{
          textAlign: 'center',
          margin: '0 0 8px 0',
          fontSize: 14,
          fontWeight: 600,
          color: '#1F2937',
        }}>
          {title}
        </p>
      )}
      <ResponsiveContainer width="100%" height={height}>
        <RechartsAreaChart data={data} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
          <defs>
            {series.map((key, idx) => {
              const color = colorList[idx % colorList.length];
              return (
                <linearGradient key={key} id={`area-gradient-${idx}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={color} stopOpacity={fillOpacity} />
                  <stop offset="100%" stopColor={color} stopOpacity={0.05} />
                </linearGradient>
              );
            })}
          </defs>
          {showGrid && <CartesianGrid {...buildGridConfig()} />}
          <XAxis dataKey="name" {...buildAxisConfig()} />
          <YAxis {...buildAxisConfig()} tickFormatter={(v) => Number.isInteger(v) ? v.toLocaleString() : ''} />
          {showTooltip && <Tooltip content={<AreaTooltipContent />} {...buildTooltipConfig()} />}
          {showLegend && (
            <Legend wrapperStyle={{ fontSize: 12, color: '#6B7280' }} />
          )}
          {series.map((key, idx) => (
            <Area
              key={key}
              type={smooth ? 'monotone' : 'linear'}
              dataKey={key}
              stroke={colorList[idx % colorList.length]}
              strokeWidth={2}
              fill={`url(#area-gradient-${idx})`}
              animationDuration={animationDuration}
              dot={false}
              activeDot={{ r: 5, strokeWidth: 2 }}
            />
          ))}
        </RechartsAreaChart>
      </ResponsiveContainer>
    </div>
  );
};

export default AreaChartComponent;
