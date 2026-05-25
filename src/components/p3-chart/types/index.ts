// P3 Chart/Graph/Diagram Module Type Definitions

// ============ Chart Types (recharts) ============

export type ChartType = 'bar' | 'line' | 'pie' | 'area' | 'scatter' | 'radar' | 'funnel';

export interface ChartDataPoint {
  name: string;
  value: number;
  [key: string]: string | number;
}

export interface ChartConfig {
  id: string;
  type: ChartType;
  title: string;
  data: ChartDataPoint[];
  width?: number;
  height?: number;
  colors?: string[];
  showLegend?: boolean;
  showGrid?: boolean;
  showTooltip?: boolean;
  animationDuration?: number;
}

export interface ChartEditorState {
  selectedType: ChartType;
  title: string;
  data: ChartDataPoint[];
  colors: string[];
  options: {
    showLegend: boolean;
    showGrid: boolean;
    showTooltip: boolean;
    animationEnabled: boolean;
  };
}

// ============ Graph Types (@xyflow/react) ============

export type GraphNodeType = 'input' | 'default' | 'output' | 'ai' | 'data' | 'process';
export type GraphEdgeType = 'default' | 'step' | 'smooth' | 'straight';

export interface GraphNode {
  id: string;
  type: GraphNodeType;
  position: { x: number; y: number };
  data: {
    label: string;
    description?: string;
    icon?: string;
  };
  style?: Record<string, string | number>;
}

export interface GraphEdge {
  id: string;
  source: string;
  target: string;
  type?: GraphEdgeType;
  label?: string;
  animated?: boolean;
  style?: Record<string, string | number>;
}

export interface GraphConfig {
  id: string;
  title: string;
  nodes: GraphNode[];
  edges: GraphEdge[];
  nodeColors?: Record<GraphNodeType, string>;
  direction?: 'LR' | 'TB' | 'RL' | 'BT';
}

export interface GraphEditorState {
  nodes: GraphNode[];
  edges: GraphEdge[];
  selectedNodeId: string | null;
  selectedEdgeId: string | null;
  direction: 'LR' | 'TB' | 'RL' | 'BT';
}

// ============ Diagram Types (mermaid) ============

export type DiagramType =
  | 'flowchart'
  | 'sequence'
  | 'class'
  | 'state'
  | 'er'
  | 'gantt'
  | 'pie'
  | 'mindmap'
  | 'timeline';

export type DiagramTheme = 'default' | 'neutral' | 'dark' | 'base';

export interface DiagramConfig {
  id: string;
  type: DiagramType;
  title: string;
  definition: string; // Mermaid diagram definition string
  theme?: DiagramTheme;
  scale?: number;
}

export interface DiagramEditorState {
  selectedType: DiagramType;
  definition: string;
  theme: DiagramTheme;
  scale: number;
}

// ============ Export Types ============

export type ExportFormat = 'png' | 'jpg' | 'svg' | 'pdf' | 'pptx';

export interface ExportConfig {
  format: ExportFormat;
  quality?: number; // 0-100 for jpg/png
  scale?: number;
  backgroundColor?: string;
  includeTitle?: boolean;
}

// ============ Unified P3 Component Props ============

export type P3ComponentType = 'chart' | 'graph' | 'diagram';

export interface P3BaseProps {
  className?: string;
  editable?: boolean;
  onChange?: (config: ChartConfig | GraphConfig | DiagramConfig) => void;
}

export interface P3ChartProps extends P3BaseProps {
  type: 'chart';
  config: ChartConfig;
}

export interface P3GraphProps extends P3BaseProps {
  type: 'graph';
  config: GraphConfig;
}

export interface P3DiagramProps extends P3BaseProps {
  type: 'diagram';
  config: DiagramConfig;
}

export type P3ComponentProps = P3ChartProps | P3GraphProps | P3DiagramProps;

// ============ Editor Panel Props ============

export interface EditorPanelProps {
  type: P3ComponentType;
  config: ChartConfig | GraphConfig | DiagramConfig;
  onSave: (config: ChartConfig | GraphConfig | DiagramConfig) => void;
  onCancel: () => void;
}
