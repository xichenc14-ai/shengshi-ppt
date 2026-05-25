/**
 * graph-templates.ts
 * 预设模板 JSON 定义
 * 5流程 + 3结构 + 3时间 + 4分析框架
 */

import type { XyflowNode, XyflowEdge } from './mermaid-converter';

export interface GraphTemplate {
  id: string;
  name: string;
  category: 'process' | 'structure' | 'timeline' | 'analysis';
  description: string;
  nodes: XyflowNode[];
  edges: XyflowEdge[];
  direction?: 'TB' | 'BT' | 'LR' | 'RL';
}

// ============ 5 流程模板 ============

const FLOW_SEQUENCE_TEMPLATE: GraphTemplate = {
  id: 'flow-sequence',
  name: '线性流程',
  category: 'process',
  description: '从左到右的线性步骤流',
  direction: 'LR',
  nodes: [
    { id: 'n1', type: 'rect', position: { x: 0, y: 80 }, data: { label: '开始', color: '#6366f1' } },
    { id: 'n2', type: 'rect', position: { x: 200, y: 80 }, data: { label: '步骤一', color: '#6366f1' } },
    { id: 'n3', type: 'rect', position: { x: 400, y: 80 }, data: { label: '步骤二', color: '#6366f1' } },
    { id: 'n4', type: 'rect', position: { x: 600, y: 80 }, data: { label: '步骤三', color: '#6366f1' } },
    { id: 'n5', type: 'rect', position: { x: 800, y: 80 }, data: { label: '结束', color: '#6366f1' } },
  ],
  edges: [
    { id: 'e1', source: 'n1', target: 'n2' },
    { id: 'e2', source: 'n2', target: 'n3' },
    { id: 'e3', source: 'n3', target: 'n4' },
    { id: 'e4', source: 'n4', target: 'n5' },
  ],
};

const FLOW_PARALLEL_TEMPLATE: GraphTemplate = {
  id: 'flow-parallel',
  name: '并行分支',
  category: 'process',
  description: '一个节点分叉为多个并行任务',
  direction: 'LR',
  nodes: [
    { id: 'n1', type: 'rect', position: { x: 0, y: 80 }, data: { label: '需求分析', color: '#6366f1' } },
    { id: 'n2', type: 'diamond', position: { x: 220, y: 80 }, data: { label: '是否紧急？', color: '#f59e0b' } },
    { id: 'n3', type: 'rect', position: { x: 460, y: 0 }, data: { label: '快速通道', color: '#10b981' } },
    { id: 'n4', type: 'rect', position: { x: 460, y: 160 }, data: { label: '标准流程', color: '#6366f1' } },
    { id: 'n5', type: 'rect', position: { x: 700, y: 80 }, data: { label: '结果汇总', color: '#6366f1' } },
  ],
  edges: [
    { id: 'e1', source: 'n1', target: 'n2' },
    { id: 'e2', source: 'n2', target: 'n3', label: '是' },
    { id: 'e3', source: 'n2', target: 'n4', label: '否' },
    { id: 'e4', source: 'n3', target: 'n5' },
    { id: 'e5', source: 'n4', target: 'n5' },
  ],
};

const FLOW_CYCLE_TEMPLATE: GraphTemplate = {
  id: 'flow-cycle',
  name: '循环迭代',
  category: 'process',
  description: '循环迭代流程图',
  direction: 'TB',
  nodes: [
    { id: 'n1', type: 'rect', position: { x: 250, y: 0 }, data: { label: '初始化', color: '#6366f1' } },
    { id: 'n2', type: 'rect', position: { x: 250, y: 120 }, data: { label: '执行迭代', color: '#6366f1' } },
    { id: 'n3', type: 'diamond', position: { x: 250, y: 250 }, data: { label: '满足条件？', color: '#f59e0b' } },
    { id: 'n4', type: 'rect', position: { x: 0, y: 250 }, data: { label: '继续迭代', color: '#10b981' } },
    { id: 'n5', type: 'rect', position: { x: 250, y: 380 }, data: { label: '输出结果', color: '#6366f1' } },
  ],
  edges: [
    { id: 'e1', source: 'n1', target: 'n2' },
    { id: 'e2', source: 'n2', target: 'n3' },
    { id: 'e3', source: 'n3', target: 'n4', label: '否' },
    { id: 'e4', source: 'n3', target: 'n5', label: '是' },
    { id: 'e5', source: 'n4', target: 'n2' },
  ],
};

const FLOW_FUNNEL_TEMPLATE: GraphTemplate = {
  id: 'flow-funnel',
  name: '漏斗流程',
  category: 'process',
  description: '逐步筛选的漏斗流程',
  direction: 'TB',
  nodes: [
    { id: 'n1', type: 'rect', position: { x: 150, y: 0 }, data: { label: '1000 用户', color: '#6366f1' } },
    { id: 'n2', type: 'rect', position: { x: 150, y: 100 }, data: { label: '500 活跃用户', color: '#8b5cf6' } },
    { id: 'n3', type: 'rect', position: { x: 175, y: 200 }, data: { label: '200 付费用户', color: '#a78bfa' } },
    { id: 'n4', type: 'rect', position: { x: 200, y: 300 }, data: { label: '50 高价值用户', color: '#c4b5fd' } },
  ],
  edges: [
    { id: 'e1', source: 'n1', target: 'n2' },
    { id: 'e2', source: 'n2', target: 'n3' },
    { id: 'e3', source: 'n3', target: 'n4' },
  ],
};

const FLOW_FEEDBACK_TEMPLATE: GraphTemplate = {
  id: 'flow-feedback',
  name: '反馈循环',
  category: 'process',
  description: '带反馈的闭环流程',
  direction: 'LR',
  nodes: [
    { id: 'n1', type: 'rect', position: { x: 0, y: 80 }, data: { label: '产品发布', color: '#6366f1' } },
    { id: 'n2', type: 'rect', position: { x: 220, y: 80 }, data: { label: '用户反馈', color: '#6366f1' } },
    { id: 'n3', type: 'rect', position: { x: 440, y: 80 }, data: { label: '数据分析', color: '#6366f1' } },
    { id: 'n4', type: 'rect', position: { x: 660, y: 80 }, data: { label: '产品迭代', color: '#6366f1' } },
    { id: 'n5', type: 'diamond', position: { x: 880, y: 80 }, data: { label: '达到目标？', color: '#f59e0b' } },
    { id: 'n6', type: 'rect', position: { x: 1100, y: 80 }, data: { label: '结束', color: '#10b981' } },
  ],
  edges: [
    { id: 'e1', source: 'n1', target: 'n2' },
    { id: 'e2', source: 'n2', target: 'n3' },
    { id: 'e3', source: 'n3', target: 'n4' },
    { id: 'e4', source: 'n4', target: 'n5' },
    { id: 'e5', source: 'n5', target: 'n6', label: '是' },
    { id: 'e6', source: 'n5', target: 'n2', label: '否' },
  ],
};

// ============ 3 结构模板 ============

const STRUCT_ORG_TEMPLATE: GraphTemplate = {
  id: 'struct-org',
  name: '组织架构',
  category: 'structure',
  description: '层级组织结构图',
  direction: 'TB',
  nodes: [
    { id: 'ceo', type: 'rect', position: { x: 250, y: 0 }, data: { label: 'CEO', color: '#6366f1' } },
    { id: 'cto', type: 'rect', position: { x: 100, y: 120 }, data: { label: 'CTO', color: '#6366f1' } },
    { id: 'cfo', type: 'rect', position: { x: 400, y: 120 }, data: { label: 'CFO', color: '#6366f1' } },
    { id: 'dev', type: 'rect', position: { x: 0, y: 240 }, data: { label: '研发部', color: '#8b5cf6' } },
    { id: 'qa', type: 'rect', position: { x: 200, y: 240 }, data: { label: '质量部', color: '#8b5cf6' } },
    { id: 'fin', type: 'rect', position: { x: 400, y: 240 }, data: { label: '财务部', color: '#8b5cf6' } },
  ],
  edges: [
    { id: 'e1', source: 'ceo', target: 'cto' },
    { id: 'e2', source: 'ceo', target: 'cfo' },
    { id: 'e3', source: 'cto', target: 'dev' },
    { id: 'e4', source: 'cto', target: 'qa' },
    { id: 'e5', source: 'cfo', target: 'fin' },
  ],
};

const STRUCT_TREE_TEMPLATE: GraphTemplate = {
  id: 'struct-tree',
  name: '思维导图',
  category: 'structure',
  description: '中心发散的思维导图',
  direction: 'LR',
  nodes: [
    { id: 'root', type: 'circle', position: { x: 0, y: 100 }, data: { label: '核心主题', color: '#6366f1' } },
    { id: 'l1', type: 'rect', position: { x: 200, y: 0 }, data: { label: '分支一', color: '#8b5cf6' } },
    { id: 'l2', type: 'rect', position: { x: 200, y: 80 }, data: { label: '分支二', color: '#8b5cf6' } },
    { id: 'l3', type: 'rect', position: { x: 200, y: 160 }, data: { label: '分支三', color: '#8b5cf6' } },
    { id: 'l4', type: 'rect', position: { x: 400, y: 0 }, data: { label: '子主题1-1', color: '#a78bfa' } },
    { id: 'l5', type: 'rect', position: { x: 400, y: 40 }, data: { label: '子主题1-2', color: '#a78bfa' } },
    { id: 'l6', type: 'rect', position: { x: 400, y: 120 }, data: { label: '子主题2-1', color: '#a78bfa' } },
    { id: 'l7', type: 'rect', position: { x: 400, y: 160 }, data: { label: '子主题3-1', color: '#a78bfa' } },
  ],
  edges: [
    { id: 'e1', source: 'root', target: 'l1' },
    { id: 'e2', source: 'root', target: 'l2' },
    { id: 'e3', source: 'root', target: 'l3' },
    { id: 'e4', source: 'l1', target: 'l4' },
    { id: 'e5', source: 'l1', target: 'l5' },
    { id: 'e6', source: 'l2', target: 'l6' },
    { id: 'e7', source: 'l3', target: 'l7' },
  ],
};

const STRUCT_SWIMLANE_TEMPLATE: GraphTemplate = {
  id: 'struct-swimlane',
  name: '泳道图',
  category: 'structure',
  description: '跨部门泳道流程',
  direction: 'LR',
  nodes: [
    { id: 'mkt', type: 'subroutine', position: { x: 0, y: 0 }, data: { label: '市场部', color: '#6366f1' } },
    { id: 'dev', type: 'subroutine', position: { x: 0, y: 120 }, data: { label: '研发部', color: '#6366f1' } },
    { id: 'ops', type: 'subroutine', position: { x: 0, y: 240 }, data: { label: '运营部', color: '#6366f1' } },
    { id: 'n1', type: 'rect', position: { x: 250, y: 30 }, data: { label: '市场调研', color: '#8b5cf6' } },
    { id: 'n2', type: 'rect', position: { x: 500, y: 30 }, data: { label: '需求文档', color: '#8b5cf6' } },
    { id: 'n3', type: 'rect', position: { x: 250, y: 150 }, data: { label: '技术设计', color: '#10b981' } },
    { id: 'n4', type: 'rect', position: { x: 500, y: 150 }, data: { label: '开发迭代', color: '#10b981' } },
    { id: 'n5', type: 'rect', position: { x: 250, y: 270 }, data: { label: '运营推广', color: '#f59e0b' } },
    { id: 'n6', type: 'rect', position: { x: 500, y: 270 }, data: { label: '数据分析', color: '#f59e0b' } },
  ],
  edges: [
    { id: 'e1', source: 'n1', target: 'n2' },
    { id: 'e2', source: 'n2', target: 'n3' },
    { id: 'e3', source: 'n3', target: 'n4' },
    { id: 'e4', source: 'n4', target: 'n6' },
    { id: 'e5', source: 'n4', target: 'n5' },
  ],
};

// ============ 3 时间模板 ============

const TIME_LINEAR_TEMPLATE: GraphTemplate = {
  id: 'time-linear',
  name: '线性时间轴',
  category: 'timeline',
  description: '从左到右的时间里程碑',
  direction: 'LR',
  nodes: [
    { id: 'm1', type: 'circle', position: { x: 0, y: 60 }, data: { label: 'Q1\n启动', color: '#6366f1' } },
    { id: 'm2', type: 'circle', position: { x: 200, y: 60 }, data: { label: 'Q2\n推进', color: '#8b5cf6' } },
    { id: 'm3', type: 'circle', position: { x: 400, y: 60 }, data: { label: 'Q3\n攻坚', color: '#a78bfa' } },
    { id: 'm4', type: 'circle', position: { x: 600, y: 60 }, data: { label: 'Q4\n收尾', color: '#10b981' } },
  ],
  edges: [
    { id: 'e1', source: 'm1', target: 'm2' },
    { id: 'e2', source: 'm2', target: 'm3' },
    { id: 'e3', source: 'm3', target: 'm4' },
  ],
};

const TIME_GANTT_TEMPLATE: GraphTemplate = {
  id: 'time-gantt',
  name: '甘特图',
  category: 'timeline',
  description: '项目甘特图时间规划',
  direction: 'TB',
  nodes: [
    { id: 't1', type: 'rect', position: { x: 100, y: 0 }, data: { label: '需求阶段\n1-2周', color: '#6366f1' } },
    { id: 't2', type: 'rect', position: { x: 100, y: 100 }, data: { label: '设计阶段\n2-3周', color: '#8b5cf6' } },
    { id: 't3', type: 'rect', position: { x: 100, y: 200 }, data: { label: '开发阶段\n4-8周', color: '#a78bfa' } },
    { id: 't4', type: 'rect', position: { x: 100, y: 300 }, data: { label: '测试阶段\n2-3周', color: '#10b981' } },
    { id: 't5', type: 'rect', position: { x: 100, y: 400 }, data: { label: '上线部署\n1周', color: '#f59e0b' } },
  ],
  edges: [
    { id: 'e1', source: 't1', target: 't2' },
    { id: 'e2', source: 't2', target: 't3' },
    { id: 'e3', source: 't3', target: 't4' },
    { id: 'e4', source: 't4', target: 't5' },
  ],
};

const TIME_BRANCH_TEMPLATE: GraphTemplate = {
  id: 'time-branch',
  name: '分支时间线',
  category: 'timeline',
  description: '多条并行的时间线分支',
  direction: 'TB',
  nodes: [
    { id: 'start', type: 'circle', position: { x: 250, y: 0 }, data: { label: '项目启动', color: '#6366f1' } },
    { id: 'pa', type: 'circle', position: { x: 0, y: 120 }, data: { label: '路径A', color: '#10b981' } },
    { id: 'pb', type: 'circle', position: { x: 250, y: 120 }, data: { label: '路径B', color: '#8b5cf6' } },
    { id: 'pc', type: 'circle', position: { x: 500, y: 120 }, data: { label: '路径C', color: '#f59e0b' } },
    { id: 'merge', type: 'diamond', position: { x: 250, y: 260 }, data: { label: '汇合', color: '#6366f1' } },
    { id: 'end', type: 'rect', position: { x: 250, y: 380 }, data: { label: '项目完成', color: '#6366f1' } },
  ],
  edges: [
    { id: 'e1', source: 'start', target: 'pa' },
    { id: 'e2', source: 'start', target: 'pb' },
    { id: 'e3', source: 'start', target: 'pc' },
    { id: 'e4', source: 'pa', target: 'merge' },
    { id: 'e5', source: 'pb', target: 'merge' },
    { id: 'e6', source: 'pc', target: 'merge' },
    { id: 'e7', source: 'merge', target: 'end' },
  ],
};

// ============ 4 分析框架模板 ============

const ANALYSIS_SWOT_TEMPLATE: GraphTemplate = {
  id: 'analysis-swot',
  name: 'SWOT分析',
  category: 'analysis',
  description: 'SWOT战略分析矩阵',
  direction: 'TB',
  nodes: [
    { id: 'title', type: 'text', position: { x: 250, y: 0 }, data: { label: 'SWOT 分析', color: '#6366f1' } },
    { id: 's', type: 'rect', position: { x: 0, y: 100 }, data: { label: '优势 S\nStrengths', color: '#10b981' } },
    { id: 'w', type: 'rect', position: { x: 300, y: 100 }, data: { label: '劣势 W\nWeaknesses', color: '#ef4444' } },
    { id: 'o', type: 'rect', position: { x: 0, y: 260 }, data: { label: '机会 O\nOpportunities', color: '#3b82f6' } },
    { id: 't', type: 'rect', position: { x: 300, y: 260 }, data: { label: '威胁 T\nThreats', color: '#f59e0b' } },
  ],
  edges: [],
};

const ANALYSIS_PESTEL_TEMPLATE: GraphTemplate = {
  id: 'analysis-pestel',
  name: 'PESTEL分析',
  category: 'analysis',
  description: '宏观环境PESTEL分析框架',
  direction: 'LR',
  nodes: [
    { id: 'center', type: 'hexagon', position: { x: 300, y: 100 }, data: { label: 'PESTEL\n分析', color: '#6366f1' } },
    { id: 'p', type: 'rect', position: { x: 0, y: 0 }, data: { label: '政治\nPolitical', color: '#8b5cf6' } },
    { id: 'e', type: 'rect', position: { x: 0, y: 100 }, data: { label: '经济\nEconomic', color: '#8b5cf6' } },
    { id: 's', type: 'rect', position: { x: 0, y: 200 }, data: { label: '社会\nSocial', color: '#8b5cf6' } },
    { id: 't', type: 'rect', position: { x: 600, y: 0 }, data: { label: '技术\nTechnological', color: '#8b5cf6' } },
    { id: 'el', type: 'rect', position: { x: 600, y: 100 }, data: { label: '环境\nEnvironmental', color: '#8b5cf6' } },
    { id: 'l', type: 'rect', position: { x: 600, y: 200 }, data: { label: '法律\nLegal', color: '#8b5cf6' } },
  ],
  edges: [
    { id: 'e1', source: 'p', target: 'center' },
    { id: 'e2', source: 'e', target: 'center' },
    { id: 'e3', source: 's', target: 'center' },
    { id: 'e4', source: 'center', target: 't' },
    { id: 'e5', source: 'center', target: 'el' },
    { id: 'e6', source: 'center', target: 'l' },
  ],
};

const ANALYSIS_PORTER_TEMPLATE: GraphTemplate = {
  id: 'analysis-porter',
  name: '波特五力',
  category: 'analysis',
  description: '波特五力竞争分析模型',
  direction: 'TB',
  nodes: [
    { id: 'center', type: 'circle', position: { x: 250, y: 130 }, data: { label: '竞争\n对手', color: '#6366f1' } },
    { id: 'n1', type: 'diamond', position: { x: 250, y: 0 }, data: { label: '新进入者', color: '#8b5cf6' } },
    { id: 'n2', type: 'diamond', position: { x: 0, y: 130 }, data: { label: '供应商\n议价能力', color: '#8b5cf6' } },
    { id: 'n3', type: 'diamond', position: { x: 500, y: 130 }, data: { label: '买家\n议价能力', color: '#8b5cf6' } },
    { id: 'n4', type: 'diamond', position: { x: 250, y: 260 }, data: { label: '替代品', color: '#8b5cf6' } },
  ],
  edges: [
    { id: 'e1', source: 'n1', target: 'center' },
    { id: 'e2', source: 'n2', target: 'center' },
    { id: 'e3', source: 'n3', target: 'center' },
    { id: 'e4', source: 'n4', target: 'center' },
  ],
};

const ANALYSIS_5W1H_TEMPLATE: GraphTemplate = {
  id: 'analysis-5w1h',
  name: '5W1H分析',
  category: 'analysis',
  description: '5W1H问题分析框架',
  direction: 'TB',
  nodes: [
    { id: 'w1', type: 'rect', position: { x: 0, y: 0 }, data: { label: 'What\n做什么', color: '#6366f1' } },
    { id: 'w2', type: 'rect', position: { x: 200, y: 0 }, data: { label: 'Why\n为什么', color: '#8b5cf6' } },
    { id: 'w3', type: 'rect', position: { x: 400, y: 0 }, data: { label: 'Who\n谁来做', color: '#a78bfa' } },
    { id: 'w4', type: 'rect', position: { x: 0, y: 120 }, data: { label: 'When\n何时做', color: '#10b981' } },
    { id: 'w5', type: 'rect', position: { x: 200, y: 120 }, data: { label: 'Where\n在哪里', color: '#10b981' } },
    { id: 'w6', type: 'rect', position: { x: 400, y: 120 }, data: { label: 'How\n怎么做', color: '#10b981' } },
  ],
  edges: [],
};

export const ALL_TEMPLATES: GraphTemplate[] = [
  // 5 流程
  FLOW_SEQUENCE_TEMPLATE,
  FLOW_PARALLEL_TEMPLATE,
  FLOW_CYCLE_TEMPLATE,
  FLOW_FUNNEL_TEMPLATE,
  FLOW_FEEDBACK_TEMPLATE,
  // 3 结构
  STRUCT_ORG_TEMPLATE,
  STRUCT_TREE_TEMPLATE,
  STRUCT_SWIMLANE_TEMPLATE,
  // 3 时间
  TIME_LINEAR_TEMPLATE,
  TIME_GANTT_TEMPLATE,
  TIME_BRANCH_TEMPLATE,
  // 4 分析框架
  ANALYSIS_SWOT_TEMPLATE,
  ANALYSIS_PESTEL_TEMPLATE,
  ANALYSIS_PORTER_TEMPLATE,
  ANALYSIS_5W1H_TEMPLATE,
];

export const TEMPLATES_BY_CATEGORY = ALL_TEMPLATES.reduce(
  (acc, t) => {
    if (!acc[t.category]) acc[t.category] = [];
    acc[t.category].push(t);
    return acc;
  },
  {} as Record<string, GraphTemplate[]>
);
