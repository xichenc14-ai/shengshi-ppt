/**
 * renderers/index.ts — 渲染层统一出口
 */

export {
  renderChartToImage,
  downloadChart,
  createOffscreenRenderer,
  validateSVG,
  canvasToBlob,
  type RenderOptions,
  type RenderResult,
  type ChartType,
} from './svgRenderer';
