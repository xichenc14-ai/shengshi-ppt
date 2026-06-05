// P3 Chart / Graph / Diagram Module
// =====================================
// React component library for creating charts, flowcharts, and Mermaid diagrams
// in the 省心PPT (ShengxinPPT) application.
//
// Dependencies: recharts, @xyflow/react, mermaid, @react-pdf/renderer
//
// Usage:
//   import P3ChartApp from '@/components/p3-chart/P3ChartApp';
//   // or individual components:
//   import { ChartRenderer } from '@/components/p3-chart/renderers';
//   import { ChartEditor } from '@/components/p3-chart/editors';

export { default as P3ChartApp } from './P3ChartApp';
export { ChartRenderer } from './renderers/ChartRenderer';
export { GraphRenderer } from './renderers/GraphRenderer';
export { DiagramRenderer } from './renderers/DiagramRenderer';
export { ChartEditor } from './editors/ChartEditor';
export { GraphEditor } from './editors/GraphEditor';
export { DiagramEditor } from './editors/DiagramEditor';
export { ExportPanel } from './export/ExportPanel';
export * from './types';
