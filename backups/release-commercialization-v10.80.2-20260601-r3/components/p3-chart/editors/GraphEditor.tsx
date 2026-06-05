'use client';

import React, { useState, useCallback } from 'react';
import type { GraphConfig, GraphNode, GraphEdge, GraphNodeType, GraphEdgeType } from '../types';

interface GraphEditorProps {
  initialConfig: GraphConfig;
  onSave: (config: GraphConfig) => void;
  onCancel: () => void;
}

const NODE_TYPE_OPTIONS: { value: GraphNodeType; label: string; color: string }[] = [
  { value: 'input', label: '输入', color: '#10B981' },
  { value: 'default', label: '默认', color: '#6366F1' },
  { value: 'output', label: '输出', color: '#EF4444' },
  { value: 'ai', label: 'AI节点', color: '#8B5CF6' },
  { value: 'data', label: '数据', color: '#06B6D4' },
  { value: 'process', label: '处理', color: '#F59E0B' },
];

const DIRECTION_OPTIONS = [
  { value: 'LR', label: '从左到右' },
  { value: 'TB', label: '从上到下' },
  { value: 'RL', label: '从右到左' },
  { value: 'BT', label: '从下到上' },
];

export function GraphEditor({ initialConfig, onSave, onCancel }: GraphEditorProps) {
  const [config, setConfig] = useState<GraphConfig>(initialConfig);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);

  const update = (patch: Partial<GraphConfig>) => setConfig((c) => ({ ...c, ...patch }));

  const addNode = useCallback(() => {
    const newNode: GraphNode = {
      id: `node-${Date.now()}`,
      type: 'default',
      position: { x: Math.random() * 300 + 50, y: Math.random() * 200 + 50 },
      data: { label: '新节点' },
    };
    update({ nodes: [...config.nodes, newNode] });
    setSelectedNodeId(newNode.id);
  }, [config.nodes]);

  const updateNode = (id: string, patch: Partial<GraphNode>) => {
    update({
      nodes: config.nodes.map((n) => (n.id === id ? { ...n, ...patch } : n)),
    });
  };

  const removeNode = (id: string) => {
    update({
      nodes: config.nodes.filter((n) => n.id !== id),
      edges: config.edges.filter((e) => e.source !== id && e.target !== id),
    });
    if (selectedNodeId === id) setSelectedNodeId(null);
  };

  const addEdge = () => {
    if (config.nodes.length < 2) return;
    const sourceId = config.nodes[0].id;
    const targetId = config.nodes[1].id;
    const newEdge: GraphEdge = {
      id: `edge-${Date.now()}`,
      source: sourceId,
      target: targetId,
      type: 'default',
    };
    update({ edges: [...config.edges, newEdge] });
  };

  const removeEdge = (id: string) => {
    update({ edges: config.edges.filter((e) => e.id !== id) });
  };

  const selectedNode = config.nodes.find((n) => n.id === selectedNodeId);

  const inputStyle = 'w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500';
  const labelStyle = 'block text-sm font-medium text-gray-700 mb-1';

  return (
    <div className="bg-white rounded-xl shadow-lg p-6 max-w-3xl mx-auto">
      <h2 className="text-xl font-bold text-gray-800 mb-6">流程图编辑器</h2>

      {/* Title & Direction */}
      <div className="grid grid-cols-2 gap-4 mb-6">
        <div>
          <label className={labelStyle}>图表标题</label>
          <input
            className={inputStyle}
            value={config.title}
            onChange={(e) => update({ title: e.target.value })}
            placeholder="输入图表标题"
          />
        </div>
        <div>
          <label className={labelStyle}>布局方向</label>
          <div className="grid grid-cols-4 gap-1">
            {DIRECTION_OPTIONS.map((d) => (
              <button
                key={d.value}
                onClick={() => update({ direction: d.value as GraphConfig['direction'] })}
                className={`px-2 py-1.5 rounded text-xs font-medium transition-colors ${
                  config.direction === d.value
                    ? 'bg-indigo-600 text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {d.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Node List */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-2">
          <label className={labelStyle} style={{ marginBottom: 0 }}>节点列表</label>
          <button
            onClick={addNode}
            className="px-3 py-1 bg-indigo-600 text-white text-xs rounded hover:bg-indigo-700"
          >
            + 添加节点
          </button>
        </div>
        <div className="border border-gray-200 rounded-lg overflow-hidden max-h-48 overflow-y-auto">
          {config.nodes.length === 0 && (
            <div className="text-center text-gray-400 text-sm py-4">暂无节点，点击上方添加</div>
          )}
          {config.nodes.map((node) => (
            <div
              key={node.id}
              onClick={() => setSelectedNodeId(node.id)}
              className={`flex items-center justify-between px-3 py-2 border-b border-gray-100 cursor-pointer hover:bg-indigo-50 ${
                selectedNodeId === node.id ? 'bg-indigo-50' : ''
              }`}
            >
              <div className="flex items-center gap-2">
                <span
                  className="w-3 h-3 rounded-full"
                  style={{ background: NODE_TYPE_OPTIONS.find((t) => t.value === node.type)?.color }}
                />
                <span className="text-sm text-gray-800">{node.data.label}</span>
                <span className="text-xs text-gray-400">({node.type})</span>
              </div>
              <button
                onClick={(e) => { e.stopPropagation(); removeNode(node.id); }}
                className="text-red-400 hover:text-red-600 text-xs"
              >
                删除
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Node Detail Editor */}
      {selectedNode && (
        <div className="mb-6 p-4 bg-gray-50 rounded-lg border border-gray-200">
          <h3 className="text-sm font-semibold text-gray-700 mb-3">节点详情</h3>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelStyle}>节点标签</label>
              <input
                className={inputStyle}
                value={selectedNode.data.label}
                onChange={(e) => updateNode(selectedNode.id, {
                  data: { ...selectedNode.data, label: e.target.value },
                })}
              />
            </div>
            <div>
              <label className={labelStyle}>节点类型</label>
              <select
                className={inputStyle}
                value={selectedNode.type}
                onChange={(e) => updateNode(selectedNode.id, { type: e.target.value as GraphNodeType })}
              >
                {NODE_TYPE_OPTIONS.map((t) => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>
            </div>
            <div className="col-span-2">
              <label className={labelStyle}>描述（可选）</label>
              <input
                className={inputStyle}
                value={selectedNode.data.description || ''}
                onChange={(e) => updateNode(selectedNode.id, {
                  data: { ...selectedNode.data, description: e.target.value },
                })}
                placeholder="节点描述"
              />
            </div>
          </div>
        </div>
      )}

      {/* Edge List */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-2">
          <label className={labelStyle} style={{ marginBottom: 0 }}>连线列表</label>
          <button
            onClick={addEdge}
            disabled={config.nodes.length < 2}
            className="px-3 py-1 bg-indigo-600 text-white text-xs rounded hover:bg-indigo-700 disabled:opacity-50"
          >
            + 添加连线
          </button>
        </div>
        <div className="border border-gray-200 rounded-lg overflow-hidden">
          {config.edges.length === 0 && (
            <div className="text-center text-gray-400 text-sm py-4">暂无连线</div>
          )}
          {config.edges.map((edge) => (
            <div key={edge.id} className="flex items-center justify-between px-3 py-2 border-b border-gray-100">
              <span className="text-sm text-gray-700">
                {config.nodes.find((n) => n.id === edge.source)?.data.label || edge.source}
                {' → '}
                {config.nodes.find((n) => n.id === edge.target)?.data.label || edge.target}
              </span>
              <div className="flex items-center gap-2">
                <select
                  className="text-xs border border-gray-300 rounded px-1 py-0.5"
                  value={edge.type || 'default'}
                  onChange={(e) => update({
                    edges: config.edges.map((ed) =>
                      ed.id === edge.id ? { ...ed, type: e.target.value as GraphEdgeType } : ed
                    ),
                  })}
                >
                  <option value="default">默认</option>
                  <option value="step">阶梯</option>
                  <option value="smooth">平滑</option>
                  <option value="straight">直线</option>
                </select>
                <button
                  onClick={() => removeEdge(edge.id)}
                  className="text-red-400 hover:text-red-600 text-xs"
                >
                  删除
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Actions */}
      <div className="flex gap-3 justify-end">
        <button onClick={onCancel} className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg text-sm hover:bg-gray-200">
          取消
        </button>
        <button onClick={() => onSave(config)} className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm hover:bg-indigo-700">
          保存流程图
        </button>
      </div>
    </div>
  );
}

export default GraphEditor;
