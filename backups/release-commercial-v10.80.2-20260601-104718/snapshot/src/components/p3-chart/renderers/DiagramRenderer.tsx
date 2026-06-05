'use client';

import React, { useEffect, useRef, useState } from 'react';
import mermaid from 'mermaid';
import type { DiagramConfig } from '../types';

interface DiagramRendererProps {
  config: DiagramConfig;
  editable?: boolean;
  onConfigChange?: (config: DiagramConfig) => void;
}

let mermaidInitialized = false;

function initMermaid() {
  if (mermaidInitialized) return;
  mermaid.initialize({
    startOnLoad: false,
    theme: 'base',
    securityLevel: 'loose',
    fontFamily: 'Microsoft YaHei, sans-serif',
  });
  mermaidInitialized = true;
}

export function DiagramRenderer({ config, editable = false, onConfigChange }: DiagramRendererProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [svg, setSvg] = useState<string>('');
  const [error, setError] = useState<string>('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    initMermaid();
    renderDiagram();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [config.definition, config.theme, config.type]);

  async function renderDiagram() {
    if (!containerRef.current) return;
    if (!config.definition.trim()) {
      setSvg('');
      setError('');
      return;
    }

    setLoading(true);
    setError('');

    try {
      // Validate mermaid definition by rendering
      const id = `mermaid-${config.id}-${Date.now()}`;
      const { svg: renderedSvg } = await mermaid.render(id, config.definition);
      setSvg(renderedSvg);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : '图表渲染失败，请检查语法');
      setSvg('');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      className="relative"
      style={{
        border: editable ? '2px dashed #c7d2fe' : '1px solid #e5e7eb',
        borderRadius: 12,
        overflow: 'hidden',
        background: config.theme === 'dark' ? '#1f2937' : '#ffffff',
        minHeight: 300,
      }}
    >
      {config.title && (
        <h3
          className="text-center text-lg font-semibold p-3 border-b"
          style={{
            background: config.theme === 'dark' ? '#374151' : '#f9fafb',
            color: config.theme === 'dark' ? '#f3f4f6' : '#1f2937',
            borderColor: config.theme === 'dark' ? '#4b5563' : '#e5e7eb',
          }}
        >
          {config.title}
        </h3>
      )}

      <div ref={containerRef} className="p-4 flex items-center justify-center">
        {loading && (
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600" />
          </div>
        )}
        {error && (
          <div className="text-red-500 text-sm p-4 bg-red-50 rounded-lg max-w-lg">
            <span className="font-semibold">语法错误:</span> {error}
          </div>
        )}
        {svg && !loading && (
          <div
            className="diagram-svg-container"
            style={{ transform: `scale(${config.scale || 1})`, transformOrigin: 'center' }}
            dangerouslySetInnerHTML={{ __html: svg }}
          />
        )}
        {!svg && !error && !loading && (
          <div className="text-gray-400 text-sm">输入 Mermaid 语法以渲染图表</div>
        )}
      </div>

      {editable && (
        <div className="absolute top-2 right-2 bg-indigo-600 text-white text-xs px-2 py-1 rounded cursor-pointer hover:bg-indigo-700">
          编辑
        </div>
      )}
      {onConfigChange ? null : null}
    </div>
  );
}

export default DiagramRenderer;
