/**
 * FunnelChart.tsx — 漏斗图组件
 * 使用 recharts 的自定义漏斗实现（基于 BarChart horizontal）
 */

import React from 'react';
import {
  FunnelChart as RechartsFunnelChart,
  Funnel,
  LabelList,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts';
import {
  buildTooltipConfig,
  getPieColors,
} from '../themeAdapter';

export interface DataPoint {
  name: string;
  value: number;
  [key: string]: string | number;
}

export interface FunnelChartProps {
  data: DataPoint[];
  width?: number | string;
  height?: number;
  colors?: string[];
  showTooltip?: boolean;
  showValue?: boolean;
  animationDuration?: number;
  title?: string;
}

const FunnelChartComponent: React.FC<FunnelChartProps> = ({
  data,
  width = '100%',
  height = 300,
  colors,
  showTooltip = true,
  showValue = true,
  animationDuration = 800,
  title,
}) => {
  const colorList = colors ?? getPieColors(data.length);

  const CustomTooltip = ({ active, payload }: any) => {
    if (!active || !payload?.length) return null;
    const item = payload[0].payload;
    const total = data.reduce((sum, d) => sum + d.value, 0);
    const percent = total > 0 ? ((item.value / total) * 100).toFixed(1) : '0';
    return (
      <div style={{
        background: '#1F2937',
        border: 'none',
        borderRadius: 6,
        padding: '8px 12px',
        fontSize: 12,
        color: '#fff',
      }}>
        <p style={{ margin: 0, color: payload[0].color, fontWeight: 500 }}>{item.name}</p>
        <p style={{ margin: '4px 0 0 0' }}>{item.value.toLocaleString()}</p>
        <p style={{ margin: 0, color: 'rgba(255,255,255,0.7)' }}>{percent}%</p>
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
        <RechartsFunnelChart>
          <Tooltip
            content={<CustomTooltip />}
            {...buildTooltipConfig()}
          />
          <Funnel
            data={data}
            dataKey="value"
            isAnimationActive
            animationDuration={animationDuration}
            labelLine={false}
          >
            {data.map((entry, index) => (
              <Cell
                key={`cell-${index}`}
                fill={colorList[index % colorList.length]}
                stroke="transparent"
              />
            ))}
            {showValue && (
              <LabelList
                position="center"
                fill="#fff"
                fontSize={12}
                fontWeight={600}
                stroke="none"
                formatter={(value: number) => value.toLocaleString()}
              />
            )}
          </Funnel>
        </RechartsFunnelChart>
      </ResponsiveContainer>
    </div>
  );
};

export default FunnelChartComponent;
