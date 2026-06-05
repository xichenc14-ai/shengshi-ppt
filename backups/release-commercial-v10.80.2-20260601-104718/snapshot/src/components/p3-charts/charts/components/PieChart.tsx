/**
 * PieChart.tsx — 饼图/环形图组件
 */

import React, { useState } from 'react';
import {
  PieChart as RechartsPieChart,
  Pie,
  Cell,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Sector,
} from 'recharts';
import {
  buildTooltipConfig,
  getPieColors,
} from '../themeAdapter';

type PieTooltipPayloadItem = {
  color?: string;
  percent?: number;
  payload: DataPoint;
};

type PieTooltipProps = {
  active?: boolean;
  payload?: PieTooltipPayloadItem[];
};

type PieLabelProps = {
  cx?: number;
  cy?: number;
  percent?: number;
};
type ActiveShapeProps = {
  cx?: number;
  cy?: number;
  innerRadius?: number;
  outerRadius?: number;
  startAngle?: number;
  endAngle?: number;
  fill?: string;
  payload?: DataPoint;
  percent?: number;
  value?: number;
};

const PieTooltipContent: React.FC<PieTooltipProps> = ({ active, payload }) => {
  if (!active || !payload?.length) return null;
  const item = payload[0].payload;
  const percent = typeof payload[0].percent === 'number' ? (payload[0].percent * 100).toFixed(1) : '0';
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

export interface DataPoint {
  name: string;
  value: number;
  [key: string]: string | number | undefined;
}

export interface PieChartProps {
  data: DataPoint[];
  width?: number | string;
  height?: number;
  colors?: string[];
  showLegend?: boolean;
  showTooltip?: boolean;
  showPercent?: boolean;     // 显示百分比
  isDonut?: boolean;         // 环形图模式
  innerRadius?: number;       // 环形图内半径（px）
  outerRadius?: number;       // 外半径
  animationDuration?: number;
  title?: string;
  activeIndex?: number;
  onSliceClick?: (item: DataPoint, index: number) => void;
}

// Active shape for hover effect
const renderActiveShape = (props: ActiveShapeProps) => {
  const {
    cx = 0, cy = 0, innerRadius = 0, outerRadius = 0,
    startAngle = 0, endAngle = 0, fill = '#4F46E5', payload, percent = 0, value = 0,
  } = props;

  return (
    <g>
      <text x={cx} y={cy - 10} textAnchor="middle" fill="#1F2937" fontSize={14} fontWeight={600}>
        {payload?.name ?? ''}
      </text>
      <text x={cx} y={cy + 15} textAnchor="middle" fill="#6B7280" fontSize={12}>
        {`${(percent * 100).toFixed(1)}%`}
      </text>
      <text x={cx} y={cy + 32} textAnchor="middle" fill="#374151" fontSize={11}>
        {value.toLocaleString()}
      </text>
      <Sector
        cx={cx}
        cy={cy}
        innerRadius={innerRadius}
        outerRadius={outerRadius + 6}
        startAngle={startAngle}
        endAngle={endAngle}
        fill={fill}
        style={{ filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.15))' }}
      />
      <Sector
        cx={cx}
        cy={cy}
        innerRadius={innerRadius - 4}
        outerRadius={innerRadius}
        startAngle={startAngle}
        endAngle={endAngle}
        fill={fill}
      />
    </g>
  );
};

const PieChartComponent: React.FC<PieChartProps> = ({
  data,
  width = '100%',
  height = 300,
  colors,
  showLegend = true,
  showTooltip = true,
  showPercent = true,
  isDonut = false,
  innerRadius = 60,
  outerRadius = 100,
  animationDuration = 800,
  title,
  activeIndex: controlledActiveIndex,
  onSliceClick,
}) => {
  const [uncontrolledActiveIndex, setUncontrolledActiveIndex] = useState<number | undefined>(undefined);
  const colorList = colors ?? getPieColors(data.length);

  const activeIndex = controlledActiveIndex ?? uncontrolledActiveIndex;

  const handleMouseEnter = (_: unknown, index: number) => {
    if (controlledActiveIndex === undefined) {
      setUncontrolledActiveIndex(index);
    }
  };

  const handleMouseLeave = () => {
    if (controlledActiveIndex === undefined) {
      setUncontrolledActiveIndex(undefined);
    }
  };

  const renderLabel = (props: PieLabelProps) => {
    if (!showPercent) return null;
    const cx = props.cx ?? 0;
    const cy = props.cy ?? 0;
    const percent = props.percent ?? 0;
    return (
      <text x={cx} y={cy} fill="#fff" textAnchor="middle" dominantBaseline="central" fontSize={11}>
        {`${(percent * 100).toFixed(0)}%`}
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
        <RechartsPieChart>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            innerRadius={isDonut ? innerRadius : 0}
            outerRadius={isDonut ? outerRadius : outerRadius + 20}
            paddingAngle={2}
            dataKey="value"
            animationDuration={animationDuration}
            onClick={(_, index) => onSliceClick?.(data[index], index)}
            label={isDonut && data.length <= 6 ? renderLabel : false}
            labelLine={false}
          >
            {data.map((entry, index) => (
              <Cell
                key={`cell-${index}`}
                fill={colorList[index % colorList.length]}
                stroke="transparent"
              />
            ))}
          </Pie>
          {showTooltip && <Tooltip content={<PieTooltipContent />} {...buildTooltipConfig()} />}
          {showLegend && (
            <Legend
              layout="horizontal"
              verticalAlign="bottom"
              align="center"
              wrapperStyle={{ fontSize: 12, color: '#6B7280', paddingTop: 8 }}
              formatter={(value: string) => (
                <span style={{ color: '#6B7280' }}>{value}</span>
              )}
            />
          )}
        </RechartsPieChart>
      </ResponsiveContainer>
    </div>
  );
};

export default PieChartComponent;
