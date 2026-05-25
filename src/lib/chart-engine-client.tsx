/**
 * chart-engine-client.tsx
 * 浏览器端图表渲染 — SVG → Canvas → PNG
 * renderChartToImage() 在此实现
 */

'use client';

import React from 'react';
import ReactDOMServer from 'react-dom/server';
import {
  BarChart, Bar, LineChart, Line, AreaChart, Area,
  PieChart, Pie, ScatterChart, Scatter, RadarChart, Radar, FunnelChart, Funnel,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, Cell,
  PolarGrid, PolarAngleAxis, PolarRadiusAxis,
} from 'recharts';
import type { ChartType, ChartDataPoint, ThemeColors } from './chart-types';

/**
 * renderChartToImage — 将 recharts 图表渲染为 base64 PNG
 * 仅限浏览器环境调用
 */
export async function renderChartToImage(
  type: ChartType,
  data: ChartDataPoint[],
  theme: ThemeColors,
  size: { width: number; height: number },
  scale = 2
): Promise<string> {
  const { width, height } = size;
  const w = width * scale;
  const h = height * scale;

  const palette = theme.chartColors?.length
    ? theme.chartColors
    : [theme.primary, theme.accent, theme.background, '#6366F1', '#8B5CF6'];

  // Auto downsample for large datasets (>100 points)
  const displayData = data.length > 100
    ? data.filter((_, i) => i % Math.ceil(data.length / 100) === 0)
    : data;

  // Build chart element
  const chartEl = buildChartElement(type, displayData, palette, w, h);

  // Render to SVG string
  const svg = ReactDOMServer.renderToStaticMarkup(chartEl);

  // SVG → Canvas → PNG
  return svgToDataUrl(svg, w, h);
}

function buildChartElement(
  type: ChartType,
  data: ChartDataPoint[],
  palette: string[],
  w: number,
  h: number
): React.ReactElement {
  const fs = 12;
  const makeTooltip = () => <Tooltip />;
  const makeLegend = () => <Legend />;
  const grid = <CartesianGrid strokeDasharray="3 3" />;

  switch (type) {
    case 'bar':
      return (
        <BarChart data={data} width={w} height={h}>
          {grid}
          <XAxis dataKey="name" tick={{ fontSize: fs }} />
          <YAxis tick={{ fontSize: fs }} />
          {makeTooltip()}
          {makeLegend()}
          <Bar dataKey="value" name="数值">
            {data.map((_, i) => <Cell key={`b${i}`} fill={palette[i % palette.length]} />)}
          </Bar>
        </BarChart>
      );

    case 'horizontalBar':
      return (
        <BarChart data={data} layout="vertical" width={w} height={h}>
          {grid}
          <XAxis type="number" tick={{ fontSize: fs }} />
          <YAxis type="category" dataKey="name" tick={{ fontSize: fs }} width={80} />
          {makeTooltip()}
          {makeLegend()}
          <Bar dataKey="value" layout="vertical" name="数值">
            {data.map((_, i) => <Cell key={`hb${i}`} fill={palette[i % palette.length]} />)}
          </Bar>
        </BarChart>
      );

    case 'line':
      return (
        <LineChart data={data} width={w} height={h}>
          {grid}
          <XAxis dataKey="name" tick={{ fontSize: fs }} />
          <YAxis tick={{ fontSize: fs }} />
          {makeTooltip()}
          {makeLegend()}
          <Line type="monotone" dataKey="value" name="数值" stroke={palette[0]} strokeWidth={2}
            dot={{ fill: palette[0], r: 4 }} />
        </LineChart>
      );

    case 'area':
      return (
        <AreaChart data={data} width={w} height={h}>
          {grid}
          <XAxis dataKey="name" tick={{ fontSize: fs }} />
          <YAxis tick={{ fontSize: fs }} />
          {makeTooltip()}
          {makeLegend()}
          <Area type="monotone" dataKey="value" name="数值" stroke={palette[0]}
            fill={palette[0] + '50'} />
        </AreaChart>
      );

    case 'pie': {
      const RADIAN = Math.PI / 180;
      const renderLabel = ({ cx, cy, midAngle, innerRadius, outerRadius, percent }: any) => {
        const r = innerRadius + (outerRadius - innerRadius) * 0.5;
        const x = cx + r * Math.cos(-midAngle * RADIAN);
        const y = cy + r * Math.sin(-midAngle * RADIAN);
        return (
          <text x={x} y={y} fill="white" textAnchor="middle" dominantBaseline="central" fontSize={14}>
            {`${(percent * 100).toFixed(0)}%`}
          </text>
        );
      };
      return (
        <PieChart width={w} height={h}>
          <Pie data={data} cx="50%" cy="50%"
            labelLine={false}
            label={renderLabel}
            outerRadius={Math.min(w, h) / 2.5}
            dataKey="value" nameKey="name"
          >
            {data.map((_, i) => <Cell key={`p${i}`} fill={palette[i % palette.length]} />)}
          </Pie>
          {makeTooltip()}
          {makeLegend()}
        </PieChart>
      );
    }

    case 'scatter': {
      const scatterData = data.map((d, i) => ({ x: i, y: d.value, name: d.name }));
      return (
        <ScatterChart width={w} height={h}>
          {grid}
          <XAxis dataKey="x" name="序号" tick={{ fontSize: fs }} />
          <YAxis dataKey="y" name="数值" tick={{ fontSize: fs }} />
          {makeTooltip()}
          <Scatter data={scatterData} name="数据" fill={palette[0]} />
        </ScatterChart>
      );
    }

    case 'radar':
      return (
        <RadarChart cx="50%" cy="50%" outerRadius="70%" width={w} height={h} data={data}>
          <PolarGrid />
          <PolarAngleAxis dataKey="name" tick={{ fontSize: 11 }} />
          <PolarRadiusAxis tick={{ fontSize: 10 }} />
          <Radar name="数值" dataKey="value" stroke={palette[0]}
            fill={palette[0]} fillOpacity={0.4} />
          {makeLegend()}
          {makeTooltip()}
        </RadarChart>
      );

    case 'funnel':
      return (
        <FunnelChart width={w} height={h}>
          <Tooltip />
          <Funnel data={data} dataKey="value" isAnimationActive={false}>
            {data.map((_, i) => <Cell key={`fn${i}`} fill={palette[i % palette.length]} />)}
          </Funnel>
        </FunnelChart>
      );

    default:
      return (
        <BarChart data={data} width={w} height={h}>
          {grid}
          <XAxis dataKey="name" />
          <YAxis />
          {makeTooltip()}
          <Bar dataKey="value">
            {data.map((_, i) => <Cell key={`df${i}`} fill={palette[i % palette.length]} />)}
          </Bar>
        </BarChart>
      );
  }
}

/**
 * svgToDataUrl — Convert SVG string to base64 PNG data URL via Canvas
 */
function svgToDataUrl(svg: string, width: number, height: number): Promise<string> {
  return new Promise((resolve, reject) => {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d')!;

    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, width, height);

    const img = new Image();
    img.onload = () => {
      ctx.drawImage(img, 0, 0, width, height);
      resolve(canvas.toDataURL('image/png'));
    };
    img.onerror = () => reject(new Error('SVG → PNG conversion failed'));
    img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
  });
}