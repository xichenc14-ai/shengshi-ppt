/**
 * ChartPreview.tsx
 * recharts 实时预览组件
 */

'use client';

import React, { useMemo } from 'react';
import {
  BarChart, Bar, LineChart, Line, AreaChart, Area,
  ScatterChart, Scatter, RadarChart, Radar, FunnelChart, Funnel,
  PieChart, Pie,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Cell,
  PolarGrid, PolarAngleAxis, PolarRadiusAxis,
  LabelList,
} from 'recharts';
import type { ChartType, ChartDataPoint, ChartRenderOptions } from '@/lib/chart-types';

const DEFAULT_COLORS = [
  '#4F46E5', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6',
  '#06B6D4', '#84CC16', '#F97316', '#EC4899', '#6366F1',
];

interface ChartPreviewProps {
  type: ChartType;
  data: ChartDataPoint[];
  colors?: string[];
  title?: string;
  showLegend?: boolean;
  showGrid?: boolean;
  showTooltip?: boolean;
  showDataLabel?: boolean;
  width?: number;
  height?: number;
}

function downsample(data: ChartDataPoint[], maxPoints = 100): ChartDataPoint[] {
  if (data.length <= maxPoints) return data;
  const step = Math.ceil(data.length / maxPoints);
  return data.filter((_, i) => i % step === 0);
}

export function ChartPreview({
  type,
  data,
  colors,
  title,
  showLegend = true,
  showGrid = true,
  showTooltip = true,
  showDataLabel = false,
  width = 600,
  height = 400,
}: ChartPreviewProps) {
  const palette = colors?.length ? colors : DEFAULT_COLORS;
  // Auto downsample for large datasets
  const displayData = useMemo(() => downsample(data), [data]);

  const hasData = displayData.length > 0;

  if (!hasData) {
    return (
      <div className="flex items-center justify-center" style={{ width, height }}>
        <p className="text-gray-400 text-sm">暂无数据</p>
      </div>
    );
  }

  const renderBarChart = () => (
    <BarChart data={displayData} width={width} height={height}>
      {showGrid && <CartesianGrid strokeDasharray="3 3" />}
      <XAxis dataKey="name" tick={{ fontSize: 12 }} />
      <YAxis tick={{ fontSize: 12 }} />
      {showTooltip && <Tooltip />}
      {showLegend && <Legend />}
      <Bar dataKey="value" animationDuration={300}>
        {displayData.map((_, i) => (
          <Cell key={`bar-${i}`} fill={palette[i % palette.length]} />
        ))}
        {showDataLabel && <LabelList dataKey="value" position="top" fontSize={11} />}
      </Bar>
    </BarChart>
  );

  const renderHorizontalBarChart = () => (
    <BarChart data={displayData} layout="vertical" width={width} height={height}>
      {showGrid && <CartesianGrid strokeDasharray="3 3" />}
      <XAxis type="number" tick={{ fontSize: 12 }} />
      <YAxis type="category" dataKey="name" tick={{ fontSize: 12 }} width={80} />
      {showTooltip && <Tooltip />}
      {showLegend && <Legend />}
      <Bar dataKey="value" animationDuration={300}>
        {displayData.map((_, i) => (
          <Cell key={`hbar-${i}`} fill={palette[i % palette.length]} />
        ))}
        {showDataLabel && <LabelList dataKey="value" position="right" fontSize={11} />}
      </Bar>
    </BarChart>
  );

  const renderLineChart = () => (
    <LineChart data={displayData} width={width} height={height}>
      {showGrid && <CartesianGrid strokeDasharray="3 3" />}
      <XAxis dataKey="name" tick={{ fontSize: 12 }} />
      <YAxis tick={{ fontSize: 12 }} />
      {showTooltip && <Tooltip />}
      {showLegend && <Legend />}
      <Line type="monotone" dataKey="value" stroke={palette[0]} strokeWidth={2}
        dot={{ fill: palette[0], r: 4 }} animationDuration={300}
      >
        {showDataLabel && <LabelList dataKey="value" position="top" fontSize={11} />}
      </Line>
    </LineChart>
  );

  const renderAreaChart = () => (
    <AreaChart data={displayData} width={width} height={height}>
      {showGrid && <CartesianGrid strokeDasharray="3 3" />}
      <XAxis dataKey="name" tick={{ fontSize: 12 }} />
      <YAxis tick={{ fontSize: 12 }} />
      {showTooltip && <Tooltip />}
      {showLegend && <Legend />}
      <Area type="monotone" dataKey="value" stroke={palette[0]}
        fill={palette[0] + '50'} animationDuration={300}
      >
        {showDataLabel && <LabelList dataKey="value" position="top" fontSize={11} />}
      </Area>
    </AreaChart>
  );

  const renderPieChart = () => {
    const RADIAN = Math.PI / 180;
    const renderLabel = ({ cx, cy, midAngle, innerRadius, outerRadius, percent }: any) => {
      const r = innerRadius + (outerRadius - innerRadius) * 0.5;
      const x = cx + r * Math.cos(-midAngle * RADIAN);
      const y = cy + r * Math.sin(-midAngle * RADIAN);
      return (
        <text x={x} y={y} fill="white" textAnchor="middle" dominantBaseline="central" fontSize={12}>
          {`${(percent * 100).toFixed(0)}%`}
        </text>
      );
    };
    const total = displayData.reduce((s, d) => s + d.value, 0);
    return (
      <PieChart width={width} height={height}>
        <Pie
          data={displayData} cx="50%" cy="50%"
          labelLine={false}
          label={showDataLabel ? renderLabel : undefined}
          outerRadius={Math.min(width, height) / 2.5}
          dataKey="value"
          animationDuration={300}
        >
          {displayData.map((_, i) => (
            <Cell key={`pie-${i}`} fill={palette[i % palette.length]} />
          ))}
        </Pie>
        {showTooltip && <Tooltip />}
        {showLegend && <Legend />}
        {showDataLabel && (
          <text x={width / 2} y={height / 2} textAnchor="middle" dominantBaseline="central" fontSize={14} fill="#374151" fontWeight={600}>
            {total.toLocaleString()}
          </text>
        )}
      </PieChart>
    );
  };

  const renderScatterChart = () => {
    const scatterData = displayData.map((d, i) => ({
      name: d.name,
      value: d.value,
      // for scatter: x uses index, y uses value
      x: i,
      y: d.value,
    }));
    return (
      <ScatterChart width={width} height={height}>
        {showGrid && <CartesianGrid strokeDasharray="3 3" />}
        <XAxis dataKey="x" name="序号" tick={{ fontSize: 12 }} />
        <YAxis dataKey="y" name="数值" tick={{ fontSize: 12 }} />
        {showTooltip && <Tooltip formatter={(v: any) => [v, '数值']} />}
        <Scatter name="数据" data={scatterData} fill={palette[0]} />
      </ScatterChart>
    );
  };

  const renderRadarChart = () => (
    <RadarChart cx="50%" cy="50%" outerRadius="70%" width={width} height={height} data={displayData}>
      <PolarGrid />
      <PolarAngleAxis dataKey="name" tick={{ fontSize: 11 }} />
      <PolarRadiusAxis tick={{ fontSize: 10 }} />
      <Radar name="数值" dataKey="value" stroke={palette[0]} fill={palette[0]} fillOpacity={0.4} />
      {showLegend && <Legend />}
      {showTooltip && <Tooltip />}
    </RadarChart>
  );

  const renderFunnelChart = () => (
    <FunnelChart width={width} height={height}>
      <Tooltip />
      <Funnel data={displayData} dataKey="value" isAnimationActive animationDuration={300}>
        {displayData.map((_, i) => (
          <Cell key={`funnel-${i}`} fill={palette[i % palette.length]} />
        ))}
      </Funnel>
    </FunnelChart>
  );

  const renderChart = () => {
    switch (type) {
      case 'bar': return renderBarChart();
      case 'horizontalBar': return renderHorizontalBarChart();
      case 'line': return renderLineChart();
      case 'area': return renderAreaChart();
      case 'pie': return renderPieChart();
      case 'scatter': return renderScatterChart();
      case 'radar': return renderRadarChart();
      case 'funnel': return renderFunnelChart();
      default: return renderBarChart();
    }
  };

  return (
    <div>
      {title && (
        <h3 className="text-center text-lg font-semibold mb-4 text-gray-800">{title}</h3>
      )}
      <ResponsiveContainer width="100%" height={height}>
        {renderChart()}
      </ResponsiveContainer>
    </div>
  );
}
