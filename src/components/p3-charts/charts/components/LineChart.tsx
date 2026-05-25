/**
 * LineChart.tsx — 折线图组件
 * 支持多系列、平滑曲线、面积填充
 */

import React from 'react';
import {
  LineChart as RechartsLineChart,
  Line,
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
  [key: string]: string | number;
}

export interface LineChartProps {
  data: DataPoint[];
  width?: number | string;
  height?: number;
  colors?: string[];
  showGrid?: boolean;
  showLegend?: boolean;
  showTooltip?: boolean;
  showDots?: boolean;
  showArea?: boolean;         // 显示面积填充
  smooth?: boolean;           // 平滑曲线
  animationDuration?: number;
  title?: string;
}

const LineChartComponent: React.FC<LineChartProps> = ({
  data,
  width = '100%',
  height = 300,
  colors,
  showGrid = true,
  showLegend = true,
  showTooltip = true,
  showDots = true,
  showArea = false,
  smooth = false,
  animationDuration = 800,
  title,
}) => {
  const colorList = colors ?? getChartColors(6);

  const series = Object.keys(data.length > 0 ? data[0] : {}).filter(k => k !== 'name');

  const CustomTooltip = ({ active, payload, label }: any) => {
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
        {payload.map((entry: any, idx: number) => (
          <p key={idx} style={{ margin: 0, color: entry.color }}>
            {entry.name}: {typeof entry.value === 'number' ? entry.value.toLocaleString() : entry.value}
          </p>
        ))}
      </div>
    );
  };

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
        <RechartsLineChart data={data} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
          {showGrid && <CartesianGrid {...buildGridConfig()} />}
          <XAxis dataKey="name" {...buildAxisConfig()} />
          <YAxis {...buildAxisConfig()} tickFormatter={(v) => Number.isInteger(v) ? v.toLocaleString() : ''} />
          {showTooltip && <Tooltip content={<CustomTooltip />} {...buildTooltipConfig()} />}
          {showLegend && (
            <Legend wrapperStyle={{ fontSize: 12, color: '#6B7280' }} />
          )}
          {series.map((key, idx) => (
            <Line
              key={key}
              type={smooth ? 'monotone' : 'linear'}
              dataKey={key}
              stroke={colorList[idx % colorList.length]}
              strokeWidth={2}
              dot={showDots ? { r: 4, strokeWidth: 2 } : false}
              activeDot={{ r: 6, strokeWidth: 2 }}
              animationDuration={animationDuration}
              fill={showArea ? colorList[idx % colorList.length] : undefined}
              fillOpacity={showArea ? 0.1 : 0}
            />
          ))}
        </RechartsLineChart>
      </ResponsiveContainer>
    </div>
  );
};

export default LineChartComponent;
