'use client';

import React, { useCallback, useState } from 'react';
import {
  ReactFlow,
  Controls,
  Background,
  MiniMap,
  Node,
  Edge,
  Connection,
  addEdge,
  useNodesState,
  useEdgesState,
  BackgroundVariant,
  Panel,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import type { GraphConfig, GraphNode, GraphEdge, GraphNodeType, GraphEdgeType } from '../types';

const NODE_COLORS: Record<GraphNodeType, string> = {
  input: '#10B981',
  default: '#6366F1',
  output: '#EF4444',
  ai: '#8B5CF6',
  data: '#06B6D4',
  process: '#F59E0B',
};

const NODE_STYLE_MAP: Record<GraphNodeType, React.CSSProperties> = {
  input: { background: '#D1FAE5', border: '2px solid #10B981', borderRadius: 8, padding: 10, fontSize: 14 },
  default: { background: '#EEF2FF', border: '2px solid #6366F1', borderRadius: 8, padding: 10, fontSize: 14 },
  output: { background: '#FEE2E2', border: '2px solid #EF4444', borderRadius: 8, padding: 10, fontSize: 14 },
  ai: { background: '#F3E8FF', border: '2px solid #8B5CF6', borderRadius: 8, padding: 10, fontSize: 14 },
  data: { background: '#CFFAFE', border: '2px solid #06B6D4', borderRadius: 8, padding: 10, fontSize: 14 },
  process: { background: '#FEF3C7', border: '2px solid #F59E0B', borderRadius: 8, padding: 10, fontSize: 14 },
};

const EDGE_STYLE_MAP: Record<GraphEdgeType, string> = {
  default: '#6366F1',
  step: '#10B981',
  smooth: '#F59E0B',
  straight: '#EF4444',
};

interface GraphRendererProps {
  config: GraphConfig;
  editable?: boolean;
  onConfigChange?: (config: GraphConfig) => void;
}

function toFlowNodes(nodes: GraphNode[]): Node[] {
  return nodes.map((n) => ({
    id: n.id,
    type: n.type,
    position: n.position,
    data: { label: n.data.label, description: n.data.description },
    style: {
      ...NODE_STYLE_MAP[n.type],
      ...(n.style || {}),
    },
  }));
}

function toFlowEdges(edges: GraphEdge[]): Edge[] {
  return edges.map((e) => ({
    id: e.id,
    source: e.source,
    target: e.target,
    type: e.type || 'default',
    label: e.label,
    animated: e.animated,
    style: { stroke: EDGE_STYLE_MAP[e.type || 'default'] },
  }));
}

export function GraphRenderer({ config, editable = false, onConfigChange }: GraphRendererProps) {
  const [selectedNode, setSelectedNode] = useState<string | null>(null);

  const flowNodes = toFlowNodes(config.nodes);
  const flowEdges = toFlowEdges(config.edges);

  const [nodes, setNodes, onNodesChange] = useNodesState(flowNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(flowEdges);

  const onConnect = useCallback(
    (params: Connection) => {
      const newEdge: Edge = {
        id: `e-${params.source}-${params.target}-${Date.now()}`,
        source: params.source!,
        target: params.target!,
        type: 'default',
        style: { stroke: EDGE_STYLE_MAP.default },
      };
      setEdges((eds) => addEdge(newEdge, eds));
      if (onConfigChange) {
        const newGraphEdges: GraphEdge[] = [
          ...config.edges,
          {
            id: newEdge.id,
            source: newEdge.source!,
            target: newEdge.target!,
            type: 'default',
          },
        ];
        onConfigChange({ ...config, edges: newGraphEdges });
      }
    },
    [config, onConfigChange, setEdges]
  );

  const onNodeClick = useCallback((_: React.MouseEvent, node: Node) => {
    setSelectedNode(node.id);
  }, []);

  const containerStyle: React.CSSProperties = {
    border: editable ? '2px dashed #c7d2fe' : '1px solid #e5e7eb',
    borderRadius: 12,
    overflow: 'hidden',
    background: '#fafafa',
  };

  return (
    <div style={containerStyle}>
      {config.title && (
        <h3 className="text-center text-lg font-semibold p-3 text-gray-800 border-b bg-white">{config.title}</h3>
      )}
      <div style={{ height: config.nodes.length > 10 ? 600 : 400 }}>
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          onNodeClick={onNodeClick}
          nodesDraggable={editable}
          nodesConnectable={editable}
          fitView
          attributionPosition="bottom-right"
        >
          <Controls />
          <MiniMap nodeColor={(n) => NODE_COLORS[(n.type as GraphNodeType) || 'default']} />
          <Background variant={BackgroundVariant.Dots} gap={16} size={1} />
          {editable && (
            <Panel position="top-right">
              <div className="bg-white px-3 py-2 rounded-lg shadow text-xs text-gray-500">
                {selectedNode ? `已选节点: ${selectedNode}` : '点击节点选择 | 拖拽连接'}
              </div>
            </Panel>
          )}
        </ReactFlow>
      </div>
    </div>
  );
}

export default GraphRenderer;
