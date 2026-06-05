/**
 * RadarChart.tsx — 雷达图组件
 */

import React from 'react';
import {
  RadarChart as RechartsRadarChart,
  Radar,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Legend,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import {
  buildTooltipConfig,
  getChartColors,
} from '../themeAdapter';

type RadarTooltipPayloadItem = {
  color?: string;
  name?: string;
  value?: string | number;
};

type RadarTooltipProps = {
  active?: boolean;
  payload?: RadarTooltipPayloadItem[];
  label?: string;
};

const RadarTooltipContent: React.FC<RadarTooltipProps> = ({ active, payload, label }) => {
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
          {entry.name}: {typeof entry.value === 'number' ? entry.value.toLocaleString() : entry.value}
        </p>
      ))}
    </div>
  );
};

export interface DataPoint {
  subject: string;
  value?: number;
  [key: string]: string | number | undefined;
}

export interface RadarChartProps {
  data: DataPoint[];
  width?: number | string;
  height?: number;
  colors?: string[];
  showLegend?: boolean;
  showTooltip?: boolean;
  animationDuration?: number;
  title?: string;
}

const RadarChartComponent: React.FC<RadarChartProps> = ({
  data,
  width = '100%',
  height = 300,
  colors,
  showLegend = true,
  showTooltip = true,
  animationDuration = 800,
  title,
}) => {
  const colorList = colors ?? getChartColors(6);
  const series = Object.keys(data.length > 0 ? data[0] : {}).filter(k => k !== 'subject');

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
        <RechartsRadarChart cx="50%" cy="50%" margin={{ top: 5, right: 20, bottom: 5, left: 20 }}>
          <PolarGrid stroke="#E5E7EB" />
          <PolarAngleAxis
            dataKey="subject"
            tick={{ fill: '#6B7280', fontSize: 11 }}
          />
          <PolarRadiusAxis
            tick={{ fill: '#6B7280', fontSize: 10 }}
            tickCount={5}
          />
          {showTooltip && <Tooltip content={<RadarTooltipContent />} {...buildTooltipConfig()} />}
          {showLegend && (
            <Legend wrapperStyle={{ fontSize: 12, color: '#6B7280' }} />
          )}
          {series.map((key, idx) => (
            <Radar
              key={key}
              name={key}
              dataKey={key}
              stroke={colorList[idx % colorList.length]}
              fill={colorList[idx % colorList.length]}
              fillOpacity={0.15}
              strokeWidth={2}
              animationDuration={animationDuration}
            />
          ))}
        </RechartsRadarChart>
      </ResponsiveContainer>
    </div>
  );
};

export default RadarChartComponent;
