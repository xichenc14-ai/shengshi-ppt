// build-md-v2.ts — Gamma PPT Markdown 排版引擎 V6
// 重构参考：兮晨哥哥 V3 提示词指南 + Gamma PPT 最佳实践
//
// V6 核心目标：彻底执行"无情排版机器"原则
// - 零自作主张扩写（ENHANCEMENT_MAP 已拔除）
// - 强制 4 点拆页（chunkArray）
// - 全部正文统一 ### 大文本
// - 留白自动注入 Gamma 填充提示
// - 物理分页符 --- 锁死每页边界

export type SlideItem = {
  id: string;
  title: string;
  content?: string[];  // 页面核心要点数组（兼容旧字段名）
  points?: string[];   // 页面核心要点数组（新字段名，优先级更高）
  notes?: string;      // 演讲者备注
};

export type BuildMdV2Result = {
  markdown: string;
  visualMetaphor: string;
};

// ========== 核心辅助：数组强制切块（4点/页熔断机制） ==========
function chunkArray<T>(array: T[], size: number): T[][] {
  if (!array || array.length === 0) return [];
  const result: T[][] = [];
  for (let i = 0; i < array.length; i += size) {
    result.push(array.slice(i, i + size));
  }
  return result;
}

// ========== V6 构建封面页 ==========
function buildCoverPage(title: string): string {
  return `# ${title}\n`;
}

// ========== V6 构建结尾页 ==========
function buildEndingPage(title: string, notes?: string): string {
  let md = `# ${title}\n`;
  if (notes) {
    md += `\n> ${notes}\n`;
  }
  return md;
}

// ========== V6 构建内容页（无情排版核心） ==========
// 规则：
// 1. 每页严格 ≤4 个要点（超出自动拆页，标题加"(续)"）
// 2. 全部正文统一 ### 大文本包裹（彻底消灭小字正文）
// 3. 演讲者备注在内容后、分页符前注入
// 4. ≤2 点页面自动注入 Gamma 留白填充提示
function buildContentPage(
  title: string,
  points: string[],
  speakerNotes?: string,
  isContinuation: boolean = false
): string {
  const MAX_POINTS_PER_PAGE = 4;
  const lines: string[] = [];

  // 标题：续页加 "(续)" 后缀
  const titleSuffix = isContinuation ? ' (续)' : '';
  lines.push(`## ${title}${titleSuffix}`);
  lines.push('');

  // 要点处理：全部用 ### 大文本包裹
  // V6：彻底消灭 - 列表小字，强制大文本
  for (const point of points) {
    const trimmed = point.trim();
    if (!trimmed) continue;
    lines.push(`### ${trimmed}`);
    lines.push('');
  }

  // 留白填充提示：≤2 点页面自动注入
  // V6：内容少时指导 Gamma 用图标/排版填充，不要留大白板
  if (points.length <= 2) {
    lines.push('> *(Gamma提示：此页内容较少，请使用高品质图标、色块或排版元素进行视觉填充，避免大面积留白。)*');
    lines.push('');
  }

  // 演讲者备注：在内容末尾、分页符之前注入
  if (speakerNotes && speakerNotes.trim()) {
    const noteLines = speakerNotes
      .trim()
      .split('\n')
      .filter(l => l.trim())
      .map(l => `> ${l.trim()}`);
    if (noteLines.length > 0) {
      lines.push(noteLines.join('\n'));
      lines.push('');
    }
  }

  return lines.join('\n');
}

// ========== V6 主函数：Markdown 组装引擎 ==========
export function buildMdV2(
  title: string,
  slides: SlideItem[],
  _imageMode: string = 'noImages',
  _allowEnhancement: boolean = false
): BuildMdV2Result {
  if (!slides || slides.length === 0) {
    return {
      markdown: `# ${title}\n\n---\n\n## 内容\n\n### 请添加内容`,
      visualMetaphor: '山峰',
    };
  }

  const MAX_POINTS_PER_PAGE = 4;
  const outputParts: string[] = [];
  const total = slides.length;

  // 遍历每一页幻灯片
  slides.forEach((slide, index) => {
    const points = slide.points ?? slide.content ?? [];

    // ===== 强制拆页：>4 点自动拆成多页 =====
    const chunks = chunkArray(points, MAX_POINTS_PER_PAGE);

    chunks.forEach((chunk, chunkIndex) => {
      const isFirstChunk = chunkIndex === 0;
      const isLastChunk = chunkIndex === chunks.length - 1;
      const isContinuation = !isFirstChunk;

      // 🚨 V6.1 修复：不再强制首页=封面、末页=结尾
      // 每一页都按正常内容页处理，让 Gamma 自己决定封面/结尾
      outputParts.push(
        buildContentPage(
          slide.title,
          chunk,
          isLastChunk ? slide.notes : undefined,
          isContinuation
        )
      );

      // 强制物理分页符
      if (!(index === total - 1 && isLastChunk)) {
        outputParts.push('---\n');
      }
    });
  });

  return {
    markdown: outputParts.join('\n').trim(),
    visualMetaphor: '山峰',
  };
}

// ========== V6 buildAdditionalInstructions ==========
// 严格遵循 V3 提示词指南，为 Gamma 注入强制性排版约束
export function buildAdditionalInstructions(
  tone: string = 'professional',
  scene: string = 'biz',
  imageMode: string = 'auto',
  _visualMetaphor?: string  // V6：已废弃，保留参数兼容
): string {
  // CRITICAL 防御指令：封锁 Gamma 的一切发散权限
  const CRITICAL_DEFENSE = `CRITICAL — 你是一个纯粹的布局渲染引擎，严格遵循以下所有规则：
- 禁止发明、扩写或补充任何未提供的事实、数据或案例
- 禁止修改用户提供的任何文字内容
- 禁止合并或拆分 --- 分隔符指定的页面边界
- 所有正文必须以大文本形式展示（### 三级标题），禁止普通小字正文
- > 引用块严格作为演讲者备注，不做正文展示
- 仅执行排版布局，不执行内容创作

`;

  // 基础排版规则
  const baseRules = `【排版规则 — 严格遵守】

📐 字号规范：
- 主标题（#）：≥ 44pt，加粗，居中
- 页面标题（##）：≥ 32pt，加粗
- 大文本正文（###）：≥ 24pt，加粗

📝 内容密度（铁律）：
- 单页正文严格控制在50-80字以内
- 超出80字必须拆分到下一页
- 每页只允许3-4个核心要点（代码已强制执行）

📌 禁止事项：
- 禁止普通小字正文（所有正文必须用 ### 大文本）
- 禁止将列表识别为表格
- 禁止堆砌超过4个要点
- 禁止留大面积空白

`;

  // 语气风格规则
  const toneRules: Record<string, string> = {
    professional: `【风格：专业商务】

配色：克制优雅，主色（深蓝/深灰）+ 1个强调色（金色/橙色），大面积留白
字体：无衬线字体（思源黑体/PingFang SC/Microsoft YaHei）
布局：规整对称，信息密度适中，视觉层次清晰
感觉：麦肯锡/BCG/贝恩咨询PPT风格，权威可信`,
    casual: `【风格：简洁友好】

配色：明亮清新，主色（蓝/绿）+ 浅色背景，适当使用圆角元素
字体：无衬线字体，现代感强
感觉：Notion/Figma/Slack官方演示风格，友好亲切`,
    creative: `【风格：大胆创意】

配色：大丰富，2-3个亮色（渐变粉/紫/橙），允许大色块背景
字体：无衬线字体，粗体突出
感觉：创意演示/ startup 路演风格，视觉冲击强`,
    bold: `【风格：沉稳有力】

配色：重色块，主色（深色）+ 强对比强调色，视觉冲击大
字体：无衬线字体，粗体为主
感觉：战略咨询/投行报告风格，严谨权威`,
    traditional: `【风格：传统庄重】

配色：正式克制，主色（深蓝/金色）+ 白色背景，版面严谨
字体：衬线+无衬线混用（标题衬线，正文无衬线）
感觉：政府公文/学术报告/大型企业年会风格`,
  };

  const selectedTone = toneRules[tone] || toneRules.professional;
  const toneRule = selectedTone;

  // 配图规则
  let imageRules = '';
  if (imageMode === 'pictographic') {
    imageRules = `\n【配图：免费插图模式】
使用 Gamma 内置 pictographic 插图（免费），为每一页配2-4个简洁图标，
图标风格：Simple, outlined, consistent stroke width, professional
禁止使用需要 credits 的 AI 图片或 Pexels 照片`;
  } else if (imageMode === 'aiGenerated') {
    imageRules = `\n【配图：AI 生成图片模式】
每页使用 1 张 AI 生成的配图（imagen-3-flash，2积分/图）
配图风格：Minimalist, clean background, negative space, professional
推荐构图：单人物/单物体，居中，留白充足
禁止使用：DALL-E-3（33积分/图，极贵），GPT-Image-1-High（120积分/图，严禁）`;
  } else if (imageMode === 'webFreeToUseCommercially') {
    imageRules = `\n【配图：网络免费图片模式】
使用 webFreeToUseCommercially 模式，搜索高质量免费商用图片
配图风格：professional, clean, minimalist, business context
禁止使用有任何版权争议的图片`;
  } else if (imageMode === 'noImages') {
    imageRules = `\n【配图：纯净无图模式】
不添加任何图片，仅用图标（Unicode emoji）和排版元素丰富视觉
图标推荐：✅❌📊📈💡🎯⭐🔑🚀💼📧📞📍📌🔍✨⚡🔥💎🏆🔧📋
图标风格：Outlined, rounded, professional，与整体色调协调`;
  } else if (imageMode === 'theme-img' || imageMode === 'theme') {
    imageRules = `\n【配图：主题套图模式】
使用 Gamma 内置 Emphasize 强调布局图（主题装饰性图片，免费），
配合内置图标，视觉丰富且无需额外 credits
每页使用不同的强调布局，保持全演示视觉多样性`;
  }

  const languageRules = `\n【语言】
所有正文内容必须使用简体中文（zh-cn）
标题和正文禁止使用英文（除非是公认的技术术语或品牌名）`;

  return `${CRITICAL_DEFENSE}${baseRules}${toneRule}${imageRules}${languageRules}`;
}

// V6：废弃以下函数，已被 chunkArray + buildContentPage 取代
// - enhanceBullet（ENHANCEMENT_MAP 已拔除）
// - detectPageType（V6 改用 index 判断：0=封面，末=结尾，中间=内容）
// - enforcePageCharLimit（chunkArray 已强制执行 4 点限制）
// - assignChartType（V6 不在预处理层注入图表元数据）
// - shouldUseCards（V6 全部统一 ###，不依赖卡片触发逻辑）
// - buildTocPage（V6 不生成目录页，Gamma 自动生成）
// - truncateToWordCount（V6 不做字数截断，由 chunkArray 控制）
// - estimatePageContentLength（V6 不做预估判断）
// - needsSplit（V6 由 chunkArray 直接执行）
// - VISUAL_METAPHOR_MAP / selectVisualMetaphor（V6 静态默认值）
// - getImageStyleKeyword（V6 不在构建层处理配图关键词）
