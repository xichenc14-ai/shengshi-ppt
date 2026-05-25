/**
 * mermaid-converter.ts
 * XYFlow Node/Edge JSON → Mermaid 语法转换器
 */

export type NodeShape = 'rect' | 'diamond' | 'circle' | 'cylinder' | 'parallelogram' | 'hexagon' | 'subroutine' | 'text';

export interface XyflowNode {
  id: string;
  type: NodeShape;
  data: {
    label: string;
    description?: string;
    color?: string;
    fill?: string;
    stroke?: string;
    textColor?: string;
  };
  position: { x: number; y: number };
  width?: number;
  height?: number;
  style?: Record<string, string>;
}

export interface XyflowEdge {
  id: string;
  source: string;
  target: string;
  label?: string;
  type?: string;
  animated?: boolean;
  style?: Record<string, string>;
}

// Mermaid shape keywords per node type
const SHAPE_MAP: Record<NodeShape, string> = {
  rect: 'rounded',
  diamond: 'diamond',
  circle: 'circle',
  cylinder: 'cylinder',
  parallelogram: 'parallelogram',
  hexagon: 'hexagon',
  subroutine: 'subroutine',
  text: 'text',
};

function nodeId(id: string): string {
  // Mermaid node IDs must be alphanumeric + hyphen/underscore, no special chars
  return id.replace(/[^a-zA-Z0-9_-]/g, '_');
}

function nodeLabel(label: string): string {
  // Escape pipe and quotes in Mermaid labels
  return label.replace(/\|/g, '\\|').replace(/"/g, "'");
}

function applyNodeStyle(node: XyflowNode): string {
  const { color, fill, stroke, textColor } = node.data;
  const styles: string[] = [];
  if (fill) styles.push(`fill:${fill}`);
  if (stroke) styles.push(`stroke:${stroke}`);
  if (color) styles.push(`color:${color}`);
  if (textColor) styles.push(`text:${textColor}`);
  if (node.style) {
    Object.entries(node.style).forEach(([k, v]) => styles.push(`${k}:${v}`));
  }
  return styles.length > 0 ? `%%{style:${node.id}{${styles.join(';')}}%%}` : '';
}

/**
 * Convert XYFlow nodes+edges to Mermaid flowchart syntax
 */
export function xyflowToMermaid(
  nodes: XyflowNode[],
  edges: XyflowEdge[],
  direction: 'TB' | 'BT' | 'LR' | 'RL' = 'LR'
): string {
  const lines: string[] = [];

  lines.push(`flowchart ${direction}`);

  // Style declarations
  const styleLines: string[] = [];
  nodes.forEach((node) => {
    const style = applyNodeStyle(node);
    if (style) styleLines.push(style);
  });
  lines.push(...styleLines);

  // Node declarations
  nodes.forEach((node) => {
    const shape = SHAPE_MAP[node.type] ?? 'rect';
    const label = nodeLabel(node.data.label);
    lines.push(`    ${nodeId(node.id)}["${label}"]`);
  });

  // Edge declarations
  edges.forEach((edge) => {
    const sourceId = nodeId(edge.source);
    const targetId = nodeId(edge.target);
    let edgeStr = `    ${sourceId} --> ${targetId}`;
    if (edge.label) {
      edgeStr = `    ${sourceId} -->|${nodeLabel(edge.label)}| ${targetId}`;
    }
    if (edge.animated) {
      edgeStr += '\n    style ' + edgeStr.trim() + ' stroke:#6366f1,stroke-width:2px,marker-end:url(#arrowhead)';
    }
    lines.push(edgeStr);
  });

  return lines.join('\n');
}

/**
 * Get Mermaid theme config for a given color palette
 */
export function getMermaidTheme(themeColor: string): string {
  return `%%{init:{
  "theme":"base",
  "themeVariables":{
    "primaryColor":"${themeColor}",
    "primaryTextColor":"#fff",
    "primaryBorderColor":"${themeColor}",
    "lineColor":"#94a3b8",
    "secondaryColor":"#f1f5f9",
    "tertiaryColor":"#f8fafc"
  }
}}%%`;
}
