/**
 * graph-renderer.ts
 * XYFlow → Mermaid → PNG 渲染管线
 * 导出 2x 分辨率 PNG
 */

import { xyflowToMermaid, getMermaidTheme } from './mermaid-converter';
import type { XyflowNode, XyflowEdge } from './mermaid-converter';

export interface GraphRenderOptions {
  scale?: number;         // 导出分辨率倍数，默认 2
  themeColor?: string;     // 主题色，用于 Mermaid 主题变量
  backgroundColor?: string; // 背景色
  format?: 'png' | 'svg';
}

export interface GraphRenderResult {
  dataUrl: string;         // data:image/png;base64,...
  svgString?: string;
  mermaidCode: string;
  width: number;
  height: number;
}

const DEFAULT_OPTIONS: Required<GraphRenderOptions> = {
  scale: 2,
  themeColor: '#6366f1',
  backgroundColor: '#ffffff',
  format: 'png',
};

/**
 * Render XYFlow graph to PNG via Mermaid
 * Uses mermaid.run() with a temporary container
 */
export async function renderGraphToMermaid(
  nodes: XyflowNode[],
  edges: XyflowEdge[],
  direction: 'TB' | 'BT' | 'LR' | 'RL' = 'LR',
  options: GraphRenderOptions = {}
): Promise<GraphRenderResult> {
  const opts = { ...DEFAULT_OPTIONS, ...options };

  // Dynamically import mermaid to avoid SSR issues
  const mermaid = (await import('mermaid')).default;

  const mermaidCode = xyflowToMermaid(nodes, edges, direction);
  const themeConfig = getMermaidTheme(opts.themeColor);
  const fullCode = `${themeConfig}\n${mermaidCode}`;

  // Configure mermaid
  mermaid.initialize({
    startOnLoad: false,
    theme: 'base',
    flowchart: { useMaxWidth: false, htmlLabels: true, curve: 'basis' },
    securityLevel: 'loose',
  });

  const id = `mermaid-${Date.now()}-${Math.random().toString(36).slice(2)}`;

  try {
    const { svg } = await mermaid.render(id, fullCode);

    // Convert SVG to PNG
    const pngDataUrl = await svgToDataUrl(svg, opts.scale, opts.backgroundColor);

    // Calculate dimensions
    const parser = new DOMParser();
    const doc = parser.parseFromString(svg, 'image/svg+xml');
    const svgEl = doc.documentElement;
    const width = parseFloat(svgEl.getAttribute('width') ?? '800') * opts.scale;
    const height = parseFloat(svgEl.getAttribute('height') ?? '400') * opts.scale;

    return {
      dataUrl: pngDataUrl,
      svgString: svg,
      mermaidCode,
      width,
      height,
    };
  } catch (err) {
    console.error('[graph-renderer] Mermaid render failed:', err);
    throw new Error(`Mermaid rendering failed: ${err instanceof Error ? err.message : String(err)}`);
  }
}

/**
 * Convert SVG string to data URL (PNG or SVG)
 */
async function svgToDataUrl(
  svgString: string,
  scale: number,
  backgroundColor: string
): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');

    if (!ctx) {
      reject(new Error('Canvas 2D context not available'));
      return;
    }

    img.onload = () => {
      canvas.width = img.naturalWidth * scale;
      canvas.height = img.naturalHeight * scale;
      ctx.scale(scale, scale);
      if (backgroundColor !== 'transparent') {
        ctx.fillStyle = backgroundColor;
        ctx.fillRect(0, 0, img.naturalWidth, img.naturalHeight);
      }
      ctx.drawImage(img, 0, 0);
      resolve(canvas.toDataURL('image/png'));
    };

    img.onerror = () => reject(new Error('Failed to load SVG as image'));

    // Embed fonts and images as data URIs in SVG
    const svgBlob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
    img.src = URL.createObjectURL(svgBlob);
  });
}

/**
 * Export current graph as PNG file download
 */
export function downloadGraphPng(dataUrl: string, filename = 'logic-graph.png'): void {
  const link = document.createElement('a');
  link.download = filename;
  link.href = dataUrl;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

/**
 * Apply theme color to all nodes in a graph
 */
export function applyThemeColor(
  nodes: XyflowNode[],
  themeColor: string
): XyflowNode[] {
  return nodes.map((node) => ({
    ...node,
    data: {
      ...node.data,
      color: node.data.color ?? themeColor,
    },
  }));
}
