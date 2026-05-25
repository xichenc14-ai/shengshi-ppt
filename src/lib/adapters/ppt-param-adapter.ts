/**
 * ppt-param-adapter - D1 canonical data normalization
 *
 * 职责：
 * 1. normalizeUserInput     — 规范化用户输入字段别名
 * 2. mapImageSource         — 图片源字符串映射（兼容 themeId 参数）
 * 3. buildGammaPayload      — 构建 Gamma API payload（单参数宽兼容）
 * 4. parseMarkdownOutline   — Markdown fallback outline 解析
 * 5. generateMinimalOutline  — 生成最小 outline（AI 不可用时）
 *
 * 兼容调用点：
 * - src/app/api/gamma/route.ts:         import { normalizeUserInput, mapImageSource }
 * - src/app/api/gamma-direct/route.ts:  import { normalizeUserInput, mapImageSource }
 * - src/app/api/outline/route.ts:       import { normalizeUserInput, parseMarkdownOutline, generateMinimalOutline }
 */

import type { OutlineSlide } from '@/lib/types/outline-response';

// ─────────────────────────────────────────────
// A. normalizeUserInput
// ─────────────────────────────────────────────

export interface PptUserInput {
  topic?: string;
  inputText?: string;
  text?: string;
  pageCount?: number;
  slideCount?: number;
  numCards?: number;
  pages?: number;
  textMode?: string;
  contentStrategy?: string;
  themeId?: string;
  templateId?: string;
  tone?: string;
  style?: string;
  imageSource?: string;
  imgMode?: string;
  imageMode?: string;
  directImgMode?: string;
  additionalInstructions?: string;
  extraInstructions?: string;
  exportAs?: string;
  format?: string;
  auto?: boolean;
  [key: string]: unknown;
}

export type GammaImageSource =
  | 'noImages'
  | 'themeAccent'
  | 'pictographic'
  | 'webFreeToUseCommercially'
  | 'aiGenerated';

function firstNonEmptyString(...values: unknown[]): string | undefined {
  for (const value of values) {
    if (typeof value === 'string' && value.trim()) return value.trim();
  }
  return undefined;
}

function firstNumber(...values: unknown[]): number | undefined {
  for (const value of values) {
    if (typeof value === 'number' && Number.isFinite(value) && value > 0) return value;
    if (typeof value === 'string' && value.trim()) {
      const parsed = Number(value);
      if (Number.isFinite(parsed) && parsed > 0) return parsed;
    }
  }
  return undefined;
}

function firstBoolean(...values: unknown[]): boolean | undefined {
  for (const value of values) {
    if (typeof value === 'boolean') return value;
  }
  return undefined;
}

/**
 * 规范化用户输入字段别名 → canonical PptUserInput
 *
 * 字段映射规则：
 * topic / inputText / text                     → topic
 * pageCount / slideCount / numCards / pages     → pageCount
 * textMode / contentStrategy                    → textMode
 * themeId / templateId                          → themeId
 * tone / style                                  → tone
 * imageSource / imgMode / imageMode / directImgMode → imageSource
 * additionalInstructions / extraInstructions    → additionalInstructions
 * exportAs / format                             → exportAs
 *
 * 返回值：canonical 字段优先，...v 作为最后覆盖层
 */
export function normalizeUserInput(raw: Record<string, unknown>): PptUserInput {
  const v = raw;

  const topic = firstNonEmptyString(v.topic, v.inputText, v.text);
  const pageCount = firstNumber(v.pageCount, v.slideCount, v.numCards, v.pages);
  const textMode = firstNonEmptyString(v.textMode, v.contentStrategy);
  const themeId = firstNonEmptyString(v.themeId, v.templateId);
  const tone = firstNonEmptyString(v.tone, v.style);
  const imageSource = firstNonEmptyString(v.imageSource, v.imgMode, v.imageMode, v.directImgMode);
  const additionalInstructions = firstNonEmptyString(v.additionalInstructions, v.extraInstructions);
  const exportAs = firstNonEmptyString(v.exportAs, v.format);

  // 原始字段先铺底，canonical 字段最后覆盖，避免 slideCount/numCards 等别名被反向覆盖。
  return {
    ...v,
    // Canonical 字段（高优先级）
    topic,
    inputText: topic,
    pageCount,
    textMode,
    contentStrategy: textMode,
    themeId,
    templateId: themeId,
    tone,
    style: tone,
    imageSource,
    additionalInstructions,
    exportAs,
    auto: firstBoolean(v.auto),
  } as PptUserInput;
}

// ─────────────────────────────────────────────
// B. mapImageSource
// ─────────────────────────────────────────────

/**
 * imageSource 字符串映射到 Gamma API imageOptions.source 值
 *
 * 兼容签名：第二参数 themeId 预留给调用方扩展，当前版本不使用
 *
 * 支持输入（不区分大小写，完整别名清单）：
 * - noImages / none                    → themeAccent (无图模式已下线，兼容回退)
 * - theme-img / theme / themeAccent    → themeAccent
 * - pictographic / 插图                 → pictographic
 * - web / 网图 / 搜索图                 → webFreeToUseCommercially
 * - webFreeToUseCommercially           → webFreeToUseCommercially
 * - ai / aiGenerated / AI图             → aiGenerated (imagen-3-flash)
 * - ai-pro / AI尊享                    → aiGenerated (imagen-3-pro)
 * - 默认                                → themeAccent
 */
export function mapImageSource(
  imageSource: string | undefined,
  _themeId?: string // 预留给调用方使用，当前版本不使用
): Record<string, unknown> {
  if (!imageSource) {
    return { source: 'themeAccent' };
  }

  const normalized = imageSource.toLowerCase().trim();

  switch (normalized) {
    case 'noimages':
    case 'none':
      return { source: 'themeAccent' };

    case 'weballimages':
      return { source: 'webFreeToUseCommercially' };

    case 'webfreetouse':
      return { source: 'webFreeToUseCommercially' };

    case 'webfreetousecommercially':
    case 'web':
    case '网图':
    case '搜索图':
      return { source: 'webFreeToUseCommercially' };

    case 'aigenerated':
    case 'ai':
    case 'ai图':
      return {
        source: 'aiGenerated',
        model: 'imagen-3-flash',
        style: 'flat illustration, minimalist, clean background, negative space',
      };

    case 'ai-pro':
    case 'ai尊享':
      return {
        source: 'aiGenerated',
        model: 'imagen-3-pro',
        style: 'professional, high quality, cinematic, detailed',
      };

    case 'theme':
    case 'theme-img':
    case 'themeaccent':
      return { source: 'themeAccent' };

    case 'pictographic':
    case '插图':
      return { source: 'pictographic' };

    default:
      return { source: 'themeAccent' };
  }
}

export function buildGammaImageOptions(
  imageSource: string | undefined,
  themeId?: string,
  existingOptions?: Record<string, unknown>
): Record<string, unknown> {
  const hasExplicitSource = typeof imageSource === 'string' && imageSource.trim().length > 0;
  const rawSource = hasExplicitSource
    ? imageSource
    : (typeof existingOptions?.source === 'string' ? existingOptions.source : imageSource);
  const mapped = mapImageSource(rawSource, themeId);
  const merged = {
    ...mapped,
    ...(existingOptions || {}),
    source: mapped.source,
  };

  if (merged.source === 'noImages') {
    return { ...merged, source: 'themeAccent' };
  }

  return merged;
}

// ─────────────────────────────────────────────
// C. buildGammaPayload
// ─────────────────────────────────────────────

/**
 * 构建 Gamma API payload（gamma-direct 直通模式）
 *
 * 单参数宽兼容设计：输入同时包含 normalizeUserInput 规范后的字段
 * 和 gammaFields 调用方自定义字段，全部在一笔对象内传入。
 */
export function buildGammaPayload(
  input: PptUserInput & {
    finalInputText?: string;
    finalThemeId?: string;
    finalTone?: string;
    imageOptions?: Record<string, unknown>;
    instructions?: string;
    textMode?: 'preserve' | 'generate' | 'condense';
  }
): Record<string, unknown> {
  const normalized = normalizeUserInput(input);

  const finalInputText = (input as Record<string, unknown>).finalInputText as string | undefined
    || normalized.inputText
    || normalized.topic
    || '';
  const finalThemeId = (input as Record<string, unknown>).finalThemeId as string | undefined
    || normalized.themeId
    || '';
  const finalTone = (input as Record<string, unknown>).finalTone as string | undefined
    || normalized.tone
    || 'professional';
  const imageOptions = (input as Record<string, unknown>).imageOptions as Record<string, unknown> | undefined
    || { source: 'themeAccent' };
  const instructions = (input as Record<string, unknown>).instructions as string | undefined
    || normalized.additionalInstructions
    || '';
  const textMode = (input as Record<string, unknown>).textMode as string | undefined
    || 'preserve';

  return {
    inputText: finalInputText,
    textMode,
    format: normalized.exportAs || 'presentation',
    numCards: normalized.pageCount ?? 8,
    exportAs: normalized.exportAs || 'pptx',
    themeId: finalThemeId,
    cardSplit: 'inputTextBreaks',
    additionalInstructions: instructions,
    textOptions: {
      amount: 'medium',
      tone: finalTone,
      language: 'zh-cn',
    },
    imageOptions,
    cardOptions: { dimensions: '16x9' },
  };
}

// ─────────────────────────────────────────────
// D. parseMarkdownOutline
// ─────────────────────────────────────────────

/**
 * 从 Markdown 文本解析 outline 结构（JSON 解析失败时的 fallback）
 *
 * 解析规则：
 * - # 标题           → doc title
 * - ## 标题          → slide.title，index 从 1 开始递增
 * - - 或 * 开头的行   → slide.bullets
 * - --- 分隔符        → 完成当前 slide
 *
 * 每条 slide 输出包含完整兼容字段：
 *   index, title, bullets, content(=bullets), speakerNotes, notes
 */
export function parseMarkdownOutline(raw: string): {
  title: string;
  slides: OutlineSlide[];
} | null {
  if (!raw || typeof raw !== 'string') return null;

  const lines = raw.split('\n');
  const slides: OutlineSlide[] = [];
  let docTitle = '';
  let currentSlide: { title: string; bullets: string[] } | null = null;
  let slideIndex = 1; // 从 1 开始

  const pushSlide = (title: string, bullets: string[]): void => {
    slides.push({
      index: slideIndex++,
      title,
      bullets,
      content: [...bullets],
      speakerNotes: undefined,
      notes: undefined,
    });
  };

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    // 文档标题：# Title
    if (trimmed.startsWith('# ') && !trimmed.startsWith('## ')) {
      docTitle = trimmed.replace(/^#\s*/, '').trim();
      continue;
    }

    // 新 slide：## Title
    if (trimmed.startsWith('## ')) {
      if (currentSlide) {
        pushSlide(currentSlide.title, currentSlide.bullets);
      }
      currentSlide = {
        title: trimmed.replace(/^##\s*/, '').trim(),
        bullets: [],
      };
      continue;
    }

    // 分隔符 → 完成当前 slide
    if (trimmed === '---' || trimmed === '***' || trimmed === '___') {
      if (currentSlide) {
        pushSlide(currentSlide.title, currentSlide.bullets);
        currentSlide = null;
      }
      continue;
    }

    // 要点行：- item 或 * item 或 1. item
    const isBullet =
      trimmed.startsWith('- ') ||
      trimmed.startsWith('* ') ||
      /^\d+\.\s/.test(trimmed);

    if (isBullet && currentSlide) {
      const text = trimmed
        .replace(/^[-*]\s*/, '')
        .replace(/^\d+\.\s*/, '')
        .trim();
      if (text) currentSlide.bullets.push(text);
      continue;
    }

    // 普通文本行（无当前 slide → 作为新 slide 的标题）
    if (!currentSlide && trimmed.length > 5) {
      currentSlide = {
        title: trimmed.length > 30
          ? trimmed.substring(0, 30) + '...'
          : trimmed,
        bullets: [],
      };
    }
  }

  // 最后一个 slide
  if (currentSlide) {
    pushSlide(currentSlide.title, currentSlide.bullets);
  }

  return slides.length > 0
    ? { title: docTitle || 'PPT', slides }
    : null;
}

// ─────────────────────────────────────────────
// E. generateMinimalOutline
// ─────────────────────────────────────────────

/**
 * 当所有 AI 模型不可用时，生成最小可用 outline
 *
 * @param topic 用户输入的主题
 * @param numCards 请求的页数（默认 8，范围 3-20）
 */
const FALLBACK_SECTION_TITLES = [
  '背景与目标',
  '现状洞察',
  '关键问题',
  '方案设计',
  '实施路径',
  '资源与协同',
  '风险与应对',
  '阶段成果',
  '总结与行动',
];

function truncateZh(text: string, max = 24): string {
  const trimmed = text.trim();
  if (!trimmed) return '';
  return trimmed.length > max ? `${trimmed.slice(0, max - 1)}…` : trimmed;
}

function extractFallbackTitle(topic: string): string {
  const firstLine = topic
    .split('\n')
    .map((line) => line.replace(/^#+\s*/, '').trim())
    .find(Boolean);
  return truncateZh(firstLine || topic || 'PPT', 28) || 'PPT';
}

function extractTopicPhrases(topic: string): string[] {
  const cleaned = topic
    .replace(/\r/g, '\n')
    .replace(/[ \t]+/g, ' ')
    .trim();
  if (!cleaned) return [];

  const segments = cleaned
    .split(/[\n。！？!?；;，,、:：|/（）()【】\[\]<>《》]/)
    .map((item) => item.replace(/^[-*]\s*/, '').replace(/^\d+\.\s*/, '').trim())
    .filter((item) => item.length >= 3 && item.length <= 28);

  const seen = new Set<string>();
  const deduped: string[] = [];
  for (const s of segments) {
    const key = s.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    deduped.push(s);
  }
  return deduped;
}

function extractSentencePool(topic: string): string[] {
  const parts = topic
    .replace(/\r/g, '\n')
    .split(/[\n。！？!?]/)
    .map((item) => item.trim())
    .filter((item) => item.length >= 6);
  return parts.length > 0 ? parts : [topic.trim()];
}

export function generateMinimalOutline(
  topic: string,
  numCards: number = 8
): { title: string; slides: OutlineSlide[] } {
  const safeTopic = topic?.trim() || 'PPT';
  const safeCount = Math.max(3, Math.min(numCards || 8, 20));
  const title = extractFallbackTitle(safeTopic);
  const phrasePool = extractTopicPhrases(safeTopic);
  const sentencePool = extractSentencePool(safeTopic);
  const pickPhrase = (idx: number): string =>
    phrasePool[idx % phrasePool.length] || title;
  const pickSentence = (idx: number): string =>
    sentencePool[idx % sentencePool.length] || safeTopic;

  const slides: OutlineSlide[] = [];

  // 封面（index = 1）
  slides.push({
    index: 1,
    title,
    bullets: [
      `主题聚焦：${truncateZh(pickPhrase(0), 20)}`,
      '输出目标：形成可展示的完整方案',
      '演示方式：结构化表达 + 关键结论',
    ],
    content: [
      `主题聚焦：${truncateZh(pickPhrase(0), 20)}`,
      '输出目标：形成可展示的完整方案',
      '演示方式：结构化表达 + 关键结论',
    ],
    speakerNotes: undefined,
    notes: `封面金句：围绕“${truncateZh(title, 12)}”统一叙事主线。`,
  });

  // 内容页
  for (let i = 2; i < safeCount; i++) {
    const poolIndex = i - 2;
    const section = FALLBACK_SECTION_TITLES[poolIndex % FALLBACK_SECTION_TITLES.length];
    const phrase = truncateZh(pickPhrase(poolIndex + 1), 12);
    const sentence = truncateZh(pickSentence(poolIndex), 22);
    const slideTitle = phrase && phrase !== section
      ? `${section}：${phrase}`
      : section;
    const bullets = [
      `核心点：${phrase}`,
      `关键信息：${sentence}`,
      '行动建议：明确负责人、节奏和里程碑',
    ];
    slides.push({
      index: i,
      title: slideTitle,
      bullets,
      content: [...bullets],
      speakerNotes: undefined,
      notes: '可视化建议：对比用柱状图，趋势用折线图。',
    });
  }

  // 结尾页
  slides.push({
    index: safeCount,
    title: '总结与展望',
    bullets: [
      `核心结论：${truncateZh(pickPhrase(safeCount), 18)}`,
      '下一步：拆解任务并推进落地',
      '收尾：对齐目标，持续复盘优化',
    ],
    content: [
      `核心结论：${truncateZh(pickPhrase(safeCount), 18)}`,
      '下一步：拆解任务并推进落地',
      '收尾：对齐目标，持续复盘优化',
    ],
    speakerNotes: undefined,
    notes: '结尾金句：用清晰行动把想法变成结果。',
  });

  return { title, slides };
}
