// build-md-v2.ts — Gamma PPT Markdown 排版引擎 V5
// 核心规范来源：gamma-ppt-database.md（技术部完整培训资料）
// 
// 设计原则（来自 gamma-ppt-database.md）：
// 1. 信息密度：50-80字/页，严禁大段文本
// 2. 大文本强制：### 触发大文本短句（非普通小字）
// 3. 卡片触发：3-4个并列要点触发三列/四宫格卡片
// 4. 时间轴触发：有序列表 1. 2. 3. 触发流程布局
// 5. 对比布局：### 优势 / ### 劣势 触发左右对照
// 6. 演讲者备注：> 引用块分离详细内容
// 7. 配图克制：封面/过渡/结尾三处使用

export type SlideItem = {
  id: string;
  title: string;
  content?: string[];
  notes?: string;
  data?: Record<string, string>[];
};

type PageType = 'cover' | 'toc' | 'content' | 'comparison' | 'process' | 'data' | 'quote' | 'ending';

// ========== V5 内容增强库（短要点智能展开） ==========
// 来自 gamma-ppt-database.md：短标题必须扩展为有意义的短句
const ENHANCEMENT_MAP: Record<string, { desc: string; details: string[] }> = {
  '创新': { desc: '持续创新突破', details: ['技术突破', '模式创新', '体验升级'] },
  '高效': { desc: '效率全面提升', details: ['流程优化', '时间节省', '成本降低'] },
  '专业': { desc: '专业能力领先', details: ['行业经验', '专业资质', '成功案例'] },
  '安全': { desc: '安全可靠有保障', details: ['数据加密', '隐私保护', '合规认证'] },
  '用户第一': { desc: '以用户为中心', details: ['需求洞察', '体验优化', '服务升级'] },
  '降本增效': { desc: '降本增效成果显著', details: ['成本优化', '效率提升', '资源整合'] },
  '增长': { desc: '驱动业务快速增长', details: ['用户增长', '收入增长', '市场份额'] },
  '智能化': { desc: '智能化全面升级', details: ['AI赋能', '自动化流程', '数据驱动'] },
  '全球化': { desc: '全球化布局加速', details: ['海外市场', '本土化运营', '品牌国际化'] },
  '赋能': { desc: '全方位赋能', details: ['技术赋能', '资源支持', '能力输出'] },
  '协同': { desc: '协同效率倍增', details: ['跨部门协作', '资源共享', '信息互通'] },
  '敏捷': { desc: '敏捷响应市场', details: ['快速迭代', '灵活调整', '高效执行'] },
  '品质': { desc: '品质卓越可靠', details: ['质量把控', '标准认证', '用户口碑'] },
  '服务': { desc: '服务体验升级', details: ['响应及时', '专业耐心', '持续跟进'] },
  '品质保障': { desc: '品质有保障', details: ['精选材质', '严格质检', '售后无忧'] },
  '交期快': { desc: '交付快速准时', details: ['快速响应', '准时交付', '物流跟踪'] },
  '定制': { desc: '灵活定制方案', details: ['需求沟通', '方案设计', '个性化服务'] },
  '环保': { desc: '绿色环保可持续', details: ['环保材料', '节能减排', '绿色生产'] },
  '性价比': { desc: '高性价比之选', details: ['价格合理', '品质优异', '服务完善'] },
  '口碑': { desc: '用户口碑认可', details: ['好评如潮', '推荐率高', '复购率高'] },
  '突破': { desc: '关键突破', details: ['技术壁垒', '市场领先', '差异化优势'] },
  '稳健': { desc: '稳健发展', details: ['风险控制', '持续盈利', '长期主义'] },
  '领先': { desc: '行业领先', details: ['技术领先', '市场份额', '品牌影响力'] },
  '整合': { desc: '资源整合', details: ['渠道整合', '业务协同', '价值链优化'] },
};

function enhanceBullet(text: string, allowEnhancement: boolean = false): { main: string; expanded: string[] } {
  const trimmed = text.trim();

  // 🚨 V6修复：preserve模式默认不扩写！ENHANCEMENT_MAP只对generate模式开放
  // 原因：preserve模式要求忠实呈现用户原文，AI擅自扩写会扭曲用户原意
  if (!allowEnhancement) {
    return { main: trimmed, expanded: [] };
  }

  // 以下扩写逻辑仅在 allowEnhancement=true 时生效（generate模式可开启）
  if (trimmed.length > 35) {
    return { main: trimmed, expanded: [] };
  }

  // 精确匹配
  if (ENHANCEMENT_MAP[trimmed]) {
    const entry = ENHANCEMENT_MAP[trimmed];
    return { main: entry.desc, expanded: entry.details };
  }

  // 部分匹配
  for (const [key, val] of Object.entries(ENHANCEMENT_MAP)) {
    if (trimmed.includes(key) && key.length >= 2) {
      return { main: val.desc, expanded: val.details };
    }
  }

  return { main: trimmed, expanded: [] };
}

// ========== V5 智能页面类型检测 ==========
function detectPageType(index: number, total: number, title: string, content?: string[]): PageType {
  const t = title.toLowerCase();
  
  if (index === 0) return 'cover';
  if (/目录|概览|index|agenda|内容大纲|contents/.test(t)) return 'toc';
  if (/感谢|谢谢|thank|end|结语|联系/.test(t) && (index === total - 1 || index >= total - 2)) return 'ending';
  if (/对比|比较|versus|vs|优劣|差异/.test(t)) return 'comparison';
  if (/流程|步骤|process|路线|路径|阶段|时间轴/.test(t)) return 'process';
  if (content && content.some(c => /数据|图表|增长|下降|比例|占比|%|率|\d{2,}%/.test(c))) return 'data';
  if (/引言|前言|背景|使命|愿景|价值观|理念|关于/.test(t) && (!content || content.length <= 2)) return 'quote';
  return 'content';
}

// ========== V5 内容密度判断 ==========
// 来自 gamma-ppt-database.md：单页50-80字，严禁大段文本
function estimatePageContentLength(title: string, content: string[]): number {
  const titleLen = title.length * 2; // 标题权重更高
  const contentLen = content.reduce((sum, c) => sum + c.trim().length, 0);
  return titleLen + contentLen;
}

function needsSplit(title: string, content: string[]): boolean {
  return estimatePageContentLength(title, content) > 80;
}

// P0修复：硬截断函数 — 在句子边界截断，避免断章取义
function truncateToWordCount(text: string, maxChars: number): string {
  if (text.length <= maxChars) return text;
  const truncated = text.slice(0, maxChars);
  const lastPeriod = Math.max(
    truncated.lastIndexOf('。'),
    truncated.lastIndexOf('，'),
    truncated.lastIndexOf('.'),
    truncated.lastIndexOf('；')
  );
  return lastPeriod > maxChars * 0.5 ? truncated.slice(0, lastPeriod + 1) : truncated;
}

// P0修复：强制执行单页字数限制（标题+正文 ≤ 80字）
function enforcePageCharLimit(title: string, content: string[]): string[] {
  const MAX_CHARS = 80;
  const titleChars = title.length;
  let remaining = MAX_CHARS - titleChars;
  if (remaining <= 0) return content.slice(0, 1).map(c => truncateToWordCount(c.trim(), 10));
  const perItem = Math.floor(remaining / Math.max(content.length, 1));
  return content
    .map(c => truncateToWordCount(c.trim(), Math.max(perItem, 10)))
    .filter(c => c.length > 0);
}

// ========== P0修复：智能图表类型分配 ==========
// 来自兮晨框架：数据可视化 — 分配图表类型，强制显示数据标签
function assignChartType(content: string[]): { chartType: string; emoji: string } | null {
  const text = content.join(' ');
  const hasPercent = /%|\d+%|比例|占比|份额/.test(text);
  const hasTrend = /增长|下降|趋势|同比|环比|增速|增幅|跌幅/.test(text);
  const hasRanking = /排名|第[一二三四五六七八九十百千]|前三|Top|top|首位/.test(text);
  const hasComparison = /对比|比较|vs|VS|优劣|差异/.test(text);
  const hasAmount = /营收|收入|利润|销售额|GMV|规模|用户量|下载量/.test(text) && /\d/.test(text);

  if (hasTrend && hasAmount) return { chartType: '折线图', emoji: '📈' };
  if (hasTrend) return { chartType: '折线图', emoji: '📈' };
  if (hasPercent) return { chartType: '饼图', emoji: '🥧' };
  if (hasRanking || hasComparison) return { chartType: '柱状图', emoji: '📊' };
  if (hasAmount) return { chartType: '柱状图', emoji: '📊' };
  return null;
}

// ========== P0修复：视觉隐喻关键词库 ==========
const VISUAL_METAPHOR_MAP: Record<string, string[]> = {
  '突破': ['破晓', '冲刺', '山峰', '攀登'],
  '成长': ['树苗', '发芽', '上升', '光合作用'],
  '创新': ['闪电', '火花', '化学反应', '重组'],
  '稳定': ['根基', '磐石', '锚点', '平衡'],
  '连接': ['桥梁', '网络', '握手', '交叉'],
  '转型': ['变形', '蜕变', '蝴蝶', '升级'],
  '增长': ['上升', '加速', '阶梯', '火箭'],
  '智能': ['芯片', '光路', '数据流', '神经网络'],
  '安全': ['盾牌', '锁', '城墙', '堡垒'],
  '协同': ['齿轮', '链条', '团队', '同心圆'],
  '品质': ['钻石', '皇冠', '金牌', '勋章'],
  '环保': ['绿叶', '地球', '水滴', '阳光'],
  '全球化': ['地球仪', '桥梁', '航线', '世界地图'],
  '效率': ['时钟', '闪电', '加速', '流水线'],
};

function selectVisualMetaphor(topics: string[]): string {
  const allText = topics.join(' ');
  for (const [key, metaphors] of Object.entries(VISUAL_METAPHOR_MAP)) {
    if (allText.includes(key)) return metaphors[0];
  }
  return '攀登'; // 默认：积极向上
}

// ========== V5 判断卡片布局触发 ==========
// 来自 gamma-ppt-database.md：3-4个并列要点触发三列/四宫格卡片
function shouldUseCards(content: string[], pageType: PageType): boolean {
  if (pageType !== 'content') return false;
  if (content.length === 0) return false;
  // 3-4个要点触发卡片布局
  if (content.length === 3 || content.length === 4) return true;
  // 每个要点都很短（<=20字）也可能触发
  if (content.length <= 4 && content.every(c => c.trim().length <= 20)) return true;
  return false;
}

// ========== V5 构建封面页 ==========
function buildCoverPage(title: string, subtitle?: string[]): string {
  const lines: string[] = [];
  lines.push(`# ${title}`);
  if (subtitle && subtitle.length > 0) {
    lines.push('');
    lines.push(`${subtitle.slice(0, 2).join(' · ')}`);
  }
  return lines.join('\n');
}

// ========== V5 构建目录页 ==========
// 来自 gamma-ppt-database.md：有序列表触发时间轴布局
function buildTocPage(title: string, content: string[]): string {
  const lines: string[] = [];
  lines.push(`## ${title}`);
  lines.push('');
  content.forEach((item, idx) => {
    const cleanItem = item.trim().replace(/^[0-9a-zA-Z一二三四五六七八九十百千万]+[.、)）\s]+/, '');
    lines.push(`${idx + 1}. **${cleanItem}**`);
  });
  return lines.join('\n');
}

// ========== V5 构建内容页（核心） ==========
// 来自 gamma-ppt-database.md 的排版触发规则：
// - ### 大文本触发（非普通小字）
// - - **粗体** 触发卡片
// - 1. 2. 3. 触发时间轴
function buildContentPage(title: string, content: string[], pageType: PageType, allowEnhancement: boolean = false): string {
  const lines: string[] = [];
  // P0修复：强制截断超长内容到50-80字范围
  const enforcedContent = enforcePageCharLimit(title, content);

  lines.push(`## ${title}`);
  lines.push('');

  // P0修复：数据页自动标注图表类型
  const chartMeta = pageType === 'data' ? assignChartType(enforcedContent) : null;
  if (chartMeta) {
    lines.push(`${chartMeta.emoji} [${chartMeta.chartType}]`);
    lines.push('');
  }

  switch (pageType) {
    case 'content': {
      if (shouldUseCards(enforcedContent, pageType)) {
        // V5 卡片布局：- **标题** + ### 大文本描述
        // 来自 gamma-ppt-database.md：三列/四宫格卡片
        for (const pt of enforcedContent) {
          if (!pt.trim()) continue;
          const { main, expanded } = enhanceBullet(pt, allowEnhancement);
          lines.push(`- **${main}**`);
          if (expanded.length > 0) {
            // 嵌套卡片：子要点用 ### 大文本
            for (const ex of expanded) {
              lines.push(`  ### ${ex}`);
            }
          } else if (pt.trim().length <= 20) {
            // 短标题：自动加一行大文本描述
            lines.push(`  ### ${main}`);
          }
        }
      } else if (enforcedContent.length > 5) {
        // V5 内容多：分段大文本（来自 gamma-ppt-database.md：禁用大段文本，必须拆分）
        for (const pt of enforcedContent) {
          if (!pt.trim()) continue;
          lines.push(`### ${pt.trim()}`);
          lines.push('');
        }
      } else {
        // V5 中等原因：标准列表 + 大文本强制
        for (const pt of enforcedContent) {
          if (!pt.trim()) continue;
          const { main, expanded } = enhanceBullet(pt, allowEnhancement);
          if (expanded.length > 0) {
            lines.push(`- **${main}**`);
            for (const ex of expanded) {
              lines.push(`  - ${ex}`);
            }
          } else {
            lines.push(`### ${main}`);
            lines.push('');
          }
        }
      }
      break;
    }

    case 'comparison': {
      // V5 对比布局：### 优势 / ### 劣势（来自 gamma-ppt-database.md）
      if (enforcedContent.length >= 2) {
        lines.push(`### 优势`);
        lines.push(`${enforcedContent[0].trim()}`);
        lines.push('');
        lines.push(`### 劣势`);
        lines.push(`${enforcedContent[1].trim()}`);
      } else {
        for (const pt of enforcedContent) {
          if (!pt.trim()) continue;
          lines.push(`- **${pt.trim()}**`);
        }
      }
      break;
    }

    case 'process': {
      // V5 时间轴/流程：有序列表（来自 gamma-ppt-database.md）
      enforcedContent.forEach((step, idx) => {
        if (!step.trim()) return;
        const { main, expanded } = enhanceBullet(step, allowEnhancement);
        lines.push(`${idx + 1}. **${main}**`);
        if (expanded.length > 0) {
          for (const ex of expanded) {
            lines.push(`   ${ex}`);
          }
        }
      });
      break;
    }

    case 'data': {
      // V5 数据页：数据要点（来自 gamma-ppt-database.md：数字"3"和"4"并列）
      for (const pt of enforcedContent) {
        if (!pt.trim()) continue;
        lines.push(`- **${pt.trim()}**`);
      }
      break;
    }

    case 'quote': {
      // V5 引言页：> 引用块（来自 gamma-ppt-database.md：演讲者备注分离）
      if (enforcedContent.length > 0) {
        lines.push(`> ${enforcedContent.join('\n> ')}`);
      }
      break;
    }

    default: {
      for (const pt of enforcedContent) {
        if (!pt.trim()) continue;
        const { main, expanded } = enhanceBullet(pt, allowEnhancement);
        lines.push(`### ${main}`);
        if (expanded.length > 0) {
          for (const ex of expanded) {
            lines.push(`- ${ex}`);
          }
        }
        lines.push('');
      }
    }
  }

  return lines.join('\n');
}

// ========== V5 构建结尾页 ==========
function buildEndingPage(title: string, content?: string[]): string {
  const lines: string[] = [];
  lines.push(`# ${title}`);
  if (content && content.length > 0) {
    lines.push('');
    lines.push(`> ${content.join('；')}`);
  }
  return lines.join('\n');
}

export type BuildMdV2Result = {
  markdown: string;
  visualMetaphor: string;
};

/**
 * V5 构建 Gamma Markdown（严格遵循 gamma-ppt-database.md 规范）
 * 返回 markdown 文本和检测到的全局视觉隐喻关键词（供 buildAdditionalInstructions 使用）
 * 
 * 排版触发规则（来自技术部培训资料）：
 * 1. '# 标题' → 封面大标题
 * 2. '## 页面标题' → 页面主标题
 * 3. '### 核心要点' → 大文本短句（非普通小字）
 * 4. '**粗体短句**' → 视觉强调（放大显示）
 * 5. '- **卡片标题**' → 卡片/区块触发（3-4列布局）
 * 6. '1. 2. 3.' → 时间轴/流程布局
 * 7. '> 引用块' → 演讲者备注
 * 8. '---' → 分页符
 */
export function buildMdV2(
  title: string,
  slides: SlideItem[],
  imageMode: string = 'noImages',
  allowEnhancement: boolean = false  // 🚨 V6修复：ENHANCEMENT_MAP默认关闭（preserve模式不应扩写）
): BuildMdV2Result {
  if (!slides || slides.length === 0) {
    return {
      markdown: `# ${title}\n\n---\n\n## 内容\n\n- 请添加内容`,
      visualMetaphor: '山峰',
    };
  }

  const pages: string[] = [];
  const total = slides.length;

  // P0修复：从所有幻灯片标题中提取全局视觉隐喻关键词
  const allTitles = slides.map(s => s.title);
  const globalVisualMetaphor = selectVisualMetaphor(allTitles);

  for (let i = 0; i < slides.length; i++) {
    const s = slides[i];
    const isLast = i === total - 1;
    const isFirst = i === 0;
    const pageType = detectPageType(i, total, s.title, s.content);

    let pageContent: string;

    switch (pageType) {
      case 'cover':
        pageContent = buildCoverPage(s.title, s.content);
        break;
      
      case 'toc':
        pageContent = buildTocPage(s.title, s.content || []);
        break;
      
      case 'ending':
        pageContent = buildEndingPage(s.title, s.content);
        break;
      
      default:
        pageContent = buildContentPage(s.title, s.content || [], pageType, allowEnhancement);
    }

    pages.push(pageContent);

    // V5 演讲者备注分离（来自 gamma-ppt-database.md）
    // P0修复：自动从超长内容中提取有价值信息到备注
    if (s.notes) {
      pages.push('');
      pages.push(`> 演讲者备注：${s.notes}`);
    } else if (estimatePageContentLength(s.title, s.content || []) > 80) {
      // 内容超长时，将被截断的细节自动放入备注
      const truncated = enforcePageCharLimit(s.title, s.content || []);
      const removedContent = (s.content || []).filter(c => !truncated.includes(c));
      if (removedContent.length > 0) {
        pages.push('');
        pages.push(`> 演讲者备注：${removedContent.join('；')}`);
      }
    }

    // V5 分页符控制：每一页结束后加强制分页符（除最后一页外）
    // 🚨 V6修复：确保每一页都有物理分页符，防止Gamma合并页面或留白
    if (!isLast) {
      pages.push('\n---\n');
    }
  }

  const rawMarkdown = pages.join('\n');

  // 🚨 V6新增：最终大文本验证
  // 确保所有正文行都有大文本标记（### 或 **），绝不出现裸小字正文
  const validatedMarkdown = rawMarkdown
    // 保护已有的 ### 大文本行（不重复处理）
    .split('\n')
    .map(line => {
      const trimmed = line.trim();
      // 跳过结构性行：标题、分隔符、空行、列表前缀、图表元标签
      if (!trimmed) return line;
      if (trimmed.startsWith('#')) return line;           // # ## ### 标题
      if (trimmed === '---') return line;                 // 分页符
      if (trimmed.startsWith('> ')) return line;         // 演讲者备注
      if (trimmed.startsWith('- ')) return line;          // 列表项
      if (trimmed.startsWith('1.') || trimmed.startsWith('2.') || trimmed.startsWith('3.') || trimmed.startsWith('4.') || trimmed.startsWith('5.')) return line; // 有序列表
      if (/^[0-9]+[.、]/.test(trimmed)) return line;     // 有序列表（中文序号）
      if (trimmed.startsWith('📈') || trimmed.startsWith('📊') || trimmed.startsWith('🥧') || trimmed.startsWith('💡')) return line; // 图表元标签
      if (trimmed.startsWith('**')) return line;          // 粗体行

      // 裸小字正文检测：普通中文句子没有触发器 → 强制加 ###
      // 仅对4个字以上的非结构行生效（排除emoji、单字等）
      if (trimmed.length >= 4 && /[\u4e00-\u9fff]/.test(trimmed)) {
        return `### ${trimmed}`;
      }
      return line;
    })
    .join('\n');

  return {
    markdown: validatedMarkdown,
    visualMetaphor: globalVisualMetaphor,
  };
}

/**
 * V5 构建 Gamma additionalInstructions（精细化排版指令）
 * 
 * 严格遵循 gamma-ppt-database.md 的规范：
 * 1. 字号规范：主标题≥44pt，页面标题≥32pt，正文≥18pt
 * 2. 信息密度：50-80字/页，超出必须拆分
 * 3. 大文本强制：正文最小展示层级 = 大文本
 * 4. 卡片布局：3-4个并列项触发三列/四宫格
 * 5. 时间轴：有序列表触发流程布局
 * 6. 配图规则：封面/过渡/结尾三处，风格必须含 "Minimalist, clean background, negative space"
 */
export function buildAdditionalInstructions(
  tone: string = 'professional',
  scene: string = 'biz',
  imageMode: string = 'auto',
  visualMetaphor?: string
): string {
  // ========== 通用排版规则（V5 核心） ==========
  const CRITICAL_DEFENSE = `CRITICAL INSTRUCTION — 你是一个纯粹的布局渲染引擎，严格遵循以下所有规则：
- 禁止发明、扩写或补充任何未提供的事实、数据或案例
- 禁止修改用户提供的内容文字
- 禁止合并或拆分由 --- 分隔符指定的页面边界
- 所有正文必须以大文本形式展示（### 或 **加粗**），禁止普通小字正文
- > 引用块严格作为演讲者备注，不做正文展示
- 仅执行排版布局，不执行内容创作

`;

  const baseRules = `【排版规则 — 严格遵守】

📐 字号规范（必须精确）：
- 主标题（#）：≥ 44pt，加粗，居中
- 页面标题（##）：≥ 32pt，加粗
- 大文本要点（###）：≥ 24pt，加粗（正文必须是大文本，禁止小字）
- 卡片标题（- **标题**）：≥ 20pt，加粗
- 辅助文字：≥ 14pt

📝 内容密度（铁律）：
- 单页正文严格控制在50-80字以内
- 超出80字必须拆分到下一页
- 禁止出现大段文本堆积
- 每页只放3-4个核心要点

🎨 布局触发规则（核心技巧）：
- 3-4个并列要点 → 使用三列/四宫格卡片布局
- 有序列表（1. 2. 3.）→ 时间轴/流程布局
- ### 大文本短句 → 独占一行的大字正文
- **粗体短句** → 视觉强调（放大显示）
- 对比内容（### 优势 / ### 劣势）→ 左右对照布局

📌 图标要求（铁律）：
- 每一页PPT必须包含2-6个图标元素（Icons）
- 图标用于：要点标记、装饰、视觉引导
- 禁止出现完全没有任何图标的页面
- 推荐图标库：Font Awesome / Material Icons / Ionicons
- 图标风格必须与PPT整体风格一致

📌 禁止事项（绝对禁止）：
- 禁止普通小字正文（必须是大文本）
- 禁止表格嵌套超过2层
- 禁止标题和内容混在一行
- 禁止留大面积空白
- 禁止在内容页堆砌超过4个要点
- 禁止页面完全没有视觉元素（纯文字墙）`;

  // ========== 语气风格规则（V5） ==========
  const toneRules: Record<string, string> = {
    professional: `【风格：专业商务】

配色：克制优雅，主色（深蓝/深灰）+ 1个强调色（金色/橙色），大面积留白
字体：无衬线字体（思源黑体/PingFang SC/Microsoft YaHei）
布局：规整对称，信息密度适中，视觉层次清晰
感觉：麦肯锡/BCG/贝恩咨询PPT风格，权威可信

视觉隐喻：攀登、建筑、根基（如：山峰、建筑、树根图片方向）`,

    casual: `【风格：简洁友好】

配色：明亮清新，主色（蓝/绿）+ 浅色背景，适当使用圆角元素
字体：无衬线字体，现代感强
布局：轻松随意，可用不对称布局，视觉重心偏移
感觉：Notion/Figma/Slack官方演示风格，友好亲切

视觉隐喻：拼图、编织、连接（如：拼图、编织图片方向）`,

    creative: `【风格：大胆创意】

配色：大丰富，2-3个亮色（渐变粉/紫/橙），允许大色块背景
字体：无衬线字体，粗体突出
布局：不对称、大胆、视觉冲击强，大量使用几何元素
感觉：Apple/特斯拉发布会风格，前卫震撼

视觉隐喻：破晓、冲刺、打破（如：日出、冲刺、打破常规图片方向）`,

    bold: `【风格：高端科技】

配色：深色主题，深蓝/深灰背景 + 亮色文字，大量使用渐变和光效
字体：无衬线字体，极细/极粗字重对比
布局：科技感强，大面积深色块，精致网格线
感觉：高端科技公司品牌发布，引领未来

视觉隐喻：星空、光路、电路（如：星空、光线、电路图片方向）`,

    traditional: `【风格：中国传统】

配色：古典配色，红/金/墨/米白，祥云/水墨/古典边框装饰
字体：标题粗体，正文宋体/黑体
布局：庄重大气，对称平衡，中式美学
感觉：故宫/国潮品牌发布风格，典雅大气

视觉隐喻：水墨、祥云、古典边框（如：水墨山水、祥云纹图片方向）`,
  };

  // ========== 配图规则（V5 核心） ==========
  // 来自 gamma-ppt-database.md：配图风格必须含 "Minimalist, clean background, negative space"
  let imageRules = '';
  switch (imageMode) {
    case 'noImages':
      imageRules = `
【图标规则】（图标是唯一视觉元素，必须大量使用）
- 每一页都必须包含3-6个 Icons，用于标记要点和装饰
- 图标风格：Simple, outlined, consistent stroke width
- 禁止出现没有任何图标的页面
- 推荐图标库：Font Awesome / Material Icons / Ionicons

【配图规则】
- 不使用任何外部图片
- 用色块、图标、几何图形填充视觉空间
- 内容少的页面用装饰性元素补充留白`;
      break;
    case 'aiGenerated':
      imageRules = `
【图标规则】（图标配合AI图增强可视化）
- 每一页都必须包含2-5个 Icons，用于标记要点和装饰
- 图标风格：Simple, outlined, consistent with AI image style
- 推荐图标库：Font Awesome / Material Icons / Ionicons

【配图规则】
- 封面页和结尾页必须配AI生成图
- 内容页仅在文字少于40字时配图
- 配图位置：右图或上图，禁止左图布局
- 配图风格（必须包含）：Minimalist, clean background, negative space, professional, high quality
- 留白感：配图描述必须含 "negative space"`;
      break;
    case 'webFreeToUseCommercially':
    case 'pexels':
      imageRules = `
【图标规则】（图标配合网图增强可视化）
- 每一页都必须包含2-5个 Icons，用于标记要点和装饰
- 图标风格：Simple, outlined, professional, consistent stroke width
- 禁止出现没有任何图标的页面
- 推荐图标库：Font Awesome / Material Icons / Ionicons

【配图规则】
- 封面页和结尾页必须配高质量网图
- 内容页每页至少配1张相关网图，确保图文结合
- 图片风格：professional, clean, business context, minimalist, negative space
- 确保图片来源合规可商用（Unsplash / Pexels / 自有版权）
- 配图位置：右图或上图
- 如文字内容少于40字/页，必须额外增加配图数量`;
      break;
    case 'theme-img':
      imageRules = `
【图标规则】（图标配合主题强调图增强可视化）
- 每一页都必须包含2-5个 Icons，用于标记要点和装饰
- 图标风格：Simple, outlined, professional, consistent stroke width
- 禁止出现没有任何图标的页面
- 推荐图标库：Font Awesome / Material Icons / Ionicons

【配图规则】（主题套图=themeAccent）
- 使用Gamma主题内置的主题强调图（themeAccent）
- 这些是主题编辑器中配置的强调图，与主题风格完美匹配
- 封面页和结尾页使用主题强调图
- 内容页每页至少使用1张主题强调图，确保图文结合
- 配图位置：右图或上图
- 如文字内容少于40字/页，必须额外增加主题强调图`;
      break;
    default:
      imageRules = `
【图标规则】（图标是视觉核心手段）
- 每一页都必须包含2-5个 Icons，用于标记要点和装饰
- 图标风格：Simple, outlined, professional
- 推荐图标库：Font Awesome / Material Icons / Ionicons

【配图规则】
- 封面页配专业图片
- 内容页适当配图
- 图片不遮挡文字，保持阅读性`;
  }

  // ========== 语言规则 ==========
  const languageRules = `
【语言规则】
- 所有文字使用简体中文
- 保持演讲者备注（通过 > 引用块）
- 保持整体风格从头到尾统一一致`;

  const toneRule = toneRules[tone] || toneRules.professional;

  // P0修复：全局视觉隐喻贯穿指令
  const metaphorSection = visualMetaphor
    ? `\n\n【全局视觉隐喻】\n贯穿全演示的统一意象：${visualMetaphor}。\n所有配图、图标、色块风格应与此意象一致（如：使用山峰图片、光线效果、渐变金到白）。\n配图描述中必须体现该意象关键词。`
    : '';

  return `${CRITICAL_DEFENSE}${baseRules}\n\n${toneRule}${metaphorSection}${imageRules}${languageRules}`;
}

/**
 * V5 获取配图风格关键词
 * 来自 gamma-ppt-database.md 的配图风格关键词库
 */
export function getImageStyleKeyword(
  scene: string,
  tone: string
): string {
  const baseKeyword = 'Minimalist, clean background, negative space, professional';
  
  const sceneKeywords: Record<string, string> = {
    '商务汇报': 'corporate, business meeting, blue tones',
    '路演融资': 'startup, investment, growth, professional',
    '培训课件': 'classroom, education, friendly, approachable',
    '创意方案': 'creative, innovative, modern, vibrant',
    '美妆时尚': 'elegant, stylish, chic, fashion, refined',
    '数据分析': 'data visualization, charts, clean, professional',
    '年度总结': 'annual report, summary, corporate, polished',
    '产品发布': 'product launch, futuristic, sleek, technology',
    '教育课件': 'learning, knowledge, clean, simple',
    '生活方式': 'lifestyle, natural, warm, approachable',
    '科技AI': 'futuristic, technology, AI, modern, high tech',
    '通用': 'clean, versatile, professional',
  };

  const sceneKeyword = sceneKeywords[scene] || sceneKeywords['通用'];
  
  return `${baseKeyword}, ${sceneKeyword}, high quality`;
}
