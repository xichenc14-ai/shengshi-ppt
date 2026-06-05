// PDF Export utility using @react-pdf/renderer
import { pdf, Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';
import type { ChartConfig, GraphConfig, DiagramConfig, ExportConfig } from '../types';

const styles = StyleSheet.create({
  page: { padding: 40, fontFamily: 'Helvetica' },
  title: { fontSize: 24, marginBottom: 20, textAlign: 'center', fontFamily: 'Helvetica-Bold' },
  subtitle: { fontSize: 14, marginBottom: 12, color: '#666' },
  section: { marginBottom: 16 },
  tableHeader: { flexDirection: 'row', backgroundColor: '#EEF2FF', padding: 6 },
  tableRow: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: '#E5E7EB', padding: 6 },
  cell: { flex: 1, fontSize: 11 },
  cellBold: { flex: 1, fontSize: 11, fontFamily: 'Helvetica-Bold' },
  footer: { position: 'absolute', bottom: 30, left: 40, right: 40, textAlign: 'center', fontSize: 10, color: '#999' },
});

// Chart → PDF Document
function ChartToPDF({ config }: { config: ChartConfig }) {
  const chartTypeLabels: Record<string, string> = {
    bar: '柱状图', line: '折线图', area: '面积图', pie: '饼图',
    scatter: '散点图', radar: '雷达图', funnel: '漏斗图',
  };

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <Text style={styles.title}>{config.title || '图表'}</Text>
        <Text style={styles.subtitle}>类型: {chartTypeLabels[config.type] || config.type}</Text>

        <View style={styles.section}>
          <Text style={{ fontSize: 14, fontFamily: 'Helvetica-Bold', marginBottom: 8 }}>数据明细</Text>
          <View style={styles.tableHeader}>
            <Text style={styles.cellBold}>名称</Text>
            <Text style={styles.cellBold}>数值</Text>
          </View>
          {config.data.map((point, i) => (
            <View key={i} style={styles.tableRow}>
              <Text style={styles.cell}>{point.name}</Text>
              <Text style={styles.cell}>{point.value}</Text>
            </View>
          ))}
        </View>

        {config.showLegend && (
          <View style={styles.section}>
            <Text style={{ fontSize: 12, marginBottom: 4 }}>配色: {(config.colors || []).join(', ')}</Text>
          </View>
        )}

        <Text style={styles.footer}>由 省心PPT 图表模块生成 | {new Date().toLocaleDateString('zh-CN')}</Text>
      </Page>
    </Document>
  );
}

// Graph → PDF Document
function GraphToPDF({ config }: { config: GraphConfig }) {
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <Text style={styles.title}>{config.title || '流程图'}</Text>
        <Text style={styles.subtitle}>布局方向: {config.direction || 'LR'}</Text>

        <View style={styles.section}>
          <Text style={{ fontSize: 14, fontFamily: 'Helvetica-Bold', marginBottom: 8 }}>节点列表</Text>
          {config.nodes.map((node, i) => (
            <View key={i} style={styles.tableRow}>
              <Text style={styles.cellBold}>{node.data.label}</Text>
              <Text style={styles.cell}>{node.type}</Text>
              <Text style={styles.cell}>x: {Math.round(node.position.x)}, y: {Math.round(node.position.y)}</Text>
            </View>
          ))}
        </View>

        <View style={styles.section}>
          <Text style={{ fontSize: 14, fontFamily: 'Helvetica-Bold', marginBottom: 8 }}>连线列表</Text>
          {config.edges.map((edge, i) => (
            <View key={i} style={styles.tableRow}>
              <Text style={styles.cell}>{edge.source}</Text>
              <Text style={styles.cell}>→</Text>
              <Text style={styles.cell}>{edge.target}</Text>
            </View>
          ))}
        </View>

        <Text style={styles.footer}>由 省心PPT 图表模块生成 | {new Date().toLocaleDateString('zh-CN')}</Text>
      </Page>
    </Document>
  );
}

// Diagram → PDF Document
function DiagramToPDF({ config }: { config: DiagramConfig }) {
  const diagramTypeLabels: Record<string, string> = {
    flowchart: '流程图', sequence: '时序图', class: '类图', state: '状态图',
    er: 'ER图', gantt: '甘特图', pie: '饼图', mindmap: '思维导图', timeline: '时间线',
  };

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <Text style={styles.title}>{config.title || '图表'}</Text>
        <Text style={styles.subtitle}>类型: {diagramTypeLabels[config.type] || config.type}</Text>
        <Text style={styles.subtitle}>主题: {config.theme || 'default'}</Text>

        <View style={styles.section}>
          <Text style={{ fontSize: 14, fontFamily: 'Helvetica-Bold', marginBottom: 8 }}>Mermaid 定义</Text>
          <View style={{ backgroundColor: '#F3F4F6', padding: 12, borderRadius: 4 }}>
            <Text style={{ fontFamily: 'Courier', fontSize: 9, color: '#374151', lineHeight: 1.6 }}>
              {config.definition}
            </Text>
          </View>
        </View>

        <Text style={styles.footer}>由 省心PPT 图表模块生成 | {new Date().toLocaleDateString('zh-CN')}</Text>
      </Page>
    </Document>
  );
}

// ============ Main Export Functions ============

export async function exportChartToPDF(config: ChartConfig, _exportConfig: ExportConfig): Promise<Blob> {
  const doc = <ChartToPDF config={config} />;
  return pdf(doc).toBlob();
}

export async function exportGraphToPDF(config: GraphConfig, _exportConfig: ExportConfig): Promise<Blob> {
  const doc = <GraphToPDF config={config} />;
  return pdf(doc).toBlob();
}

export async function exportDiagramToPDF(config: DiagramConfig, _exportConfig: ExportConfig): Promise<Blob> {
  const doc = <DiagramToPDF config={config} />;
  return pdf(doc).toBlob();
}

// Generic PDF export dispatcher
export async function exportToPDF(
  config: ChartConfig | GraphConfig | DiagramConfig,
  _exportConfig: ExportConfig
): Promise<Blob> {
  if ('type' in config && 'data' in config) {
    return exportChartToPDF(config as ChartConfig, _exportConfig);
  }
  if ('nodes' in config) {
    return exportGraphToPDF(config as GraphConfig, _exportConfig);
  }
  return exportDiagramToPDF(config as DiagramConfig, _exportConfig);
}

// SVG export: serialize SVG element to string
export async function exportToSVG(element: HTMLElement): Promise<string> {
  const svgElement = element.querySelector('svg');
  if (!svgElement) throw new Error('No SVG found in element');
  return new XMLSerializer().serializeToString(svgElement);
}

// Download helper
export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
