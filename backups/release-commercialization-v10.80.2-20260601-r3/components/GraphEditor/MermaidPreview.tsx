'use client';

import React, { useEffect, useRef, useState } from 'react';
import { xyflowToMermaid, getMermaidTheme } from '@/lib/graph/mermaid-converter';
import type { XyflowNode, XyflowEdge } from '@/lib/graph/mermaid-converter';

export interface MermaidPreviewProps {
  nodes: XyflowNode[];
  edges: XyflowEdge[];
  direction: 'TB' | 'BT' | 'LR' | 'RL';
  themeColor: string;
  onClose: () => void;
}

export function MermaidPreview({ nodes, edges, direction, themeColor, onClose }: MermaidPreviewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<string | null>(null);

  const mermaidCode = xyflowToMermaid(nodes, edges, direction);
  const themeConfig = getMermaidTheme(themeColor);
  const fullCode = `${themeConfig}\n${mermaidCode}`;

  useEffect(() => {
    let cancelled = false;

    async function render() {
      try {
        const mermaid = (await import('mermaid')).default;
        mermaid.initialize({
          startOnLoad: false,
          theme: 'base',
          flowchart: { useMaxWidth: false, htmlLabels: true },
          securityLevel: 'loose',
        });

        if (cancelled || !containerRef.current) return;

        // Clear previous
        containerRef.current.innerHTML = '';
        const id = `mermaid-preview-${Date.now()}`;
        const { svg } = await mermaid.render(id, fullCode);

        if (!cancelled && containerRef.current) {
          containerRef.current.innerHTML = svg;
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : String(err));
        }
      }
    }

    render();
    return () => { cancelled = true; };
  }, [fullCode]);

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: '#fff',
          borderRadius: 12,
          width: '90vw',
          maxWidth: 900,
          maxHeight: '85vh',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 20px 60px rgba(0,0,0,0.2)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          style={{
            padding: '14px 20px',
            borderBottom: '1px solid #e2e8f0',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div>
            <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: '#1e293b' }}>Mermaid 预览</h3>
            <p style={{ margin: '3px 0 0', fontSize: 11, color: '#94a3b8' }}>
              点击外部关闭 · 复制按钮复制 Mermaid 代码
            </p>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              onClick={() => navigator.clipboard.writeText(mermaidCode)}
              style={{
                padding: '6px 12px',
                fontSize: 12,
                borderRadius: 6,
                border: '1px solid #e2e8f0',
                background: '#fff',
                color: '#64748b',
                cursor: 'pointer',
                fontWeight: 500,
              }}
            >
              复制代码
            </button>
            <button
              onClick={onClose}
              style={{
                width: 32,
                height: 32,
                borderRadius: '50%',
                border: '1px solid #e2e8f0',
                background: '#fff',
                cursor: 'pointer',
                fontSize: 18,
                color: '#64748b',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              ×
            </button>
          </div>
        </div>

        {/* Preview */}
        <div
          ref={containerRef}
          style={{
            flex: 1,
            overflow: 'auto',
            padding: 24,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: '#f8fafc',
          }}
        />

        {/* Error */}
        {error && (
          <div style={{ padding: '12px 20px', background: '#fef2f2', color: '#ef4444', fontSize: 12 }}>
            渲染错误: {error}
          </div>
        )}

        {/* Code preview */}
        <details style={{ borderTop: '1px solid #e2e8f0' }}>
          <summary
            style={{
              padding: '8px 20px',
              fontSize: 12,
              color: '#94a3b8',
              cursor: 'pointer',
              fontWeight: 500,
            }}
          >
            查看 Mermaid 代码
          </summary>
          <pre
            style={{
              margin: 0,
              padding: '12px 20px',
              fontSize: 11,
              background: '#1e293b',
              color: '#e2e8f0',
              maxHeight: 200,
              overflow: 'auto',
              fontFamily: 'Menlo, monospace',
              lineHeight: 1.6,
            }}
          >
            {fullCode}
          </pre>
        </details>
      </div>
    </div>
  );
}
