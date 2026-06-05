/**
 * renderers/svgRenderer.ts — Recharts → SVG → PNG 渲染管线
 *
 * 渲染流程：recharts 在 hidden container 中渲染 → 提取 SVG → 序列化 → PNG
 * 支持 2x 分辨率导出
 */

import { buildChartStyle, buildGridConfig, buildAxisConfig, buildTooltipConfig, getChartColors } from '../themeAdapter';

// ============ 类型定义 ============

export type ChartType = 'bar' | 'line' | 'pie' | 'area' | 'scatter' | 'radar' | 'funnel';

export interface RenderOptions {
  width: number;
  height: number;
  scale?: number;          // 导出分辨率倍数，默认 2
  format?: 'svg' | 'png';
  backgroundColor?: string; // 导出背景色，默认透明
  includeTitle?: boolean;
}

export interface RenderResult {
  svgString: string;
  dataUrl: string;         // data:image/png;base64,...
  blob: Blob;
  width: number;
  height: number;
}

const DEFAULT_RENDER_OPTIONS: Partial<RenderOptions> = {
  scale: 2,
  format: 'png',
  backgroundColor: 'transparent',
  includeTitle: true,
};

// ============ 核心渲染管线 ============

/**
 * 将 Recharts 图表渲染为 SVG/PNG
 * @param chartElement Recharts 图表的 DOM 元素（或 ref）
 * @param options 渲染选项
 */
export async function renderChartToImage(
  chartElement: HTMLElement,
  options: Partial<RenderOptions> = {}
): Promise<RenderResult> {
  const opts: RenderOptions = {
    ...(DEFAULT_RENDER_OPTIONS as RenderOptions),
    ...options,
  };

  // 1. 提取 SVG
  const svgElement = chartElement.querySelector('svg.recharts-surface') as SVGElement | null;
  if (!svgElement) {
    throw new Error('No Recharts SVG surface found in element');
  }

  // 克隆 SVG 以避免污染原始元素
  const clonedSvg = svgElement.cloneNode(true) as SVGElement;

  // 2. 序列化 SVG 字符串
  const svgString = serializeSVG(clonedSvg, opts);

  // 3. 转为 PNG
  const pngDataUrl = await svgToDataUrl(svgString, opts);

  // 4. 创建 Blob
  const blob = await dataUrlToBlob(pngDataUrl);

  return {
    svgString,
    dataUrl: pngDataUrl,
    blob,
    width: opts.width * (opts.scale ?? 2),
    height: opts.height * (opts.scale ?? 2),
  };
}

/**
 * 序列化 SVG 元素为字符串，并注入 width/height/style
 */
function serializeSVG(svg: SVGElement, opts: RenderOptions): string {
  // 设置 SVG 尺寸
  svg.setAttribute('width', String(opts.width));
  svg.setAttribute('height', String(opts.height));
  svg.setAttribute('xmlns', 'http://www.w3.org/2000/svg');

  // 移除交互相关属性（点击、缩放等）
  svg.removeAttribute('style');

  // 确保背景色（如果指定）
  if (opts.backgroundColor && opts.backgroundColor !== 'transparent') {
    // 如果还没有 rect 背景，插入一个
    const existingBg = svg.querySelector('rect.recharts-cartesian-axis');
    if (!existingBg) {
      const bg = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
      bg.setAttribute('width', '100%');
      bg.setAttribute('height', '100%');
      bg.setAttribute('fill', opts.backgroundColor);
      svg.insertBefore(bg, svg.firstChild);
    }
  }

  // 序列化
  const serializer = new XMLSerializer();
  return serializer.serializeToString(svg);
}

/**
 * 将 SVG 字符串转换为 data URL
 */
async function svgToDataUrl(svgString: string, opts: RenderOptions): Promise<string> {
  return new Promise((resolve, reject) => {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      reject(new Error('Canvas 2D context not available'));
      return;
    }

    const scale = opts.scale ?? 2;
    canvas.width = opts.width * scale;
    canvas.height = opts.height * scale;

    // 填充背景
    if (opts.backgroundColor && opts.backgroundColor !== 'transparent') {
      ctx.fillStyle = opts.backgroundColor;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }

    const img = new Image();
    img.onload = () => {
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      resolve(canvas.toDataURL('image/png'));
    };
    img.onerror = () => {
      reject(new Error('Failed to load SVG as image'));
    };

    // 处理 SVG 中可能存在的外部资源（如图片、字体）
    // 使用 data URL 方式内联
    const base64Svg = btoa(unescape(encodeURIComponent(svgString)));
    img.src = `data:image/svg+xml;base64,${base64Svg}`;
  });
}

/**
 * 将 data URL 转换为 Blob
 */
async function dataUrlToBlob(dataUrl: string): Promise<Blob> {
  const response = await fetch(dataUrl);
  return response.blob();
}

// ============ 直接渲染（无需 DOM 元素）============

/**
 * 通过创建离屏 Recharts 渲染获取 PNG
 * 适用于 SSR 或无 DOM 场景（返回占位，实际在客户端使用）
 */
export function createOffscreenRenderer() {
  return {
    /**
     * 注册一个图表用于后续导出
     * 在 React 组件中使用 useEffect 调用
     */
    registerChart(
      id: string,
      element: HTMLElement,
      options: Partial<RenderOptions> = {}
    ): void {
      // 占位：实际渲染逻辑在客户端执行
      console.debug(`[ChartRenderer] Registered chart ${id}`, { options });
    },

    /**
     * 批量渲染所有已注册图表
     */
    async renderAll(
      options: Partial<RenderOptions> = {}
    ): Promise<Record<string, RenderResult>> {
      // 占位实现
      return {};
    },
  };
}

// ============ 工具函数 ============

/**
 * 下载 PNG/SVG 文件
 */
export function downloadChart(
  result: RenderResult,
  filename: string = 'chart',
  format: 'png' | 'svg' = 'png'
): void {
  const url = format === 'svg' ? `data:image/svg+xml;charset=utf-8,${encodeURIComponent(result.svgString)}` : result.dataUrl;
  const link = document.createElement('a');
  link.href = url;
  link.download = `${filename}.${format}`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

/**
 * 从 canvas 提取 PNG Blob（更高质量）
 */
export async function canvasToBlob(canvas: HTMLCanvasElement, quality: number = 1): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) resolve(blob);
        else reject(new Error('Failed to convert canvas to blob'));
      },
      'image/png',
      quality
    );
  });
}

/**
 * 验证 SVG 字符串是否有效
 */
export function validateSVG(svgString: string): boolean {
  return svgString.includes('<svg') && svgString.includes('</svg>');
}
