/**
 * ScatterChart.tsx — 散点图组件
 */

import React from 'react';
import {
  ScatterChart as RechartsScatterChart,
  Scatter,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ZAxis,
} from 'recharts';
import {
  buildGridConfig,
  buildAxisConfig,
  buildTooltipConfig,
  getChartColors,
} from '../themeAdapter';

export interface DataPoint {
  x: number;
  y: number;
  z?: number;         // 气泡大小（可选）
  name?: string;
  [key: string]: string | number;
}

export interface ScatterChartProps {
  data: DataPoint[];
  width?: number | string;
  height?: number;
  colors?: string[];
  showGrid?: boolean;
  showLegend?: boolean;
  showTooltip?: boolean;
  showBubbleSize?: boolean;   // 启用气泡大小（z轴）
  animationDuration?: number;
  title?: string;
}

const ScatterChartComponent: React.FC<ScatterChartProps> = ({
  data,
  width = '100%',
  height = 300,
  colors,
  showGrid = true,
  showLegend = true,
  showTooltip = true,
  showBubbleSize = false,
  animationDuration = 800,
  title,
}) => {
  const colorList = colors ?? getChartColors(6);
  const series = Object.keys(data.length > 0 ? data[0] : {}).filter(k => !['x', 'y', 'z', 'name'].includes(k));

  const CustomTooltip = ({ active, payload }: any) => {
    if (!active || !payload?.length) return null;
    const item = payload[0]?.payload;
    return (
      <div style={{
        background: '#1F2937',
        border: 'none',
        borderRadius: 6,
        padding: '8px 12px',
        fontSize: 12,
        color: '#fff',
      }}>
        <p style={{ margin: 0, color: 'rgba(255,255,255,0.7)', marginBottom: 4 }}>
          {item.name || `(${item.x}, ${item.y})`}
        </p>
        <p style={{ margin: 0 }}>X: {item.x}</p>
        <p style={{ margin: 0 }}>Y: {item.y}</p>
        {item.z !== undefined && <p style={{ margin: 0 }}>Z: {item.z}</p>}
      </div>
    );
  };

  // 按系列分组数据
  const groupedData = series.length > 0
    ? series.map(key => ({
        name: key,
        data: data.map(d => ({ ...d, z: showBubbleSize ? (d.z ?? 1) : undefined })),
      }))
    : [{ name: 'Series 1', data }];

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
        <RechartsScatterChart margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
          {showGrid && <CartesianGrid {...buildGridConfig()} />}
          <XAxis
            type="number"
            dataKey="x"
            name="X"
            {...buildAxisConfig()}
            tickFormatter={(v) => Number.isInteger(v) ? v.toLocaleString() : ''}
          />
          <YAxis
            type="number"
            dataKey="y"
            name="Y"
            {...buildAxisConfig()}
            tickFormatter={(v) => Number.isInteger(v) ? v.toLocaleString() : ''}
          />
          {showBubbleSize && <ZAxis type="number" dataKey="z" range={[20, 500]} />}
          {showTooltip && <Tooltip content={<CustomTooltip />} {...buildTooltipConfig()} />}
          {showLegend && (
            <Legend wrapperStyle={{ fontSize: 12, color: '#6B7280' }} />
          )}
          {groupedData.map((group, idx) => (
            <Scatter
              key={group.name}
              name={group.name}
              data={group.data}
              fill={colorList[idx % colorList.length]}
              animationDuration={animationDuration}
            />
          ))}
        </RechartsScatterChart>
      </ResponsiveContainer>
    </div>
  );
};

export default ScatterChartComponent;
