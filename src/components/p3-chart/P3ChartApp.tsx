'use client';

import React, { useState, useCallback } from 'react';
import { ChartRenderer } from './renderers/ChartRenderer';
import { GraphRenderer } from './renderers/GraphRenderer';
import { DiagramRenderer } from './renderers/DiagramRenderer';
import { ChartEditor } from './editors/ChartEditor';
import { GraphEditor } from './editors/GraphEditor';
import { DiagramEditor } from './editors/DiagramEditor';
import { ExportPanel } from './export/ExportPanel';
import {
  exportChartToPDF,
  exportGraphToPDF,
  exportDiagramToPDF,
  downloadBlob,
} from './export/pdfExporter';
import type {
  ChartConfig, GraphConfig, DiagramConfig,
  P3ComponentType,
  ChartDataPoint,
} from './types';

// ============ Default Configs ============

const DEFAULT_CHART_CONFIG: ChartConfig = {
  id: 'chart-1',
  type: 'bar',
  title: '季度销售额统计',
  data: [
    { name: 'Q1', value: 120 },
    { name: 'Q2', value: 198 },
    { name: 'Q3', value: 156 },
    { name: 'Q4', value: 245 },
  ],
  width: 700,
  height: 400,
  showLegend: true,
  showGrid: true,
  showTooltip: true,
  animationDuration: 500,
};

const DEFAULT_GRAPH_CONFIG: GraphConfig = {
  id: 'graph-1',
  title: 'AI 内容生成流程',
  direction: 'LR',
  nodes: [
    { id: 'n1', type: 'input', position: { x: 0, y: 100 }, data: { label: '用户输入主题' } },
    { id: 'n2', type: 'ai', position: { x: 200, y: 50 }, data: { label: 'AI 生成大纲' } },
    { id: 'n3', type: 'process', position: { x: 200, y: 150 }, data: { label: '模板匹配' } },
    { id: 'n4', type: 'data', position: { x: 400, y: 100 }, data: { label: '内容填充' } },
    { id: 'n5', type: 'output', position: { x: 600, y: 100 }, data: { label: 'PPT 输出' } },
  ],
  edges: [
    { id: 'e1', source: 'n1', target: 'n2' },
    { id: 'e2', source: 'n1', target: 'n3' },
    { id: 'e3', source: 'n2', target: 'n4' },
    { id: 'e4', source: 'n3', target: 'n4' },
    { id: 'e5', source: 'n4', target: 'n5' },
  ],
};

const DEFAULT_DIAGRAM_CONFIG: DiagramConfig = {
  id: 'diagram-1',
  type: 'flowchart',
  title: 'PPT 生成流程图',
  definition: `flowchart TD
    A[用户输入主题] --> B{AI 判断}
    B -->|商务汇报| C[选择商务模板]
    B -->|产品介绍| D[选择科技模板]
    B -->|教育培训| E[选择教育模板]
    C --> F[AI 生成内容]
    D --> F
    E --> F
    F --> G[配色优化]
    G --> H[图片蒙版]
    H --> I[导出 PPT]`,
  theme: 'default',
  scale: 1,
};

// ============ Tab definitions ============

type Tab = { key: P3ComponentType; label: string; icon: string };

const TABS: Tab[] = [
  { key: 'chart', label: '图表', icon: '📊' },
  { key: 'graph', label: '流程图', icon: '🔀' },
  { key: 'diagram', label: '图表(Mermaid)', icon: '📐' },
];

// ============ Main App Component ============

export default function P3ChartApp() {
  const [activeTab, setActiveTab] = useState<P3ComponentType>('chart');
  const [chartConfig, setChartConfig] = useState<ChartConfig>(DEFAULT_CHART_CONFIG);
  const [graphConfig, setGraphConfig] = useState<GraphConfig>(DEFAULT_GRAPH_CONFIG);
  const [diagramConfig, setDiagramConfig] = useState<DiagramConfig>(DEFAULT_DIAGRAM_CONFIG);
  const [editing, setEditing] = useState(false);
  const [showExport, setShowExport] = useState(false);

  const handleEdit = () => setEditing(true);
  const handleCancelEdit = () => setEditing(false);

  const handleSave = (config: ChartConfig | GraphConfig | DiagramConfig) => {
    if (activeTab === 'chart') setChartConfig(config as ChartConfig);
    else if (activeTab === 'graph') setGraphConfig(config as GraphConfig);
    else setDiagramConfig(config as DiagramConfig);
    setEditing(false);
  };

  const handleExport = async (exportConfig: any) => {
    let blob: Blob;
    let filename: string;

    if (activeTab === 'chart') {
      blob = await exportChartToPDF(chartConfig, exportConfig);
      filename = `${chartConfig.title || 'chart'}.pdf`;
    } else if (activeTab === 'graph') {
      blob = await exportGraphToPDF(graphConfig, exportConfig);
      filename = `${graphConfig.title || 'graph'}.pdf`;
    } else {
      blob = await exportDiagramToPDF(diagramConfig, exportConfig);
      filename = `${diagramConfig.title || 'diagram'}.pdf`;
    }

    downloadBlob(blob, filename);
    setShowExport(false);
  };

  const currentConfig = activeTab === 'chart' ? chartConfig : activeTab === 'graph' ? graphConfig : diagramConfig;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-4">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-3">
              <span className="text-2xl">📈</span>
              <div>
                <h1 className="text-lg font-bold text-gray-900">P3 图表·图形·图形模块</h1>
                <p className="text-xs text-gray-500">省心PPT · 图表编辑器 v1.0</p>
              </div>
            </div>
            <button
              onClick={() => setShowExport(true)}
              className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 transition-colors"
            >
              导出
            </button>
          </div>

          {/* Tabs */}
          <div className="flex gap-1">
            {TABS.map((tab) => (
              <button
                key={tab.key}
                onClick={() => { setActiveTab(tab.key); setEditing(false); }}
                className={`px-4 py-2 text-sm font-medium rounded-t-lg transition-colors ${
                  activeTab === tab.key
                    ? 'bg-indigo-50 text-indigo-700 border-b-2 border-indigo-600'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                <span className="mr-1">{tab.icon}</span> {tab.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-6xl mx-auto px-4 py-8">
        {editing ? (
          <div>
            {activeTab === 'chart' && (
              <ChartEditor initialConfig={chartConfig} onSave={handleSave} onCancel={handleCancelEdit} />
            )}
            {activeTab === 'graph' && (
              <GraphEditor initialConfig={graphConfig} onSave={handleSave} onCancel={handleCancelEdit} />
            )}
            {activeTab === 'diagram' && (
              <DiagramEditor initialConfig={diagramConfig} onSave={handleSave} onCancel={handleCancelEdit} />
            )}
          </div>
        ) : (
          <div>
            {/* Toolbar */}
            <div className="flex items-center justify-between mb-4">
              <div>
                <span className="text-sm text-gray-500">
                  {TABS.find((t) => t.key === activeTab)?.label} · {currentConfig.id}
                </span>
              </div>
              <button
                onClick={handleEdit}
                className="px-4 py-2 bg-white border border-gray-300 text-gray-700 rounded-lg text-sm hover:bg-gray-50 transition-colors"
              >
                ✏️ 编辑
              </button>
            </div>

            {/* Renderer */}
            <div className="bg-white rounded-xl p-6 shadow-sm">
              {activeTab === 'chart' && (
                <ChartRenderer config={chartConfig} editable onConfigChange={setChartConfig} />
              )}
              {activeTab === 'graph' && (
                <GraphRenderer config={graphConfig} editable onConfigChange={setGraphConfig} />
              )}
              {activeTab === 'diagram' && (
                <DiagramRenderer config={diagramConfig} editable onConfigChange={setDiagramConfig} />
              )}
            </div>

            {/* Quick Stats */}
            <div className="mt-4 grid grid-cols-3 gap-4">
              <div className="bg-white rounded-lg p-4 shadow-sm">
                <div className="text-2xl font-bold text-indigo-600">
                  {activeTab === 'chart' ? chartConfig.data.length : activeTab === 'graph' ? graphConfig.nodes.length : '-'}
                </div>
                <div className="text-xs text-gray-500">
                  {activeTab === 'chart' ? '数据点' : activeTab === 'graph' ? '节点数' : '图表元素'}
                </div>
              </div>
              <div className="bg-white rounded-lg p-4 shadow-sm">
                <div className="text-2xl font-bold text-green-600">
                  {activeTab === 'chart' ? chartConfig.type : activeTab === 'graph' ? graphConfig.edges.length : diagramConfig.type}
                </div>
                <div className="text-xs text-gray-500">
                  {activeTab === 'chart' ? '图表类型' : activeTab === 'graph' ? '连线数' : '图表类型'}
                </div>
              </div>
              <div className="bg-white rounded-lg p-4 shadow-sm">
                <div className="text-2xl font-bold text-amber-600">
                  {diagramConfig.scale || 1}x
                </div>
                <div className="text-xs text-gray-500">缩放比例</div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Export Modal */}
      {showExport && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <ExportPanel
            title={`导出 ${currentConfig.title || '图表'}`}
            onExport={handleExport}
            onClose={() => setShowExport(false)}
          />
        </div>
      )}
    </div>
  );
}
