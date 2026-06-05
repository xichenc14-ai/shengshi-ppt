'use client';

import React, { useCallback, useState } from 'react';
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  addEdge,
  useNodesState,
  useEdgesState,
  type Node,
  type Edge,
  type Connection,
  type NodeTypes,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';

import { RectNode } from './nodes/RectNode';
import { DiamondNode } from './nodes/DiamondNode';
import { CircleNode } from './nodes/CircleNode';
import { CylinderNode } from './nodes/CylinderNode';
import { ParallelogramNode } from './nodes/ParallelogramNode';
import { HexagonNode } from './nodes/HexagonNode';
import { SubroutineNode } from './nodes/SubroutineNode';
import { TextNode } from './nodes/TextNode';
import type { XyflowNode, XyflowEdge } from '@/lib/graph/mermaid-converter';

const nodeTypes: NodeTypes = {
  rect: RectNode,
  diamond: DiamondNode,
  circle: CircleNode,
  cylinder: CylinderNode,
  parallelogram: ParallelogramNode,
  hexagon: HexagonNode,
  subroutine: SubroutineNode,
  text: TextNode,
};

export interface FlowCanvasProps {
  initialNodes?: XyflowNode[];
  initialEdges?: XyflowEdge[];
  onNodesChange?: (nodes: XyflowNode[]) => void;
  onEdgesChange?: (edges: XyflowEdge[]) => void;
  readOnly?: boolean;
  themeColor?: string;
  onNodeSelect?: (node: Node | null) => void;
}

function toReactFlowNodes(nodes: XyflowNode[]): Node[] {
  return nodes.map((n) => ({
    id: n.id,
    type: n.type,
    position: n.position,
    data: n.data,
    width: n.width,
    height: n.height,
    style: n.style,
  }));
}

function toXyflowNodes(nodes: Node[]): XyflowNode[] {
  return nodes.map((n) => ({
    id: n.id,
    type: n.type as XyflowNode['type'],
    position: n.position,
    data: n.data as XyflowNode['data'],
    width: n.width,
    height: n.height,
    style: n.style as Record<string, string>,
  }));
}

function toXyflowEdges(edges: Edge[]): XyflowEdge[] {
  return edges.map((e) => ({
    id: e.id,
    source: e.source,
    target: e.target,
    label: e.label as string | undefined,
    type: e.type,
    animated: e.animated,
    style: e.style as Record<string, string>,
  }));
}

export function FlowCanvas({
  initialNodes = [],
  initialEdges = [],
  onNodesChange,
  onEdgesChange,
  readOnly = false,
  themeColor = '#6366f1',
  onNodeSelect,
}: FlowCanvasProps) {
  const rfNodes = toReactFlowNodes(initialNodes);
  const rfEdges: Edge[] = initialEdges.map((e) => ({
    id: e.id,
    source: e.source,
    target: e.target,
    label: e.label,
    animated: e.animated,
    style: e.style,
    type: 'smoothstep',
  }));

  const [nodes, setNodes, onNodesChangeInternal] = useNodesState(rfNodes);
  const [edges, setEdges, onEdgesChangeInternal] = useEdgesState(rfEdges);

  const onConnect = useCallback(
    (connection: Connection) => {
      setEdges((eds) =>
        addEdge(
          {
            ...connection,
            type: 'smoothstep',
            animated: false,
          },
          eds
        )
      );
    },
    [setEdges]
  );

  const handleNodesChange = useCallback(
    (changed: Parameters<typeof onNodesChangeInternal>[0]) => {
      onNodesChangeInternal(changed);
      if (onNodesChange) {
        setNodes((current) => {
          onNodesChange(toXyflowNodes(current));
          return current;
        });
      }
    },
    [onNodesChangeInternal, onNodesChange]
  );

  const handleEdgesChange = useCallback(
    (changed: Parameters<typeof onEdgesChangeInternal>[0]) => {
      onEdgesChangeInternal(changed);
      if (onEdgesChange) {
        setEdges((current) => {
          onEdgesChange(toXyflowEdges(current));
          return current;
        });
      }
    },
    [onEdgesChangeInternal, onEdgesChange]
  );

  return (
    <div style={{ width: '100%', height: '100%', background: '#f8fafc' }}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={handleNodesChange}
        onEdgesChange={handleEdgesChange}
        onConnect={onConnect}
        onSelectionChange={({ nodes: selectedNodes }) => {
          onNodeSelect?.(selectedNodes.length > 0 ? selectedNodes[0] : null);
        }}
        nodeTypes={nodeTypes}
        fitView
        defaultEdgeOptions={{ type: 'smoothstep' }}
        deleteKeyCode={readOnly ? null : 'Delete'}
      >
        <Background color="#e2e8f0" gap={20} />
        <Controls />
        <MiniMap
          nodeColor={(n) => {
            const color = (n.data as { color?: string })?.color ?? themeColor;
            return color;
          }}
          maskColor="rgba(0,0,0,0.1)"
        />
      </ReactFlow>
    </div>
  );
}
