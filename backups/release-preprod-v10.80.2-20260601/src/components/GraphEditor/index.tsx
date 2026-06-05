'use client';

import React, { useState, useCallback, useRef } from 'react';
import type { Node } from '@xyflow/react';
import { FlowCanvas } from './FlowCanvas';
import { GraphToolbar } from './GraphToolbar';
import { NodePalette } from './NodePalette';
import { PropertiesPanel } from './PropertiesPanel';
import { TemplateGallery } from './TemplateGallery';
import { MermaidPreview } from './MermaidPreview';
import { renderGraphToMermaid, downloadGraphPng, applyThemeColor } from '@/lib/graph/graph-renderer';
import type { XyflowNode, XyflowEdge, NodeShape } from '@/lib/graph/mermaid-converter';
import type { GraphTemplate } from '@/lib/graph/graph-templates';

export interface GraphEditorProps {
  initialNodes?: XyflowNode[];
  initialEdges?: XyflowEdge[];
  direction?: 'TB' | 'BT' | 'LR' | 'RL';
  themeColor?: string;
  onThemeColorChange?: (color: string) => void;
  onExportReady?: (dataUrl: string) => void;
  className?: string;
}

let nodeCounter = 0;
function newNodeId(): string {
  return `node_${Date.now()}_${++nodeCounter}`;
}

export function GraphEditor({
  initialNodes = [],
  initialEdges = [],
  direction = 'LR',
  themeColor: initialThemeColor = '#6366f1',
  onThemeColorChange,
  onExportReady,
  className,
}: GraphEditorProps) {
  const [nodes, setNodes] = useState<XyflowNode[]>(initialNodes);
  const [edges, setEdges] = useState<XyflowEdge[]>(initialEdges);
  const [selectedNode, setSelectedNode] = useState<Node | null>(null);
  const [themeColor, setThemeColor] = useState(initialThemeColor);
  const [isExporting, setIsExporting] = useState(false);
  const [showTemplates, setShowTemplates] = useState(false);
  const [showMermaid, setShowMermaid] = useState(false);

  const rfNodesRef = useRef<XyflowNode[]>(initialNodes);

  const handleNodesChange = useCallback((newNodes: XyflowNode[]) => {
    rfNodesRef.current = newNodes;
    setNodes(newNodes);
  }, []);

  const handleEdgesChange = useCallback((newEdges: XyflowEdge[]) => {
    setEdges(newEdges);
  }, []);

  const handleAddNode = useCallback((type: NodeShape) => {
    const newNode: XyflowNode = {
      id: newNodeId(),
      type,
      position: { x: 200 + Math.random() * 200, y: 100 + Math.random() * 100 },
      data: { label: '新节点', color: themeColor },
    };
    const updated = [...nodes, newNode];
    setNodes(updated);
    rfNodesRef.current = updated;
  }, [nodes, themeColor]);

  const handleUpdateNode = useCallback((id: string, data: Partial<XyflowNode['data']>) => {
    const updated = nodes.map((n) =>
      n.id === id ? { ...n, data: { ...n.data, ...data } } : n
    );
    setNodes(updated);
    rfNodesRef.current = updated;
  }, [nodes]);

  const handleDeleteNode = useCallback((id: string) => {
    const updated = nodes.filter((n) => n.id !== id);
    const updatedEdges = edges.filter((e) => e.source !== id && e.target !== id);
    setNodes(updated);
    setEdges(updatedEdges);
    rfNodesRef.current = updated;
    setSelectedNode(null);
  }, [nodes, edges]);

  const handleClear = useCallback(() => {
    setNodes([]);
    setEdges([]);
    rfNodesRef.current = [];
    setSelectedNode(null);
  }, []);

  const handleExport = useCallback(async () => {
    setIsExporting(true);
    try {
      const themed = applyThemeColor(rfNodesRef.current, themeColor);
      const result = await renderGraphToMermaid(themed, edges, direction, {
        themeColor,
        scale: 2,
        format: 'png',
      });
      downloadGraphPng(result.dataUrl, `logic-graph-${Date.now()}.png`);
      onExportReady?.(result.dataUrl);
    } catch (err) {
      console.error('[GraphEditor] Export failed:', err);
      alert('导出失败: ' + (err instanceof Error ? err.message : String(err)));
    } finally {
      setIsExporting(false);
    }
  }, [themeColor, edges, direction, onExportReady]);

  const handleApplyTemplate = useCallback((template: GraphTemplate) => {
    const prefix = `tpl_${Date.now()}_`;
    const remappedNodes = template.nodes.map((n) => ({ ...n, id: prefix + n.id }));
    const remappedEdges = template.edges.map((e) => ({
      ...e,
      id: prefix + e.id,
      source: prefix + e.source,
      target: prefix + e.target,
    }));
    setNodes(remappedNodes);
    setEdges(remappedEdges);
    rfNodesRef.current = remappedNodes;
  }, []);

  return (
    <div
      className={className}
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        border: '1px solid #e2e8f0',
        borderRadius: 8,
        overflow: 'hidden',
        background: '#fff',
      }}
    >
      {/* Toolbar */}
      <GraphToolbar
        themeColor={themeColor}
        onThemeColorChange={(c) => {
          setThemeColor(c);
          onThemeColorChange?.(c);
        }}
        onExport={handleExport}
        onPreview={() => setShowMermaid(true)}
        onClear={handleClear}
        isExporting={isExporting}
        direction={direction}
        onDirectionChange={() => {}} // Direction only affects Mermaid export
      />

      {/* Main area */}
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        {/* Node palette */}
        <NodePalette onAddNode={handleAddNode} themeColor={themeColor} />

        {/* Canvas */}
        <div style={{ flex: 1, position: 'relative' }}>
          <FlowCanvas
            initialNodes={nodes}
            initialEdges={edges}
            onNodesChange={handleNodesChange}
            onEdgesChange={handleEdgesChange}
            themeColor={themeColor}
            onNodeSelect={setSelectedNode}
          />

          {/* Template button overlay */}
          <button
            onClick={() => setShowTemplates(true)}
            style={{
              position: 'absolute',
              top: 12,
              right: 12,
              padding: '6px 14px',
              fontSize: 12,
              borderRadius: 6,
              border: '1px solid #e2e8f0',
              background: '#fff',
              color: '#6366f1',
              cursor: 'pointer',
              fontWeight: 600,
              boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
              zIndex: 10,
            }}
          >
            📋 模板库
          </button>
        </div>

        {/* Properties panel */}
        <PropertiesPanel
          selectedNode={selectedNode}
          onUpdateNode={handleUpdateNode}
          onDeleteNode={handleDeleteNode}
        />
      </div>

      {/* Modals */}
      {showTemplates && (
        <TemplateGallery
          onSelect={handleApplyTemplate}
          onClose={() => setShowTemplates(false)}
        />
      )}

      {showMermaid && (
        <MermaidPreview
          nodes={nodes}
          edges={edges}
          direction={direction}
          themeColor={themeColor}
          onClose={() => setShowMermaid(false)}
        />
      )}
    </div>
  );
}
