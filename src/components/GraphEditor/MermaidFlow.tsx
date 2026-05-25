'use client';

import React, { useEffect, useRef, useState } from 'react';
import { xyflowToMermaid, getMermaidTheme } from '@/lib/graph/mermaid-converter';
import type { XyflowNode, XyflowEdge } from '@/lib/graph/mermaid-converter';

export interface MermaidFlowProps {
  nodes: XyflowNode[];
  edges: XyflowEdge[];
  direction?: 'TB' | 'BT' | 'LR' | 'RL';
  themeColor?: string;
  backgroundColor?: string;
  className?: string;
}

/**
 * MermaidFlow — Mermaid 降级渲染组件
 *
 * 当 XYFlow 画布结构过于复杂或 Mermaid 原生支持该图形类型时，
 * 使用 Mermaid 直接渲染为 SVG，保证最佳视觉效果。
 *
 * 渲染策略：
 * 1. 简单结构（flowchart/mindmap/timeline）→ Mermaid 直接渲染
 * 2. 复杂自定义节点 → XYFlow SVG 降级（由 FlowCanvas 处理）
 */
export function MermaidFlow({
  nodes,
  edges,
  direction = 'LR',
  themeColor = '#6366f1',
  backgroundColor = '#ffffff',
  className,
}: MermaidFlowProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [svgContent, setSvgContent] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const mermaidCode = xyflowToMermaid(nodes, edges, direction);
  const themeConfig = getMermaidTheme(themeColor);
  const fullCode = `${themeConfig}\n${mermaidCode}`;

  useEffect(() => {
    let cancelled = false;

    async function render() {
      if (!containerRef.current || nodes.length === 0) return;

      try {
        const mermaid = (await import('mermaid')).default;
        mermaid.initialize({
          startOnLoad: false,
          theme: 'base',
          flowchart: { useMaxWidth: false, htmlLabels: true, curve: 'basis' },
          securityLevel: 'loose',
        });

        if (cancelled) return;

        const id = `mermaid-flow-${Date.now()}-${Math.random().toString(36).slice(2)}`;
        const { svg } = await mermaid.render(id, fullCode);

        if (cancelled) return;

        // Inject background
        const bgSvg = backgroundColor && backgroundColor !== 'transparent'
          ? svg.replace('<svg', `<svg style="background:${backgroundColor}"`)
          : svg;

        setSvgContent(bgSvg);
        setError(null);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : String(err));
          setSvgContent(null);
        }
      }
    }

    render();
    return () => { cancelled = true; };
  }, [fullCode, backgroundColor]);

  if (error) {
    return (
      <div
        className={className}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#fef2f2',
          border: '1px solid #fecaca',
          borderRadius: 8,
          padding: 16,
          color: '#ef4444',
          fontSize: 13,
          minHeight: 120,
        }}
      >
        Mermaid 渲染失败: {error}
      </div>
    );
  }

  if (!svgContent) {
    return (
      <div
        className={className}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#f8fafc',
          borderRadius: 8,
          padding: 16,
          color: '#94a3b8',
          fontSize: 13,
          minHeight: 120,
        }}
      >
        正在渲染图形...
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className={className}
      style={{
        background: backgroundColor && backgroundColor !== 'transparent' ? backgroundColor : '#f8fafc',
        borderRadius: 8,
        padding: 16,
        overflow: 'auto',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
      dangerouslySetInnerHTML={{ __html: svgContent }}
    />
  );
}

export default MermaidFlow;
