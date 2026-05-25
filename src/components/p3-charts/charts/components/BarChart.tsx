/**
 * BarChart.tsx — 柱状图组件
 * 类型：垂直柱状图，支持分组柱状图
 */

import React, { useMemo } from 'react';
import {
  BarChart as RechartsBarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Cell,
} from 'recharts';
import {
  buildChartStyle,
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

export interface BarChartProps {
  data: DataPoint[];
  width?: number | string;
  height?: number;
  colors?: string[];
  showGrid?: boolean;
  showLegend?: boolean;
  showTooltip?: boolean;
  showValue?: boolean;        // 在柱子上显示数值
  animationDuration?: number;
  direction?: 'vertical' | 'horizontal';
  title?: string;
}

const BarChartComponent: React.FC<BarChartProps> = ({
  data,
  width = '100%',
  height = 300,
  colors,
  showGrid = true,
  showLegend = true,
  showTooltip = true,
  showValue = false,
  animationDuration = 800,
  direction = 'vertical',
  title,
}) => {
  const colorList = colors ?? getChartColors(6);

  // 检测是否为分组数据（多系列）
  const series = useMemo(() => {
    if (data.length === 0) return [];
    const keys = Object.keys(data[0]).filter(k => k !== 'name');
    return keys;
  }, [data]);

  const isGrouped = series.length > 1;

  // Custom tooltip
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

  // Value label on bar
  const CustomLabel = (props: any) => {
    if (!showValue) return null;
    const { x, y, width: w, height: h, value } = props;
    return (
      <text
        x={x + w / 2}
        y={y + h / 2}
        fill="#fff"
        textAnchor="middle"
        dominantBaseline="central"
        fontSize={11}
        fontWeight={500}
      >
        {typeof value === 'number' ? value.toLocaleString() : value}
      </text>
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
        <RechartsBarChart
          data={data}
          layout={direction}
          margin={{ top: 5, right: 20, left: 0, bottom: 5 }}
        >
          {showGrid && <CartesianGrid {...buildGridConfig()} />}
          {direction === 'vertical' ? (
            <>
              <XAxis dataKey="name" {...buildAxisConfig()} />
              <YAxis {...buildAxisConfig()} tickFormatter={(v) => Number.isInteger(v) ? v.toLocaleString() : ''} />
            </>
          ) : (
            <>
              <XAxis {...buildAxisConfig()} type="number" tickFormatter={(v) => Number.isInteger(v) ? v.toLocaleString() : ''} />
              <YAxis dataKey="name" {...buildAxisConfig()} />
            </>
          )}
          {showTooltip && <Tooltip content={<CustomTooltip />} {...buildTooltipConfig()} />}
          {showLegend && (
            <Legend
              wrapperStyle={{ fontSize: 12, color: '#6B7280' }}
            />
          )}
          {isGrouped ? (
            series.map((key, idx) => (
              <Bar
                key={key}
                dataKey={key}
                fill={colorList[idx % colorList.length]}
                animationDuration={animationDuration}
                label={showValue && direction === 'vertical' ? <CustomLabel /> : false}
                radius={[4, 4, 0, 0]}
              >
                {data.map((_, index) => (
                  <Cell key={`cell-${index}`} fill={colorList[index % colorList.length]} />
                ))}
              </Bar>
            ))
          ) : (
            <Bar
              dataKey={series[0] || 'value'}
              fill={colorList[0]}
              animationDuration={animationDuration}
              label={showValue ? <CustomLabel /> : false}
              radius={[4, 4, 0, 0]}
            >
              {data.map((_, index) => (
                <Cell key={`cell-${index}`} fill={colorList[index % colorList.length]} />
              ))}
            </Bar>
          )}
        </RechartsBarChart>
      </ResponsiveContainer>
    </div>
  );
};

export default BarChartComponent;
