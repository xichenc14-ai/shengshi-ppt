'use client';

import React, { useState } from 'react';
import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, AreaChart, Area,
  ScatterChart, Scatter, RadarChart, Radar, FunnelChart, Funnel,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Cell,
  PolarGrid, PolarAngleAxis, PolarRadiusAxis,
} from 'recharts';
import type { ChartConfig, ChartType } from '../types';
import type { PieLabelRenderProps } from 'recharts';

const DEFAULT_COLORS = [
  '#4F46E5', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6',
  '#06B6D4', '#84CC16', '#F97316', '#EC4899', '#6366F1',
];

interface ChartRendererProps {
  config: ChartConfig;
  editable?: boolean;
  onConfigChange?: (config: ChartConfig) => void;
}

const CHART_COLORS = (config: ChartConfig) => config.colors?.length ? config.colors : DEFAULT_COLORS;

function buildBarChart(config: ChartConfig) {
  return (
    <BarChart data={config.data} width={config.width || 600} height={config.height || 400}>
      {config.showGrid && <CartesianGrid strokeDasharray="3 3" />}
      <XAxis dataKey="name" />
      <YAxis />
      {config.showTooltip && <Tooltip />}
      {config.showLegend && <Legend />}
      <Bar dataKey="value" fill={CHART_COLORS(config)[0]} animationDuration={config.animationDuration || 500}>
        {config.data.map((_, index) => (
          <Cell key={`cell-${index}`} fill={CHART_COLORS(config)[index % CHART_COLORS(config).length]} />
        ))}
      </Bar>
    </BarChart>
  );
}

function buildLineChart(config: ChartConfig) {
  return (
    <LineChart data={config.data} width={config.width || 600} height={config.height || 400}>
      {config.showGrid && <CartesianGrid strokeDasharray="3 3" />}
      <XAxis dataKey="name" />
      <YAxis />
      {config.showTooltip && <Tooltip />}
      {config.showLegend && <Legend />}
      <Line
        type="monotone"
        dataKey="value"
        stroke={CHART_COLORS(config)[0]}
        animationDuration={config.animationDuration || 500}
        strokeWidth={2}
        dot={{ fill: CHART_COLORS(config)[0], r: 4 }}
      />
    </LineChart>
  );
}

function buildAreaChart(config: ChartConfig) {
  return (
    <AreaChart data={config.data} width={config.width || 600} height={config.height || 400}>
      {config.showGrid && <CartesianGrid strokeDasharray="3 3" />}
      <XAxis dataKey="name" />
      <YAxis />
      {config.showTooltip && <Tooltip />}
      {config.showLegend && <Legend />}
      <Area
        type="monotone"
        dataKey="value"
        stroke={CHART_COLORS(config)[0]}
        fill={CHART_COLORS(config)[0] + '40'}
        animationDuration={config.animationDuration || 500}
      />
    </AreaChart>
  );
}

function buildPieChart(config: ChartConfig) {
  const RADIAN = Math.PI / 180;
  const renderCustomizedLabel = ({ cx, cy, midAngle, innerRadius, outerRadius, percent }: PieLabelRenderProps) => {
    if (
      cx == null || cy == null || midAngle == null || innerRadius == null || outerRadius == null || percent == null
    ) {
      return null;
    }
    const radius = innerRadius + (outerRadius - innerRadius) * 0.5;
    const x = cx + radius * Math.cos(-midAngle * RADIAN);
    const y = cy + radius * Math.sin(-midAngle * RADIAN);
    return (
      <text x={x} y={y} fill="white" textAnchor="middle" dominantBaseline="central" fontSize={12}>
        {`${(percent * 100).toFixed(0)}%`}
      </text>
    );
  };
  return (
    <PieChart width={config.width || 600} height={config.height || 400}>
      <Pie
        data={config.data}
        cx="50%"
        cy="50%"
        labelLine={false}
        label={renderCustomizedLabel}
        outerRadius={Math.min(config.width || 600, config.height || 400) / 2.5}
        dataKey="value"
        animationDuration={config.animationDuration || 500}
      >
        {config.data.map((_, index) => (
          <Cell key={`cell-${index}`} fill={CHART_COLORS(config)[index % CHART_COLORS(config).length]} />
        ))}
      </Pie>
      {config.showTooltip && <Tooltip />}
      {config.showLegend && <Legend />}
    </PieChart>
  );
}

function buildScatterChart(config: ChartConfig) {
  return (
    <ScatterChart width={config.width || 600} height={config.height || 400}>
      {config.showGrid && <CartesianGrid strokeDasharray="3 3" />}
      <XAxis dataKey="name" />
      <YAxis dataKey="value" />
      {config.showTooltip && <Tooltip />}
      <Scatter name="数据" data={config.data} fill={CHART_COLORS(config)[0]} />
    </ScatterChart>
  );
}

function buildRadarChart(config: ChartConfig) {
  return (
    <RadarChart cx="50%" cy="50%" outerRadius="70%" width={config.width || 600} height={config.height || 400} data={config.data}>
      <PolarGrid />
      <PolarAngleAxis dataKey="name" />
      <PolarRadiusAxis />
      <Radar name="数值" dataKey="value" stroke={CHART_COLORS(config)[0]} fill={CHART_COLORS(config)[0]} fillOpacity={0.5} />
      {config.showLegend && <Legend />}
      {config.showTooltip && <Tooltip />}
    </RadarChart>
  );
}

function buildFunnelChart(config: ChartConfig) {
  return (
    <FunnelChart width={config.width || 600} height={config.height || 400}>
      <Tooltip />
      <Funnel
        dataKey="value"
        data={config.data}
        isAnimationActive
        animationDuration={config.animationDuration || 500}
      >
        {config.data.map((_, index) => (
          <Cell key={`cell-${index}`} fill={CHART_COLORS(config)[index % CHART_COLORS(config).length]} />
        ))}
      </Funnel>
    </FunnelChart>
  );
}

export function ChartRenderer({ config, editable = false, onConfigChange }: ChartRendererProps) {
  const [hovered, setHovered] = useState(false);

  const renderChart = () => {
    switch (config.type) {
      case 'bar': return buildBarChart(config);
      case 'line': return buildLineChart(config);
      case 'area': return buildAreaChart(config);
      case 'pie': return buildPieChart(config);
      case 'scatter': return buildScatterChart(config);
      case 'radar': return buildRadarChart(config);
      case 'funnel': return buildFunnelChart(config);
      default: return buildBarChart(config);
    }
  };

  return (
    <div
      className="relative inline-block"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {config.title && (
        <h3 className="text-center text-lg font-semibold mb-4 text-gray-800">{config.title}</h3>
      )}
      <ResponsiveContainer width="100%" height={config.height || 400}>
        {renderChart()}
      </ResponsiveContainer>
      {editable && hovered && (
        <div className="absolute top-2 right-2 bg-indigo-600 text-white text-xs px-2 py-1 rounded cursor-pointer hover:bg-indigo-700">
          编辑
        </div>
      )}
    </div>
  );
}

export default ChartRenderer;
