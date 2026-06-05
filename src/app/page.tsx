'use client';

import '@/lib/dommatrix-polyfill';
import React, { useState, useCallback, useRef, useEffect, useMemo, Suspense } from 'react';
import { useAuth } from '@/lib/auth-context';
import { useRouter, useSearchParams } from 'next/navigation';
import ResponsivePdfPreview from '@/components/ResponsivePdfPreview';

import AnnouncementBar, { getLatestAnnouncement } from '@/components/AnnouncementBar';
import Navbar from '@/components/Navbar';
import SceneCards from '@/components/SceneCards';
import ProcessSection from '@/components/ProcessSection';
import FAQSection from '@/components/FAQSection';
import TestimonialSection from '@/components/TestimonialSection';
import Footer from '@/components/Footer';
import ProPanel from '@/components/ProPanel';
import LoginModal from '@/components/LoginModal';
import PaymentModal from '@/components/PaymentModal';
import ThemePickerModal from '@/components/ThemePickerModal';
import StreamingOutline from '@/components/StreamingOutline';
import GenerationProgress from '@/components/GenerationProgress';
import SkeletonCard from '@/components/SkeletonCard';
import ThemeSelector from '@/components/ThemeSelector';

import ScrollingBanner from '@/components/ScrollingBanner';
import { buildMdV2 } from '@/lib/build-md-v2';
import { validateInput, LIMITS, LIMITS_HUMAN_READABLE } from '@/lib/input-validation';
import { getThemeById } from '@/lib/theme-database';
import { checkPermission, getPlan, PLAN_LIST } from '@/lib/membership';
import { APP_VERSION } from '@/lib/version';

/* ==================== Config ==================== */

export const dynamic = 'force-dynamic';

const GEN_MODES_MAP: Record<string, string> = { generate: 'generate', condense: 'condense', preserve: 'preserve' };

const HOT_SCENES = [
  { label: '📊 工作汇报', text: '本周工作汇报，包含完成任务、问题分析、下周计划' },
  { label: '💼 商业方案', text: '咖啡品牌市场推广方案PPT' },
  { label: '🎓 教学课件', text: '初中数学《勾股定理》教学课件' },
  { label: '📋 年终总结', text: '2025年度工作总结，包含主要成绩、数据亮点和明年规划' },
];

type GammaImageSource = 'noImages' | 'themeAccent' | 'pexels' | 'aiGenerated';
type UploadedFile = { name: string; type: string; size: number; content?: string; passthrough?: boolean };
type SlideItem = { id: string; title: string; content?: string[]; notes?: string };
type OutlinePreprocessInfo = {
  truncated?: boolean;
  requestedMode?: 'generate' | 'condense' | 'preserve';
  effectiveMode?: 'generate' | 'condense' | 'preserve';
  autoAdjusted?: boolean;
  forceRequestedMode?: boolean;
  strictPreserve?: boolean;
};
type OutlineResultState = {
  title: string;
  slides: SlideItem[];
  scene?: string;
  themeId?: string;
  tone?: string;
  imageMode?: string;
  meta?: {
    preprocess?: OutlinePreprocessInfo;
    intent?: {
      themeLocked?: boolean;
      themeLabel?: string;
      pageCountLocked?: boolean;
      imageModeLocked?: boolean;
      toneLocked?: boolean;
    };
    [key: string]: unknown;
  };
};
type MaterialKind = 'chat-screenshot' | 'document' | 'ppt-draft' | 'table' | 'image' | 'other';
type OutlinePayload = {
  inputText: string;
  uploadedFiles: Array<{ name: string; type: string; size: number; passthrough?: boolean }>;
  slideCount: number;
  textMode: string;
  auto: boolean;
  strictPreserve: boolean;
  forceRequestedMode: boolean;
  themeId: string;
  tone: string;
  imageMode: string;
};
type PersistedGenerationState = {
  version: 1;
  stage: 'outline' | 'gamma';
  userId?: string;
  updatedAt: number;
  startedAt: number;
  mode: 'direct' | 'smart';
  outline?: {
    payload: OutlinePayload;
  };
  gamma?: {
    generationId: string;
    title: string;
    slides: SlideItem[];
    renderSignature: string;
  };
};

const TABLE_INTENT_RE = /(处理表格|解析表格|表格数据|数据表|明细表|excel|xlsx|csv|sheet|透视表|图表数据)/i;
const CHAT_SCREENSHOT_RE = /(聊天|微信|群聊|对话|聊天记录|截图|截屏|screenshot|chat|wechat)/i;
const RESUME_STATE_KEY = 'sx_generation_resume_v1';
const RESUME_STATE_TTL_MS = 90 * 60 * 1000;

function shouldProcessTables(text: string): boolean {
  return TABLE_INTENT_RE.test(text || '');
}

function detectMaterialKind(file: UploadedFile): MaterialKind {
  const name = (file.name || '').toLowerCase();
  const type = (file.type || '').toLowerCase();
  const isImage = type.startsWith('image/') || /\.(png|jpe?g|webp)$/.test(name);
  if (isImage && CHAT_SCREENSHOT_RE.test(file.name || '')) return 'chat-screenshot';
  if (/\.(docx?|pdf)$/.test(name)) return 'document';
  if (/\.(pptx?|key)$/.test(name)) return 'ppt-draft';
  if (/\.(xlsx?|csv)$/.test(name)) return 'table';
  if (isImage) return 'image';
  return 'other';
}

function materialPriority(kind: MaterialKind): number {
  switch (kind) {
    case 'chat-screenshot':
      return 0;
    case 'document':
      return 1;
    case 'ppt-draft':
      return 2;
    case 'table':
      return 3;
    case 'image':
      return 4;
    default:
      return 5;
  }
}

function toGammaImageSource(value?: string): GammaImageSource {
  switch ((value || '').trim()) {
    case 'none':
    case 'noImages':
      return 'noImages';
    case 'web':
    case 'pexels':
    case 'webFreeToUseCommercially':
      return 'pexels';
    case 'ai':
    case 'ai-pro':
    case 'aiGenerated':
      return 'aiGenerated';
    case 'theme':
    case 'theme-img':
    case 'themeAccent':
    case 'pictographic':
    default:
      return 'themeAccent';
  }
}

function gammaSourceToAppMode(source?: string): string {
  switch (toGammaImageSource(source)) {
    case 'pexels':
      return 'web';
    case 'aiGenerated':
      return 'ai';
    case 'noImages':
      return 'noImages';
    case 'themeAccent':
    default:
      return 'theme-img';
  }
}

function getAiModelFromImageMode(params: {
  modeValue?: string;
  tone?: string;
  textMode?: 'generate' | 'condense' | 'preserve';
  userPlanType?: string;
}): string | undefined {
  const { modeValue, tone, textMode, userPlanType } = params;
  if (modeValue === 'ai-pro') return 'imagen-3-pro';
  if (modeValue !== 'ai') return undefined;

  const plan = getPlan(userPlanType || 'free');
  const candidates = plan.allowedAiModels || [];
  if (candidates.length === 0) return undefined;

  // 按用途智能选模型（仅在可用模型中路由）
  const prefer =
    textMode === 'condense'
      ? 'gemini-2.5-flash-image'
      : tone === 'creative'
        ? 'flux-1-pro'
        : tone === 'traditional'
          ? 'ideogram-v3'
          : tone === 'bold'
            ? 'imagen-3-pro'
            : 'imagen-3-flash';

  if (candidates.includes(prefer)) return prefer;
  if (candidates.includes('imagen-3-flash')) return 'imagen-3-flash';
  return candidates[0];
}

function buildClientImageOptions(source: GammaImageSource, aiModel?: string): Record<string, string> {
  if (source !== 'aiGenerated') return { source };
  return {
    source,
    model: aiModel || 'imagen-3-flash',
    style: aiModel === 'imagen-3-pro'
      ? 'professional, high quality, cinematic, detailed'
      : 'flat illustration, minimalist, clean background, negative space',
  };
}

function buildRenderSignature(
  slides: SlideItem[],
  mode: 'direct' | 'smart',
  themeId: string,
  tone: string,
  imageSource: GammaImageSource,
  textMode: 'generate' | 'condense' | 'preserve'
): string {
  const normalizedSlides = slides.map((s) => ({
    title: s.title || '',
    content: Array.isArray(s.content) ? s.content : [],
  }));
  return JSON.stringify({
    mode,
    themeId,
    tone,
    imageSource,
    textMode,
    slides: normalizedSlides,
  });
}

function buildAttachmentContext(file: UploadedFile): string {
  const sizeMb = (file.size / 1024 / 1024).toFixed(2);
  const kind = detectMaterialKind(file);
  const kindLabel: Record<MaterialKind, string> = {
    'chat-screenshot': '聊天截图',
    document: '文档资料',
    'ppt-draft': 'PPT草稿',
    table: '表格数据',
    image: '图片素材',
    other: '附件素材',
  };
  return [
    `[附件:${file.name}]`,
    `素材类型：${kindLabel[kind]}`,
    `类型：${file.type || 'application/octet-stream'}`,
    `大小：${sizeMb}MB`,
    '说明：用户已上传此附件作为素材。请结合用户输入的需求描述、附件标题和上下文生成；不要编造附件中未明确提供的具体事实，如需要引用附件正文，请保留“附件内容待补充”的位置。',
  ].join('\n');
}

function toTextModeLabel(mode?: string): string {
  const labels: Record<string, string> = {
    generate: '扩充文本',
    condense: '总结提炼',
    preserve: '保持原样',
  };
  return labels[mode || ''] || (mode || '保持原样');
}

type OutlineStageKey = 'analyzing' | 'planning' | 'generating' | 'polishing';

const OUTLINE_STAGE_META: Record<OutlineStageKey, { label: string; title: string; hint: string; icon: string }> = {
  analyzing: { label: '分析需求', title: '正在理解输入与附件', hint: '识别题目、页数、重点表达与语气', icon: 'M4 11h16M4 6h16M4 16h9' },
  planning: { label: '规划结构', title: '正在规划章节与故事线', hint: '确定章节顺序、节奏和逻辑层级', icon: 'M6 4h12v16H6zM9 8h6M9 12h6' },
  generating: { label: '生成大纲', title: '正在逐页生成大纲要点', hint: '持续写入标题、要点与说明', icon: 'M5 5h14v14H5zM8 9h8M8 13h5' },
  polishing: { label: '细节优化', title: '正在做最终结构校验', hint: '统一术语、压缩冗余并提升可讲述性', icon: 'M12 3l2.6 5.2L20 9l-4 3.9.9 5.6L12 16l-4.9 2.5.9-5.6L3 9l5.4-.8z' },
};

function resolveOutlineStage(stepText: string, slideCount: number, targetCount: number): OutlineStageKey {
  const normalized = (stepText || '').toLowerCase();
  if (normalized.includes('识别') || normalized.includes('分析')) return 'analyzing';
  if (normalized.includes('规划') || normalized.includes('结构')) return 'planning';
  if (normalized.includes('校验') || normalized.includes('优化')) return 'polishing';
  if (slideCount >= Math.max(1, targetCount - 1)) return 'polishing';
  if (slideCount > 0) return 'generating';
  return 'planning';
}

function isTransientLoadFailError(message?: string): boolean {
  const normalized = String(message || '').toLowerCase();
  if (!normalized) return false;
  return /load[\s_-]*fail|failed to load|loading failed|network|timeout|timed out|temporar|temporary|502|503|504|gateway|连接失败|加载失败/.test(normalized);
}

function buildPreviewApiPath(
  generationId: string,
  format: 'pdf' | 'pptx',
  filename: string,
  inline = true
): string {
  const params = new URLSearchParams({
    generationId,
    format,
    name: filename,
    inline: inline ? '1' : '0',
  });
  return `/api/preview/file?${params.toString()}`;
}

function readResumeState(): PersistedGenerationState | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.sessionStorage.getItem(RESUME_STATE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as PersistedGenerationState;
    if (!parsed || parsed.version !== 1) return null;
    if (!parsed.updatedAt || Date.now() - parsed.updatedAt > RESUME_STATE_TTL_MS) return null;
    return parsed;
  } catch {
    return null;
  }
}

function writeResumeState(state: PersistedGenerationState) {
  if (typeof window === 'undefined') return;
  try {
    window.sessionStorage.setItem(RESUME_STATE_KEY, JSON.stringify(state));
  } catch (e) {
    console.warn('[Resume] 持久化失败:', e);
  }
}

function clearResumeStateStorage() {
  if (typeof window === 'undefined') return;
  try {
    window.sessionStorage.removeItem(RESUME_STATE_KEY);
  } catch {
    // ignore
  }
}

// buildMd 已替换为 buildMdV2（lib/build-md-v2.ts）
// 在 confirmAndGenerate 中直接传 slides 给 /api/gamma

// 🚨 v10.5: 处理 ?subscribe= 查询参数打开支付弹窗
// 注意：useSearchParams 需要 Suspense 边界
function SubscribeHandler({ onSubscribe }: { onSubscribe: (planId: string) => void }) {
  const searchParams = useSearchParams();
  const router = useRouter();
  
  useEffect(() => {
    const plan = searchParams.get('subscribe');
    if (plan && ['shengxin', 'advanced', 'basic', 'standard', 'pro', 'vip', 'supreme'].includes(plan)) {
      onSubscribe(plan);
      // 清除URL参数
      router.replace('/');
    }
  }, [searchParams, onSubscribe, router]);
  
  return null;
}

// 包装 SubscribeHandler 以提供 Suspense 边界
function SubscribeHandlerWrapper({ onSubscribe }: { onSubscribe: (planId: string) => void }) {
  return (
    <Suspense fallback={null}>
      <SubscribeHandler onSubscribe={onSubscribe} />
    </Suspense>
  );
}

export default function Home() {
  const { user, showLogin, showPayment, paymentPlan, openPayment, openLogin, closeLogin, closePayment, updateCredits } = useAuth();
  const router = useRouter();

  // Dual-track mode
  const [mode, setMode] = useState<'direct' | 'smart'>('direct');
  const [directTheme, setDirectTheme] = useState('finesse');
  const [directTone, setDirectTone] = useState('professional');
  const [directImgMode, setDirectImgMode] = useState('theme-img');
  const [directTextMode, setDirectTextMode] = useState<'generate' | 'condense' | 'preserve'>('generate');

  // Landing page vs generate flow
  const [phase, setPhase] = useState<'landing' | 'input' | 'streaming' | 'outline' | 'generating' | 'result'>('input');

  // Input state
  const [topic, setTopic] = useState('');
  const [files, setFiles] = useState<UploadedFile[]>([]);

  // Pro mode
  const [showPro, setShowPro] = useState(false);
  const [showDirectAdvanced, setShowDirectAdvanced] = useState(false);
  const [showPagePicker, setShowPagePicker] = useState(false);

  const [genMode, setGenMode] = useState('preserve');
  const [theme, setTheme] = useState('auto');
  const [tone, setTone] = useState('professional');
  const [imgMode, setImgMode] = useState('theme-img');
  const [smartThemeTouched, setSmartThemeTouched] = useState(false);
  const [smartToneTouched, setSmartToneTouched] = useState(false);
  const [smartImageTouched, setSmartImageTouched] = useState(false);
  // 🚨 D1: Renamed pages → pageCount for canonical field consistency
  const [pageCount, setPageCount] = useState(8);
  const [customPageInput, setCustomPageInput] = useState('8');

  // Generation state
  const [loading, setLoading] = useState(false);

  const [showThemePicker, setShowThemePicker] = useState(false);
  const [error, setError] = useState('');
  const [stepText, setStepText] = useState('');
  const [genProgress, setGenProgress] = useState(0);
  const [genStep, setGenStep] = useState(0);
  const [outlineDisplayProgress, setOutlineDisplayProgress] = useState(10);
  const outlineStageEnteredAtRef = useRef<number>(Date.now());
  const outlineStageRef = useRef<OutlineStageKey>('analyzing');

  // Outline & 省心模式 Payload
  const [outlineResult, setOutlineResult] = useState<OutlineResultState | null>(null);
  const [smartGammaPayload, setSmartGammaPayload] = useState<any>(null); // 省心模式 AI 生成的完整参数
  const [editedSlides, setEditedSlides] = useState<SlideItem[]>([]);
  const [originalSlides, setOriginalSlides] = useState<SlideItem[]>([]); // 🚨 存储原始大纲（用于检测是否编辑）
  const [outlinePreprocess, setOutlinePreprocess] = useState<OutlinePreprocessInfo | null>(null);
  const [smartAutoGeneratePending, setSmartAutoGeneratePending] = useState(false);
  const [strictPreserve, setStrictPreserve] = useState(true);
  const [forceRequestedModeOnce, setForceRequestedModeOnce] = useState(false);
  const pagePickerRef = useRef<HTMLDivElement | null>(null);
  const pagePickerListRef = useRef<HTMLDivElement | null>(null);
  // 🚨 D3 Fix Q4: 使用 ref 同步 editedSlides，防止 confirmAndGenerate 闭包读取陈旧值
  const editedSlidesRef = useRef<SlideItem[]>(editedSlides);
  useEffect(() => { editedSlidesRef.current = editedSlides; }, [editedSlides]);
  const [streamingSlides, setStreamingSlides] = useState<SlideItem[]>([]);

  useEffect(() => {
    if (!showPagePicker) return;
    const onPointerDown = (event: MouseEvent) => {
      if (!pagePickerRef.current) return;
      if (!pagePickerRef.current.contains(event.target as Node)) {
        setShowPagePicker(false);
      }
    };
    document.addEventListener('mousedown', onPointerDown);
    return () => document.removeEventListener('mousedown', onPointerDown);
  }, [showPagePicker]);

  useEffect(() => {
    if (!showPagePicker || !pagePickerListRef.current) return;
    const selected = pagePickerListRef.current.querySelector(`[data-page-option="${pageCount}"]`) as HTMLElement | null;
    selected?.scrollIntoView({ block: 'center', behavior: 'smooth' });
  }, [showPagePicker, pageCount]);

  // Drag-and-drop state for outline reordering
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

  // Result
  const [result, setResult] = useState<{
    title: string;
    slides: SlideItem[];
    pptxUrl: string;
    gammaUrl?: string;
    actualPages?: number;
    generationId?: string;
    renderSignature?: string;
  } | null>(null);
  const [exporting, setExporting] = useState(false); // 导出中
  const [exportingPdf, setExportingPdf] = useState(false);
  const [payingOnce, setPayingOnce] = useState(false);
  const [payPerDownload, setPayPerDownload] = useState<{ pageCount: number; cost: number } | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState('');
  const [previewPdfUrl, setPreviewPdfUrl] = useState('');
  const [previewPdfFetchUrl, setPreviewPdfFetchUrl] = useState('');

  const fileRef = useRef<HTMLInputElement>(null);
  const topicInputRef = useRef<HTMLTextAreaElement>(null);
  const previewLoadedGenerationRef = useRef('');
  const previewBlobUrlRef = useRef<string>('');
  const restoringResumeRef = useRef(false);
  const triedResumeRef = useRef(false);
  const navigatingAwayRef = useRef(false);

  const getTopicValue = useCallback(() => {
    const domValue = topicInputRef.current?.value;
    if (typeof domValue === 'string' && domValue.length > 0) return domValue;
    return topic;
  }, [topic]);

  const collectText = useCallback(() => {
    const p: string[] = [];
    const currentTopic = getTopicValue();
    const includeTables = shouldProcessTables(currentTopic);
    const orderedFiles = [...files].sort(
      (a, b) => materialPriority(detectMaterialKind(a)) - materialPriority(detectMaterialKind(b))
    );

    for (const f of orderedFiles) {
      const kind = detectMaterialKind(f);
      if (kind === 'table' && !includeTables) {
        p.push([
          buildAttachmentContext(f),
          '说明：检测到当前需求未明确要求处理表格，已默认跳过表格明细文本，仅保留表格文件元信息。',
          '如需展开表格内容，请在需求中明确写明“处理表格数据”。',
        ].join('\n'));
        continue;
      }

      const rawContent = (f.content || '').trim();
      if (!rawContent) {
        p.push(buildAttachmentContext(f));
        continue;
      }

      const capped = rawContent.length > LIMITS.MAX_EXTRACTED_CHARS_PER_FILE
        ? `${rawContent.slice(0, LIMITS.MAX_EXTRACTED_CHARS_PER_FILE)}\n\n[...附件内容已截断...]`
        : rawContent;

      if (capped.startsWith('[附件:')) {
        p.push(capped);
      } else {
        p.push(`[附件:${f.name}]\n${capped}`);
      }
    }

    if (currentTopic.trim()) p.push(currentTopic.trim());
    return p.join('\n\n');
  }, [files, getTopicValue]);

  const clearPersistedResumeState = useCallback(() => {
    clearResumeStateStorage();
  }, []);

  const isLikelyNavigatingAway = useCallback(() => {
    if (navigatingAwayRef.current) return true;
    if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return true;
    return false;
  }, []);

  const persistOutlineResumeState = useCallback((payload: OutlinePayload, currentMode: 'direct' | 'smart') => {
    writeResumeState({
      version: 1,
      stage: 'outline',
      userId: user?.id,
      updatedAt: Date.now(),
      startedAt: Date.now(),
      mode: currentMode,
      outline: { payload },
    });
  }, [user?.id]);

  const persistGammaResumeState = useCallback((state: {
    generationId: string;
    title: string;
    slides: SlideItem[];
    renderSignature: string;
    mode: 'direct' | 'smart';
  }) => {
    writeResumeState({
      version: 1,
      stage: 'gamma',
      userId: user?.id,
      updatedAt: Date.now(),
      startedAt: Date.now(),
      mode: state.mode,
      gamma: {
        generationId: state.generationId,
        title: state.title,
        slides: state.slides,
        renderSignature: state.renderSignature,
      },
    });
  }, [user?.id]);

  const touchPersistedResumeState = useCallback(() => {
    const current = readResumeState();
    if (!current) return;
    writeResumeState({
      ...current,
      updatedAt: Date.now(),
    });
  }, []);

  const resetPreviewState = useCallback(() => {
    setPreviewLoading(false);
    setPreviewError('');
    setPreviewPdfUrl('');
    setPreviewPdfFetchUrl('');
  }, []);

  // 🚨 V6新增：积分回滚工具（生成失败/超时时调用）
  const rollbackCredits = useCallback(async (credits: number, reason: string) => {
    if (!user || credits <= 0) return;
    try {
      const res = await fetch('/api/user', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${user.id}`,
        },
        body: JSON.stringify({ action: 'rollback', userId: user.id, credits, reason }),
      });
      if (res.ok) {
        const data = await res.json();
        updateCredits(data.balance);
        console.log(`[Rollback] 返还${credits}积分成功，余额：${data.balance}`);
      }
    } catch (e) {
      console.error('[Rollback] 积分回滚失败:', e);
    }
  }, [user, updateCredits]);

  const hasInput = files.length > 0 || getTopicValue().trim().length > 0;
  const planMaxPages = Math.min(40, getPlan(user?.plan_type || 'free').maxPages);
  const pickerMaxPages = 40;
  const pageOptions = useMemo(
    () => Array.from({ length: Math.max(0, pickerMaxPages - 2) }, (_, idx) => idx + 3),
    [pickerMaxPages]
  );
  const outlineTargetPages = Math.max(1, outlineResult?.slides?.length || pageCount);
  const outlineGeneratedPages = streamingSlides.length;
  const outlineStage = resolveOutlineStage(stepText, outlineGeneratedPages, outlineTargetPages);
  const outlineProgressTarget = Math.min(
    97,
    Math.max(
      10,
      Math.round((outlineGeneratedPages / outlineTargetPages) * 72) + (outlineStage === 'analyzing' ? 8 : outlineStage === 'planning' ? 18 : outlineStage === 'generating' ? 28 : 40)
    )
  );
  const previewTotalPages = Math.max(1, Number(result?.actualPages || 0) || editedSlides.length || pageCount || 1);

  // 生成结果页保留站内在线预览与 PPTX 下载

  useEffect(() => {
    setCustomPageInput(String(pageCount));
  }, [pageCount]);

  const applyPageCountChange = useCallback((rawValue: number) => {
    if (!Number.isFinite(rawValue)) return false;
    const normalizedValue = Math.round(rawValue);
    const boundedValue = Math.max(3, Math.min(40, normalizedValue));
    const maxP = Math.min(40, getPlan(user?.plan_type || 'free').maxPages);
    if (boundedValue > maxP) {
      const requiredPlanId = boundedValue <= 20 ? 'shengxin' : 'advanced';
      const planInfo = getPlan(requiredPlanId);
      openPayment({
        id: planInfo.id,
        name: `${planInfo.name} · ${planInfo.emoji}`,
        price: `¥${planInfo.priceMonthly}/月`,
        billing: 'monthly',
        reason: `${boundedValue}页为${planInfo.name}专享能力。当前套餐支持至${maxP}页，开通后可提升到${planInfo.maxPages}页。`,
      });
      return false;
    }
    setPageCount(boundedValue);
    return true;
  }, [user?.plan_type, openPayment]);

  // Enter generate flow
  const startGenerate = useCallback(() => {
    if (!user) return;
    setMode('direct');
    setPhase('input');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [user]);

  // 🆕 Landing mode selection handler
  const handleModeSelect = useCallback((m: 'direct' | 'smart', prefill?: string) => {
    if (!user) { openLogin(); return; }
    setMode(m);
    if (prefill) setTopic(prefill);
    setPhase('input');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [user, openLogin]);

  // 🆕 Hot scene click handler
  const handleSceneClick = useCallback((text: string) => {
    if (!user) { openLogin(); return; }
    setTopic(text);
    setMode('direct');
    setPhase('input');
  }, [user, openLogin]);

  const runOutlineRequest = useCallback(async (outlinePayload: OutlinePayload) => {
    const runOnce = async () => {
      const outlineController = new AbortController();
      const outlineTimeout = setTimeout(() => outlineController.abort(), 180000); // 3分钟超时
      let od: any = null;
      try {
        const streamRes = await fetch('/api/outline/stream', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(outlinePayload),
          signal: outlineController.signal,
        });

        if (!streamRes.ok || !streamRes.body) {
          throw new Error('STREAM_FALLBACK');
        }

        const reader = streamRes.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });

          let newlineIdx = buffer.indexOf('\n');
          while (newlineIdx >= 0) {
            const line = buffer.slice(0, newlineIdx).trim();
            buffer = buffer.slice(newlineIdx + 1);
            newlineIdx = buffer.indexOf('\n');

            if (!line) continue;

            let evt: any;
            try {
              evt = JSON.parse(line);
            } catch {
              continue;
            }

            if (evt.type === 'stage') {
              const fallbackMsgByStage: Record<string, string> = {
                analyzing: '正在识别用户需求与素材结构...',
                planning: '正在规划故事线与章节结构...',
                generating: '正在生成每页标题与要点...',
                polishing: '正在做最终校验...',
              };
              const stageMsg = evt.message || fallbackMsgByStage[evt.stage] || '正在处理中...';
              if (evt.stage === 'analyzing') {
                setGenProgress(20);
              } else if (evt.stage === 'planning') {
                setGenProgress(30);
              } else if (evt.stage === 'generating') {
                setGenProgress(45);
              } else if (evt.stage === 'polishing') {
                setGenProgress(58);
              }
              setStepText(stageMsg);
              touchPersistedResumeState();
              continue;
            }

            if (evt.type === 'slides' && Array.isArray(evt.slides)) {
              setStreamingSlides(evt.slides);
              const total = Math.max(1, Number(evt.total) || evt.slides.length || 1);
              const current = Math.min(total, Math.max(0, Number(evt.current) || evt.slides.length || 0));
              const stageProgress = 60 + Math.round((current / total) * 25);
              setGenProgress(stageProgress);
              setStepText(`已生成 ${current}/${total} 页大纲...`);
              touchPersistedResumeState();
              continue;
            }

            if (evt.type === 'error') {
              throw new Error(evt.message || '大纲生成失败');
            }

            if (evt.type === 'complete' && evt.data) {
              od = evt.data;
            }
          }
        }

        if (!od) {
          throw new Error('大纲流式响应中断，请重试');
        }
        return od;
      } catch (fetchErr: any) {
        if (fetchErr?.message === 'STREAM_FALLBACK') {
          const oRes = await fetch('/api/outline', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(outlinePayload),
            signal: outlineController.signal,
          });
          const oText = await oRes.text();
          if (!oRes.ok) {
            let errMsg = '大纲生成失败';
            try { const d = JSON.parse(oText); errMsg = d.error || errMsg; } catch {}
            throw new Error(errMsg);
          }
          try {
            return JSON.parse(oText);
          } catch {
            throw new Error('大纲响应格式错误，请重试');
          }
        }
        if (fetchErr.name === 'AbortError') {
          throw new Error('大纲生成超时（3分钟），请稍后重试或改用“提炼”模式');
        }
        throw new Error(fetchErr?.message || '网络错误，请检查网络连接后重试');
      } finally {
        clearTimeout(outlineTimeout);
      }
    };

    const maxAttempts = 2;
    let lastErr: Error | null = null;
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        return await runOnce();
      } catch (err: any) {
        const msg = err?.message || '大纲生成失败';
        lastErr = err instanceof Error ? err : new Error(msg);
        const canRetry = attempt < maxAttempts && isTransientLoadFailError(msg);
        if (!canRetry) throw lastErr;
        setStepText(`大纲服务短暂波动，正在自动重试（${attempt + 1}/${maxAttempts}）...`);
        setGenProgress((prev) => Math.max(prev, 26));
        await new Promise((resolve) => setTimeout(resolve, 900 * attempt));
      }
    }
    throw lastErr || new Error('大纲生成失败');
  }, [touchPersistedResumeState]);

  // 🚨 V6 标准化：所有模式统一走 outline API → 大纲确认 → Gamma
  const generateOutline = useCallback(async (options?: { forceRequestedMode?: boolean }) => {
    const currentTopic = getTopicValue();
    const inputText = collectText();
    if (!inputText.trim()) { setLoading(false); return; }
    if (!user) { setLoading(false); openLogin(); return; }

    // 🚨 总字数校验：超过上限时提示精简
    if (inputText.length > LIMITS.MAX_TEXT_LENGTH) {
      setLoading(false);
      setPhase('input');
      setError(`内容过长（${inputText.length}字），请精简到 ${LIMITS.MAX_TEXT_LENGTH} 字以内，或分段处理。`);
      return;
    }

    // V7 输入校验
    const validation = validateInput(currentTopic, files);
    if (!validation.valid) {
      setLoading(false);
      setPhase('input');
      setError(validation.errors[0]);
      return;
    }

    setLoading(true);
    setError('');
    setPhase('streaming');
    navigatingAwayRef.current = false;
    setGenStep(0);
    setGenProgress(10);
    setStepText('AI 正在分析你的需求...');

    try {
      // ====== V7 统一流程：所有模式走 outline → 编辑 → 生成 ======
      // · 专业模式扩充 (genMode='generate') → textMode='generate'
      // · 专业模式缩减 (genMode='condense') → textMode='condense'
      // · 专业模式保持 (genMode='preserve') → textMode='preserve'
      // · 省心定制 (mode='smart')           → textMode='preserve' + auto=true
      // 专业模式使用 directTextMode；
      // 省心模式默认 preserve + auto，若用户在高级参数中主动选了生成策略，则尊重用户选择并关闭 auto。
      const smartSelectedMode = (GEN_MODES_MAP[genMode] || 'preserve') as 'generate' | 'condense' | 'preserve';
      const textMode: string = mode === 'direct' ? directTextMode : smartSelectedMode;
      const auto = mode === 'smart';

      // 省心模式：从用户输入中提取页数（如"6页"、"6 页"、"6"）
      let effectivePages = pageCount;
      if (mode === 'smart') {
        const pageMatch = inputText.match(/(\d+)\s*页/);
        if (pageMatch) {
          const extractedPages = parseInt(pageMatch[1], 10);
          if (extractedPages >= 3 && extractedPages <= 40) {
            effectivePages = extractedPages;
            setPageCount(extractedPages);
            console.log('[SmartMode] 从输入中提取页数:', extractedPages);
          }
        }
      }

      // Step 1: 调用 outline API（所有模式统一入口）
      await new Promise(r => setTimeout(r, 800));
      setGenStep(1);
      setGenProgress(30);
      setStepText('AI 正在生成大纲...');

      const outlinePayload: OutlinePayload = {
        inputText,
        uploadedFiles: files.map(({ name, type, size, passthrough }) => ({ name, type, size, passthrough: Boolean(passthrough) })),
        slideCount: effectivePages,
        textMode,
        auto,
        strictPreserve: Boolean(strictPreserve),
        forceRequestedMode: Boolean(options?.forceRequestedMode),
        // 省心模式下：仅当用户主动修改高级选项时才透传，避免默认值覆盖用户文本需求
        themeId: mode === 'smart' ? ((smartThemeTouched && theme !== 'auto') ? theme : '') : directTheme,
        tone: mode === 'smart' ? (smartToneTouched ? tone : '') : directTone,
        imageMode: mode === 'smart' ? (smartImageTouched ? imgMode : '') : directImgMode,
      };
      persistOutlineResumeState(outlinePayload, mode);
      const od = await runOutlineRequest(outlinePayload);

      // Step 2: 专业模式进入大纲确认页 | 省心模式自动确认并直出
      setGenProgress(60);
      setStreamingSlides(od.slides || []);
      await new Promise(r => setTimeout(r, od.slides.length * 300 + 500));

      setOutlineResult(od);
      setEditedSlides(od.slides || []);
      setOriginalSlides(od.slides || []); // 🚨 保存原始大纲，用于检测用户是否编辑
      setOutlinePreprocess(od?.meta?.preprocess || null);

      if (mode === 'smart') {
        // 省心模式：设置参数后自动确认大纲并直接生成
        const gammaImageSource = toGammaImageSource(od.imageMode || imgMode);
        setSmartGammaPayload({
          // 省心模式默认紫蓝系，避免回退到商务蓝
          themeId: od.themeId || 'consultant',
          tone: od.tone || 'professional',
          imageOptions: { source: gammaImageSource },
        });
        const reverseImageModeMap: Record<string, string> = {
          'themeAccent': 'theme-img',
          'pexels': 'web',
          'aiGenerated': 'ai',
          'noImages': 'noImages',
        };
        setImgMode(reverseImageModeMap[gammaImageSource] || 'theme-img');
        setSmartAutoGeneratePending(true);
        setPhase('generating');
        setGenProgress(66);
        setStepText('省心模式已自动确认大纲，正在生成PPT...');
        clearPersistedResumeState();
      } else {
        // 🚨 v10.7.1: 专业模式也进入大纲编辑页面
        // 同步 imgMode 状态，确保 confirmAndGenerate 使用正确的值
        const gammaImageSource = toGammaImageSource(directImgMode);
        setImgMode(directImgMode);
        setSmartGammaPayload({
          themeId: directTheme !== 'default-light' ? directTheme : (od.themeId || 'finesse'),
          tone: directTone,
          imageOptions: { source: gammaImageSource },
        });
        setPhase('outline');
        setGenProgress(100);
        clearPersistedResumeState();
      }
    } catch (e: any) {
      if (!isLikelyNavigatingAway()) {
        setError(e.message);
        setPhase('input');
        clearPersistedResumeState();
      }
    }
    setLoading(false);
  }, [
    user,
    files,
    getTopicValue,
    pageCount,
    collectText,
    mode,
    genMode,
    theme,
    tone,
    imgMode,
    smartThemeTouched,
    smartToneTouched,
    smartImageTouched,
    strictPreserve,
    directTextMode,
    directImgMode,
    directTheme,
    directTone,
    openLogin,
    persistOutlineResumeState,
    runOutlineRequest,
    clearPersistedResumeState,
    isLikelyNavigatingAway,
  ]);

  // 🚨 V6 简化：省心模式入口（权限检查 + 调用统一流程）
  // 专业模式：outline → 大纲编辑 → 生成；省心模式：outline → 自动生成
  const handleGeneratePPT = useCallback(() => {
    if (!user) { openLogin(); return; }
    if (!hasInput) return;
    setLoading(true);
    setError('');
    setForceRequestedModeOnce(false);
    setGenStep(0);
    setGenProgress(5);
    setStepText('正在准备生成...');

    setPhase('streaming');
    generateOutline();
  }, [user, hasInput, generateOutline]);

  const rerunOutlineWithPreserve = useCallback(() => {
    setGenMode('preserve');
    setStrictPreserve(true);
    setForceRequestedModeOnce(true);
    setPhase('streaming');
    generateOutline({ forceRequestedMode: true });
  }, [generateOutline]);


  // 🚨 v10.6: 检测用户是否编辑了大纲
  const hasUserEditedSlides = useCallback(() => {
    if (originalSlides.length !== editedSlides.length) return true;
    for (let i = 0; i < originalSlides.length; i++) {
      const orig = originalSlides[i];
      const edit = editedSlides[i];
      if (orig.title !== edit.title) return true;
      if (JSON.stringify(orig.content) !== JSON.stringify(edit.content)) return true;
    }
    return false;
  }, [originalSlides, editedSlides]);

  const waitForGammaCompletion = useCallback(async (generationId: string, timeoutMs = 180000) => {
    const startTime = Date.now();
    const basePollInterval = 3200;
    let consecutiveStatusErrors = 0;
    let retry429Count = 0;

    while (Date.now() - startTime < timeoutMs) {
      let statusRes: Response;
      try {
        statusRes = await fetch(`/api/gamma?id=${generationId}`, { cache: 'no-store' });
      } catch (networkErr: any) {
        consecutiveStatusErrors += 1;
        if (consecutiveStatusErrors >= 4) {
          throw new Error(networkErr?.message || '渲染状态查询失败');
        }
        setStepText('渲染状态加载中断，正在自动重连...');
        await new Promise((r) => setTimeout(r, 1200));
        continue;
      }

      if (statusRes.ok) {
        consecutiveStatusErrors = 0;
        const statusData = await statusRes.json();

        if (statusData.status === 'completed') {
          setGenProgress(90);
          setStepText('PPT 生成完成，准备下载...');
          return statusData;
        }

        if (statusData.status === 'failed') {
          const failureMsg = String(statusData.error || '生成失败');
          if (isTransientLoadFailError(failureMsg)) {
            const transient = new Error(`load-fail-retry:${failureMsg}`);
            throw transient;
          }
          throw new Error(failureMsg);
        }

        const elapsed = Math.floor((Date.now() - startTime) / 1000);
        setGenProgress((prev) => Math.max(prev, Math.min(88, 60 + Math.floor(elapsed / 4))));
        setStepText(`AI 渲染中... ${elapsed}秒（可离开页面，稍后自动恢复）`);
        touchPersistedResumeState();
      } else {
        if (statusRes.status === 429) {
          // 429 说明查询过快，做退避重试，不直接判失败
          retry429Count += 1;
          consecutiveStatusErrors = 0;
          const backoffMs = Math.min(12000, 3500 + retry429Count * 1200);
          setStepText('渲染状态查询较忙，正在自动退避重试...');
          await new Promise((r) => setTimeout(r, backoffMs));
          continue;
        }
        consecutiveStatusErrors += 1;
        if (consecutiveStatusErrors >= 4) {
          throw new Error(`渲染状态查询失败(${statusRes.status})`);
        }
        setStepText(`渲染状态加载波动（${statusRes.status}），正在自动重试...`);
      }
      await new Promise((r) => setTimeout(r, basePollInterval));
    }

    throw new Error('生成超时（3分钟），PPT内容较复杂，请稍后重试');
  }, [touchPersistedResumeState]);

  // Step 2: Confirm and generate PPT
  const confirmAndGenerate = useCallback(async () => {
    if (!outlineResult || !user) return;

    const selectedImageMode = mode === 'smart'
      ? (smartImageTouched
        ? imgMode
        : (smartGammaPayload?.imageOptions?.source || outlineResult.imageMode || imgMode))
      : directImgMode;
    const finalImageSource = toGammaImageSource(selectedImageMode);
    const finalThemeId = mode === 'smart'
      ? ((theme !== 'auto' && smartThemeTouched)
        ? theme
        : (smartGammaPayload?.themeId || (theme !== 'auto' ? theme : outlineResult.themeId) || 'consultant'))
      : (directTheme || outlineResult.themeId || 'finesse');
    const finalTone = mode === 'smart'
      ? (smartToneTouched
        ? tone
        : (smartGammaPayload?.tone || outlineResult.tone || tone || 'professional'))
      : (directTone || 'professional');
    const finalTextMode: 'generate' | 'condense' | 'preserve' = mode === 'smart' ? 'preserve' : directTextMode;
    const finalAiModel = getAiModelFromImageMode({
      modeValue: selectedImageMode,
      tone: finalTone,
      textMode: finalTextMode,
      userPlanType: user?.plan_type,
    });
    const finalImageOptions = buildClientImageOptions(finalImageSource, finalAiModel);
    const slidesForRender = editedSlidesRef.current.length > 0
      ? editedSlidesRef.current
      : ((editedSlides.length > 0 ? editedSlides : outlineResult.slides) || []);
    const renderPageCount = Math.max(1, slidesForRender.length || pageCount || 1);
    const currentRenderSignature = buildRenderSignature(
      slidesForRender,
      mode,
      finalThemeId,
      finalTone,
      finalImageSource,
      finalTextMode
    );
    const strictPreserveEnabled = finalTextMode === 'preserve' && strictPreserve;

    // 🚨 v10.6+: 仅在内容和渲染参数都未变化时复用已有结果
    const userEdited = hasUserEditedSlides();
    if (!userEdited && result?.generationId && result.renderSignature === currentRenderSignature) {
      setPhase('result');
      return;
    }

    // 🔐 会员权限检查
    const numPages = renderPageCount;
    const perm = checkPermission(user.plan_type || 'free', {
      numPages,
      imageSource: finalImageSource,
      aiModel: finalAiModel,
      mode: mode === 'smart' ? 'smart' : 'direct',
    });
    if (!perm.allowed) {
      setError(perm.reason || '当前套餐权限不足');
      const reqPlan = perm.requiredPlan || 'shengxin';
      const planInfo = getPlan(reqPlan);
      openPayment({
        id: reqPlan,
        name: `${planInfo.name} · ${planInfo.emoji}`,
        price: planInfo.priceMonthly > 0 ? `¥${planInfo.priceMonthly}/月` : '免费',
        billing: 'monthly',
        reason: perm.reason,
      });
      return;
    }

    setLoading(true);
    navigatingAwayRef.current = false;
    setError('');
    setPhase('generating');
    setGenStep(0);
    setGenProgress(0);
    setStepText('AI 正在准备渲染...');

    // 回滚金额以后端实际扣减为准，避免前后端规则漂移导致回滚不准确
    let deductedCredits = 0;

    try {
      const tm = finalTextMode;

      // Step 0: Deduct credits
      setGenStep(0);
      setGenProgress(10);
      const deductRes = await fetch('/api/user', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${user.id}`,
        },
        body: JSON.stringify({
          action: 'deduct',
          userId: user.id,
          numPages: renderPageCount,
          imageSource: finalImageSource,
          imageModel: finalAiModel,
        }),
      });
      const deductData = await deductRes.json();
      if (!deductRes.ok || deductData.error) {
        if (deductData.error === '积分不足') {
          // Open payment modal instead of throwing error
          setLoading(false);
          setPhase('outline');
          openPayment({
            id: 'shengxin',
            name: '积分不足，请充值',
            price: '¥19.9/月',
            billing: 'monthly',
            reason: '积分不足，无法生成PPT',
            neededCredits: deductData.needed,
            currentCredits: deductData.balance,
          });
          return;
        }
        throw new Error(deductData.error || '积分扣除失败');
      }
      deductedCredits = Number(deductData.creditsUsed || 0);
      updateCredits(deductData.balance);

      // Step 1: Prepare
      setGenStep(1);
      setGenProgress(25);
      setStepText('AI 正在优化内容...');
      await new Promise(r => setTimeout(r, 600));

      // Step 2: Generate
      setGenStep(2);
      setGenProgress(40);
      setStepText('AI 正在渲染 PPT 页面...');

      const imgSrc = finalImageSource;
      const { markdown: md, visualMetaphor } = buildMdV2(outlineResult.title, slidesForRender, imgSrc, false, {
        strictPreserve: strictPreserveEnabled,
      });
      if (!md.trim()) {
        throw new Error('大纲内容为空，请返回重新生成大纲');
      }
      // 🚨 V10.4: 传 originalTextMode 让 gamma/route.ts 选择对应渲染指令
      const gammaRequestBody: any = {
        inputText: md,
        textMode: tm,
        auto: mode === 'smart',
        strictPreserve: strictPreserveEnabled,
        format: 'presentation',
        numCards: renderPageCount,
        exportAs: 'pdf',
        themeId: finalThemeId,
        scene: outlineResult.scene || outlineResult.meta?.scene || undefined,
        tone: finalTone,
        imageMode: finalImageSource,
        imageOptions: finalImageOptions,
        visualMetaphor,
        intentHints: outlineResult.meta?.intent,
        uploadedFiles: files.map(({ name, type, size, passthrough }) => ({ name, type, size, passthrough: Boolean(passthrough) })),
        originalTextMode: mode === 'direct' ? directTextMode : undefined,
      };
      const startGammaRender = async () => {
        const gRes = await fetch('/api/gamma', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(gammaRequestBody),
        });
        const gText = await gRes.text();
        if (!gRes.ok) {
          let errMsg = `生成失败(${gRes.status})`; try { const d = JSON.parse(gText); errMsg = d.error || errMsg; } catch {}
          throw new Error(errMsg);
        }
        let gd;
        try { gd = JSON.parse(gText); } catch { throw new Error('生成服务响应格式异常，请重试'); }
        if (!gd?.generationId) {
          throw new Error('生成任务未返回有效ID，请重试');
        }

        setGenStep(2);
        setGenProgress(60);
        setStepText('正在等待 AI 渲染 PPT（可离开页面）...');
        persistGammaResumeState({
          generationId: gd.generationId,
          title: outlineResult.title,
          slides: slidesForRender,
          renderSignature: currentRenderSignature,
          mode,
        });

        const lastStatusData = await waitForGammaCompletion(gd.generationId);
        const finalExportUrl = lastStatusData.exportUrl || '';
        if (!finalExportUrl && !lastStatusData?.gammaUrl) {
          throw new Error('生成超时（3分钟），PPT内容较复杂，请稍后重试');
        }
        return { gd, lastStatusData, finalExportUrl };
      };

      const maxRenderAttempts = 2;
      let renderResult: { gd: any; lastStatusData: any; finalExportUrl: string } | null = null;
      let lastRenderError: Error | null = null;
      for (let attempt = 1; attempt <= maxRenderAttempts; attempt++) {
        try {
          if (attempt > 1) {
            setStepText(`检测到渲染加载波动，正在自动重试（${attempt}/${maxRenderAttempts}）...`);
            setGenProgress((prev) => Math.max(prev, 55));
          }
          renderResult = await startGammaRender();
          break;
        } catch (renderErr: any) {
          const msg = renderErr?.message || '渲染失败';
          lastRenderError = renderErr instanceof Error ? renderErr : new Error(msg);
          const canRetry = attempt < maxRenderAttempts && isTransientLoadFailError(msg);
          if (!canRetry) throw lastRenderError;
          await new Promise((resolve) => setTimeout(resolve, 1200 * attempt));
        }
      }
      if (!renderResult) {
        throw lastRenderError || new Error('渲染失败，请稍后重试');
      }

      await new Promise(r => setTimeout(r, 500));
      setResult({
        title: outlineResult.title,
        slides: slidesForRender,
        pptxUrl: renderResult.finalExportUrl,
        gammaUrl: renderResult.lastStatusData?.gammaUrl || '',
        actualPages: renderPageCount,
        generationId: renderResult.gd.generationId,
        renderSignature: currentRenderSignature,
      });
      setGenProgress(100);
      setPhase('result');
      clearPersistedResumeState();

      // 🆕 保存生成历史
      try {
        await fetch('/api/history', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${user.id}`,
          },
          body: JSON.stringify({ action: 'save', title: outlineResult.title, slides: slidesForRender, themeId: finalThemeId, downloadUrl: renderResult.finalExportUrl, pageCount: renderPageCount, imageMode: imgSrc }),
        });
      } catch (e) { console.warn('[History] 保存失败:', e); }
    } catch (e: any) {
      if (!isLikelyNavigatingAway()) {
        // 仅回滚本次真实已扣减的积分
        if (deductedCredits > 0) {
          rollbackCredits(deductedCredits, e.message || '生成失败');
        }
        setError(e.message);
        setPhase(mode === 'smart' ? 'input' : 'outline');
        clearPersistedResumeState();
      }
    }
    setLoading(false);
  }, [
    user,
    outlineResult,
    editedSlides,
    pageCount,
    result?.generationId,
    files,
    mode,
    smartGammaPayload,
    theme,
    tone,
    imgMode,
    strictPreserve,
    smartThemeTouched,
    smartToneTouched,
    smartImageTouched,
    directImgMode,
    directTheme,
    directTone,
    directTextMode,
    openPayment,
    updateCredits,
    rollbackCredits,
    hasUserEditedSlides,
    isLikelyNavigatingAway,
    waitForGammaCompletion,
    persistGammaResumeState,
    clearPersistedResumeState,
  ]);

  // 🚨 Fix: 使用 ref 保存最新 confirmAndGenerate 引用，避免 useCallback 闭包导致点击丢失
  const confirmAndGenerateRef = useRef(confirmAndGenerate);
  confirmAndGenerateRef.current = confirmAndGenerate;
  const handleConfirmGenerate = useCallback(() => {
    confirmAndGenerateRef.current();
  }, []);

  useEffect(() => {
    if (!smartAutoGeneratePending) return;
    if (loading) return;
    if (!outlineResult) return;
    setSmartAutoGeneratePending(false);
    confirmAndGenerateRef.current();
  }, [smartAutoGeneratePending, loading, outlineResult]);

  const reset = () => {
    setLoading(false);
    setError('');
    setResult(null);
    setOutlineResult(null);
    setSmartGammaPayload(null);
    setEditedSlides([]);
    setOriginalSlides([]);
    setStreamingSlides([]);
    setFiles([]);
    setTopic('');
    setShowPro(false);
    setShowDirectAdvanced(false);
    setGenMode('preserve');
    setStrictPreserve(true);
    setSmartThemeTouched(false);
    setSmartToneTouched(false);
    setSmartImageTouched(false);
    setOutlinePreprocess(null);
    setSmartAutoGeneratePending(false);
    setForceRequestedModeOnce(false);
    setPhase('input');
    setGenProgress(0);
    setGenStep(0);
    previewLoadedGenerationRef.current = '';
    resetPreviewState();
    clearPersistedResumeState();
  };

  const backToLanding = () => {
    setPhase('input');
    setOutlineResult(null);
    setSmartGammaPayload(null);
    setEditedSlides([]);
    setOriginalSlides([]);
    setStreamingSlides([]);
    setError('');
    setShowDirectAdvanced(false);
    setSmartThemeTouched(false);
    setSmartToneTouched(false);
    setSmartImageTouched(false);
    setOutlinePreprocess(null);
    setSmartAutoGeneratePending(false);
    setForceRequestedModeOnce(false);
    previewLoadedGenerationRef.current = '';
    resetPreviewState();
    clearPersistedResumeState();
  };

  // 🚨 v10.5: 处理定价页订阅按钮
  const handleSubscribe = useCallback((planId: string) => {
    // 映射planId到正确的会员计划
    const planMap: Record<string, { id: string; name: string; price: string }> = {
      'shengxin': { id: 'shengxin', name: '✨ 省心会员', price: '¥19.9/月' },
      'advanced': { id: 'advanced', name: '👑 高级会员', price: '¥39.9/月' },
      'basic': { id: 'shengxin', name: '✨ 省心会员', price: '¥19.9/月' },
      'standard': { id: 'advanced', name: '👑 高级会员', price: '¥39.9/月' },
      'pro': { id: 'advanced', name: '👑 高级会员', price: '¥39.9/月' },
      'vip': { id: 'advanced', name: '👑 高级会员', price: '¥39.9/月' },
      'supreme': { id: 'advanced', name: '👑 高级会员', price: '¥39.9/月' },
    };
    const plan = planMap[planId];
    if (plan) {
      openPayment({
        id: plan.id,
        name: plan.name,
        price: plan.price,
        billing: 'monthly',
      });
    }
  }, [openPayment]);

  const backToOutline = () => {
    setPhase('outline');
    setError('');
  };

  useEffect(() => {
    if (phase === 'streaming') {
      if (outlineStageRef.current !== outlineStage) {
        outlineStageRef.current = outlineStage;
        outlineStageEnteredAtRef.current = Date.now();
      }
      return;
    }
    outlineStageRef.current = 'analyzing';
    outlineStageEnteredAtRef.current = Date.now();
  }, [phase, outlineStage]);

  useEffect(() => {
    if (phase !== 'streaming') {
      setOutlineDisplayProgress(10);
      return;
    }
    const target = Math.max(10, Math.min(97, outlineProgressTarget));
    setOutlineDisplayProgress((prev) => (target < prev ? target : prev));

    const stageSoftCaps: Record<OutlineStageKey, number> = {
      analyzing: 24,
      planning: 44,
      generating: 78,
      polishing: 94,
    };
    const stageSoftRates: Record<OutlineStageKey, number> = {
      analyzing: 1.1,
      planning: 0.95,
      generating: 0.75,
      polishing: 0.45,
    };
    const stageFloor: Record<OutlineStageKey, number> = {
      analyzing: 12,
      planning: 24,
      generating: 42,
      polishing: 80,
    };

    const timer = window.setInterval(() => {
      setOutlineDisplayProgress((prev) => {
        const elapsedSec = (Date.now() - outlineStageEnteredAtRef.current) / 1000;
        const stage = outlineStageRef.current;
        const softTarget = Math.min(
          stageSoftCaps[stage],
          stageFloor[stage] + elapsedSec * stageSoftRates[stage]
        );
        const mergedTarget = Math.max(target, softTarget);
        if (prev >= mergedTarget) return mergedTarget;
        const remaining = mergedTarget - prev;
        const step = remaining > 30 ? 1.8 : remaining > 16 ? 1.2 : 0.7;
        return Math.min(mergedTarget, prev + step);
      });
    }, 110);

    return () => window.clearInterval(timer);
  }, [phase, outlineProgressTarget]);

  useEffect(() => {
    if (phase !== 'generating' || !loading) return;
    const stepCaps: Record<number, number> = {
      0: 22,
      1: 40,
      2: 89,
      3: 96,
    };
    const cap = stepCaps[genStep] ?? 89;
    const timer = window.setInterval(() => {
      setGenProgress((prev) => {
        if (prev >= cap) return prev;
        const remaining = cap - prev;
        const drift = remaining > 20 ? 0.9 : remaining > 10 ? 0.55 : 0.28;
        return Math.min(cap, prev + drift);
      });
    }, 500);
    return () => window.clearInterval(timer);
  }, [phase, loading, genStep]);

  useEffect(() => {
    triedResumeRef.current = false;
  }, [user?.id]);

  useEffect(() => {
    if (!user) return;
    if (triedResumeRef.current) return;
    if (restoringResumeRef.current) return;

    triedResumeRef.current = true;
    const cached = readResumeState();
    if (!cached) return;
    if (cached.userId && cached.userId !== user.id) {
      clearPersistedResumeState();
      return;
    }

    const restore = async () => {
      restoringResumeRef.current = true;
      setError('');

      try {
        if (cached.stage === 'outline' && cached.outline?.payload) {
          setMode(cached.mode);
          setLoading(true);
          setPhase('streaming');
          setGenStep(0);
          setGenProgress(12);
          setStepText('检测到未完成大纲任务，正在自动恢复...');

          const od = await runOutlineRequest(cached.outline.payload);

          setGenProgress(60);
          setStreamingSlides(od.slides || []);
          setOutlineResult(od);
          setEditedSlides(od.slides || []);
          setOriginalSlides(od.slides || []);
          setOutlinePreprocess(od?.meta?.preprocess || null);

          if (cached.mode === 'smart') {
            const gammaImageSource = toGammaImageSource(od.imageMode || imgMode);
            setSmartGammaPayload({
              themeId: od.themeId || 'consultant',
              tone: od.tone || 'professional',
              imageOptions: { source: gammaImageSource },
            });
            const reverseImageModeMap: Record<string, string> = {
              'themeAccent': 'theme-img',
              'pexels': 'web',
              'aiGenerated': 'ai',
              'noImages': 'noImages',
            };
            setImgMode(reverseImageModeMap[gammaImageSource] || 'theme-img');
            setSmartAutoGeneratePending(true);
            setPhase('generating');
            setGenProgress(66);
            setStepText('已恢复省心模式任务，正在自动生成PPT...');
          } else {
            const gammaImageSource = toGammaImageSource(directImgMode);
            setSmartGammaPayload({
              themeId: directTheme !== 'default-light' ? directTheme : (od.themeId || 'consultant'),
              tone: directTone,
              imageOptions: { source: gammaImageSource },
            });
            setPhase('outline');
            setGenProgress(100);
          }
          clearPersistedResumeState();
          return;
        }

        if (cached.stage === 'gamma' && cached.gamma?.generationId) {
          setMode(cached.mode);
          setLoading(true);
          setPhase('generating');
          setGenStep(2);
          setGenProgress(62);
          setStepText('检测到未完成PPT任务，正在自动恢复...');

          const statusData = await waitForGammaCompletion(cached.gamma.generationId);
          const finalExportUrl = statusData.exportUrl || '';
          if (!finalExportUrl && !statusData?.gammaUrl) {
            throw new Error('恢复完成但未拿到导出链接，请重新生成');
          }

          setResult({
            title: cached.gamma.title || '省心PPT',
            slides: cached.gamma.slides || [],
            pptxUrl: finalExportUrl,
            gammaUrl: statusData?.gammaUrl || '',
            actualPages: Array.isArray(cached.gamma.slides) ? cached.gamma.slides.length : undefined,
            generationId: cached.gamma.generationId,
            renderSignature: cached.gamma.renderSignature,
          });
          setGenProgress(100);
          setPhase('result');
          clearPersistedResumeState();
        }
      } catch (e: any) {
        setError(`自动恢复失败：${e?.message || '未知错误'}`);
        setPhase('input');
        clearPersistedResumeState();
      } finally {
        setLoading(false);
        restoringResumeRef.current = false;
      }
    };

    void restore();
  }, [
    user,
    imgMode,
    directImgMode,
    directTheme,
    directTone,
    runOutlineRequest,
    waitForGammaCompletion,
    clearPersistedResumeState,
  ]);

  useEffect(() => {
    const inFlight = loading && (phase === 'streaming' || phase === 'generating');
    if (!inFlight) return;

    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      navigatingAwayRef.current = true;
      event.preventDefault();
      event.returnValue = '';
      setTimeout(() => {
        if (typeof document !== 'undefined' && document.visibilityState === 'visible') {
          navigatingAwayRef.current = false;
        }
      }, 800);
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [loading, phase]);

  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        navigatingAwayRef.current = false;
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, []);

  const resolveDownloadFilename = (headers: Headers, fallbackName: string) => {
    const contentDisposition = headers.get('content-disposition') || headers.get('Content-Disposition') || '';
    const utf8Match = contentDisposition.match(/filename\*=UTF-8''([^;]+)/i);
    if (utf8Match?.[1]) {
      try {
        return decodeURIComponent(utf8Match[1]);
      } catch {
        return utf8Match[1];
      }
    }
    const basicMatch = contentDisposition.match(/filename=\"?([^\";]+)\"?/i);
    if (basicMatch?.[1]) return basicMatch[1];
    return fallbackName;
  };

  // 🚨 v10.6+: PPTX 导出处理函数
  const handleExportPPT = async () => {
    if (!user) { openLogin(); return; }
    if (!result?.generationId) return;

    setExporting(true);
    try {
      const totalPages = result.actualPages || pageCount;
      let shouldRecordDownload = true;
      const permissionRes = await fetch(
        `/api/download?userId=${encodeURIComponent(user.id)}&pageCount=${totalPages}&format=pptx`
      );
      const permissionData = await permissionRes.json().catch(() => ({} as any));

      if (!permissionRes.ok) {
        if (user.plan_type && user.plan_type !== 'free') {
          shouldRecordDownload = false;
          console.warn('[Download] 权限接口不可用，会员走兜底下载:', permissionData.error || permissionRes.status);
        } else {
          alert(permissionData.error || '下载权限校验失败，请稍后重试');
          return;
        }
      } else if (permissionData.needPayment) {
        const cost = typeof permissionData.cost === 'number' ? permissionData.cost : totalPages * 0.2;
        setPayPerDownload({ pageCount: totalPages, cost });
        return;
      }

      const safeTitle = (result.title || '省心PPT').trim() || '省心PPT';
      const fallbackFilename = `${safeTitle}.pptx`;
      const downloadRes = await fetch(
        `/api/export-pptx?generationId=${result.generationId}&name=${encodeURIComponent(fallbackFilename)}`
      );
      let contentType = (downloadRes.headers.get('Content-Type') || '').toLowerCase();

      if (!downloadRes.ok || contentType.includes('application/json')) {
        const errData = await downloadRes.json().catch(() => ({ error: '导出失败' }));
        alert(errData.error || '导出失败，请稍后重试');
        return;
      }

      const blob = await downloadRes.blob();
      const finalFilename = resolveDownloadFilename(downloadRes.headers, fallbackFilename);
      downloadBlob(blob, finalFilename);

      if (shouldRecordDownload) {
        try {
          await fetch('/api/download', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              action: 'record',
              userId: user.id,
              pageCount: totalPages,
              format: 'pptx',
            }),
          });
        } catch (recordErr) {
          console.warn('[Download] 记录下载次数失败:', recordErr);
        }
      }
    } finally {
      setExporting(false);
    }
  };

  const handleExportPDF = async () => {
    if (!result?.generationId) return;
    setExportingPdf(true);
    try {
      const safeTitle = (result.title || '省心PPT').trim() || '省心PPT';
      const pdfFilename = `${safeTitle}.pdf`;
      const pdfPath = buildPreviewApiPath(result.generationId, 'pdf', pdfFilename, false);
      const pdfRes = await fetch(pdfPath);
      const contentType = (pdfRes.headers.get('Content-Type') || '').toLowerCase();
      if (!pdfRes.ok || contentType.includes('application/json')) {
        const errData = await pdfRes.json().catch(() => ({ error: 'PDF 导出失败' }));
        throw new Error(errData.error || 'PDF 导出失败');
      }
      const blob = await pdfRes.blob();
      const filename = resolveDownloadFilename(pdfRes.headers, pdfFilename);
      downloadBlob(blob, filename);
    } catch (e: any) {
      alert(e?.message || 'PDF 导出失败，请稍后重试');
    } finally {
      setExportingPdf(false);
    }
  };

  const handleOneTimeDownload = async () => {
    if (!user || !result?.generationId || !payPerDownload) return;
    setPayingOnce(true);
    try {
      const safeTitle = (result.title || '省心PPT').trim() || '省心PPT';
      const filename = `${safeTitle}.pptx`;
      const payRes = await fetch('/api/pay-once', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user.id,
          generationId: result.generationId,
          pageCount: payPerDownload.pageCount,
          filename,
        }),
      });
      const payData = await payRes.json().catch(() => ({} as any));
      if (!payRes.ok || !payData?.success) {
        if (payData?.error === '积分不足') {
          openPayment({
            id: 'shengxin',
            name: '省心会员',
            price: '¥19.9/月',
            billing: 'monthly',
            reason: payData?.message || `积分不足，当前下载约需 ¥${payPerDownload.cost.toFixed(2)}`,
            neededCredits: payData?.needed,
            currentCredits: payData?.balance,
          });
          return;
        }
        throw new Error(payData?.error || '单次付费失败');
      }

      if (typeof payData?.remainingCredits === 'number') {
        updateCredits(payData.remainingCredits);
      }

      const downloadRes = await fetch(payData.downloadUrl);
      const contentType = (downloadRes.headers.get('Content-Type') || '').toLowerCase();
      if (!downloadRes.ok || contentType.includes('application/json')) {
        const errData = await downloadRes.json().catch(() => ({ error: '下载失败' }));
        throw new Error(errData.error || '下载失败');
      }
      const blob = await downloadRes.blob();
      const finalFilename = resolveDownloadFilename(downloadRes.headers, filename);
      downloadBlob(blob, finalFilename);
      setPayPerDownload(null);
    } catch (e: any) {
      alert(e?.message || '单次付费下载失败，请稍后重试');
    } finally {
      setPayingOnce(false);
    }
  };

  const loadInlinePreview = useCallback(async () => {
    if (!result?.generationId) return;

    setPreviewLoading(true);
    setPreviewError('');

    try {
      if (previewBlobUrlRef.current) {
        URL.revokeObjectURL(previewBlobUrlRef.current);
        previewBlobUrlRef.current = '';
      }

      const safeTitle = (result.title || '省心PPT').trim() || '省心PPT';
      const generationId = result.generationId;
      if (!generationId) throw new Error('缺少生成任务ID，无法预览');

      const pdfFilename = `${safeTitle}.pdf`;
      const pdfPath = buildPreviewApiPath(generationId, 'pdf', pdfFilename, true);
      setPreviewPdfFetchUrl(pdfPath);
      const pdfRes = await fetch(pdfPath);
      const contentType = (pdfRes.headers.get('Content-Type') || '').toLowerCase();
      if (!pdfRes.ok || contentType.includes('application/json')) {
        const errData = await pdfRes.json().catch(() => ({ error: 'PDF 预览文件获取失败' }));
        throw new Error(errData.error || 'PDF 预览文件获取失败');
      }

      const blob = await pdfRes.blob();
      const blobUrl = URL.createObjectURL(blob);
      previewBlobUrlRef.current = blobUrl;
      setPreviewPdfUrl(blobUrl);
    } catch (e: unknown) {
      setPreviewError(e instanceof Error ? e.message : '在线预览加载失败');
    } finally {
      setPreviewLoading(false);
    }
  }, [result?.generationId, result?.title]);

  useEffect(() => {
    return () => {
      if (previewBlobUrlRef.current) {
        URL.revokeObjectURL(previewBlobUrlRef.current);
        previewBlobUrlRef.current = '';
      }
    };
  }, []);

  useEffect(() => {
    if (phase !== 'result') return;
    if (!result?.generationId) return;
    if (previewLoadedGenerationRef.current === result.generationId) return;
    previewLoadedGenerationRef.current = result.generationId;
    void loadInlinePreview();
  }, [phase, result?.generationId, loadInlinePreview]);

  useEffect(() => {
    if (!result?.generationId) return;
  }, [result?.generationId]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!['outline', 'generating', 'result'].includes(phase)) return;
    window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
  }, [phase]);

  const downloadBlob = (blob: Blob, filename: string) => {
    const blobUrl = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = blobUrl;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setTimeout(() => URL.revokeObjectURL(blobUrl), 5000);
  };

  // Outline editing helpers
  const updateSlide = (idx: number, field: 'title' | 'content', val: string) => {
    setEditedSlides(prev => prev.map((s, i) =>
      i === idx ? (field === 'title' ? { ...s, title: val } : { ...s, content: (val || '').split('\n').filter(Boolean) }) : s
    ));
  };

  const addSlide = () => setEditedSlides(prev => [...prev, { id: `new-${Date.now()}`, title: '新幻灯片', content: [] }]);
  const removeSlide = (idx: number) => {
    if (idx < 2) {
      alert('封面页和目录页不可删除');
      return;
    }
    if (!window.confirm(`确定要删除第 ${idx + 1} 页「${editedSlides[idx].title}」吗？`)) return;
    setEditedSlides(prev => prev.filter((_, i) => i !== idx));
  };
  const moveSlide = (idx: number, dir: -1 | 1) => {
    const newIdx = idx + dir;
    if (newIdx < 0 || newIdx >= editedSlides.length) return;
    setEditedSlides(prev => { const arr = [...prev]; [arr[idx], arr[newIdx]] = [arr[newIdx], arr[idx]]; return arr; });
  };

  // Drag-and-drop handlers for outline reordering
  const handleDragStart = (idx: number) => {
    setDragIndex(idx);
  };
  const handleDragOver = (e: React.DragEvent, idx: number) => {
    e.preventDefault();
    if (dragIndex !== null && dragIndex !== idx) {
      setDragOverIndex(idx);
    }
  };
  const handleDrop = (idx: number) => {
    if (dragIndex !== null && dragIndex !== idx) {
      setEditedSlides(prev => {
        const arr = [...prev];
        const [removed] = arr.splice(dragIndex, 1);
        arr.splice(idx, 0, removed);
        return arr;
      });
    }
    setDragIndex(null);
    setDragOverIndex(null);
  };
  const handleDragEnd = () => {
    setDragIndex(null);
    setDragOverIndex(null);
  };

  const fileProcess = async (fl: FileList | File[]) => {
    const r: UploadedFile[] = [];
    const parseTables = shouldProcessTables(getTopicValue());
    for (const f of Array.from(fl)) {
      // V7 前端校验
      if (f.size > LIMITS.MAX_FILE_SIZE) {
        setError(`文件 "${f.name}" 超过${LIMITS_HUMAN_READABLE.MAX_FILE_SIZE_LABEL}限制`);
        continue;
      }

      const item: UploadedFile = { name: f.name, type: f.type, size: f.size };
      const ext = f.name.toLowerCase();

      // 纯文本文件：直接读取
      if (f.type === 'text/plain' || /\.(md|txt)$/.test(ext)) {
        item.content = await f.text();
      }
      // 图片：通过 understand-image API 解析
      else if (f.type.startsWith('image/')) {
        try {
          const arrayBuffer = await f.arrayBuffer();
          const bytes = new Uint8Array(arrayBuffer);
          let binary = '';
          for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i]);
          const base64 = btoa(binary);
          const res = await fetch('/api/understand-image', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ image: base64, mimeType: f.type }),
          });
          const data = await res.json();
          item.content = data.text || `[图片: ${f.name}]`;
        } catch {
          item.content = `[图片: ${f.name}]`;
        }
      }
      // PDF/Excel/Word/PPT：通过 parse-file API 服务端解析
      else if (/\.(pdf|csv|xlsx?|docx?|pptx?)$/.test(ext)) {
        try {
          const isPdf = /\.pdf$/.test(ext);
          const isPpt = /\.pptx?$/.test(ext);
          const formData = new FormData();
          formData.append('file', f);
          // 省心模式工作流：默认不展开表格明细，除非用户需求明确提到“处理表格”
          formData.append('skipTables', parseTables ? 'false' : 'true');
          const res = await fetch('/api/parse-file', {
            method: 'POST',
            body: formData,
          });
          if (!res.ok) {
            const errData = await res.json().catch(() => ({}));
            if (isPdf || isPpt) {
              item.passthrough = true;
              item.content = buildAttachmentContext(item);
            } else {
              alert(`文件 "${f.name}" 解析失败: ${errData.error || res.statusText}`);
              continue;
            }
          } else {
            const data = await res.json();
            // 🚨 解析明确失败时（failed=true），不设置 content，阻止垃圾文本进入 outline
            if (data.failed) {
              if (isPdf || isPpt) {
                item.passthrough = true;
                item.content = buildAttachmentContext(item);
              } else {
                alert(`文件 "${f.name}" ${data.error || '解析失败'}，请将文字直接粘贴到输入框。`);
                continue; // 跳过此文件，不添加到 files 列表
              }
            }
            if (!item.content) {
              item.content = data.text || `[文件: ${f.name}]`;
            }
            // 检测服务端返回的解析失败提示（PDF允许降级透传，不中断流程）
            if (item.content && /解析失败|扫描件|无文字/.test(item.content) && !isPdf && !isPpt) {
              alert(`文件 "${f.name}" 无法提取文字内容，请尝试手动复制粘贴。`);
              continue; // 跳过，不添加到列表
            }
          }
        } catch (e) {
          console.warn('[FileProcess] 解析失败:', e);
          if (/\.pdf$/.test(ext) || /\.pptx?$/.test(ext)) {
            item.passthrough = true;
            item.content = buildAttachmentContext(item);
          } else {
            alert(`文件 "${f.name}" 解析失败，请重试或直接粘贴文字内容。`);
            continue;
          }
        }
      }
      else {
        item.content = `[文件: ${f.name}]`;
      }
      r.push(item);
    }
    return r;
  };

  const fmtSize = (b: number) => b < 1024 ? b + ' B' : b < 1048576 ? (b / 1024).toFixed(1) + ' KB' : (b / 1048576).toFixed(1) + ' MB';

  return (
    <div className="min-h-screen premium-shell flex flex-col">
      <SubscribeHandlerWrapper onSubscribe={handleSubscribe} />
      <Navbar onLogoClick={backToLanding} />
      <AnnouncementBar announcement={getLatestAnnouncement()} />

      {/* 顶部通知条 - 仅生成中阶段隐藏 */}
      {phase !== 'generating' && (
        <ScrollingBanner variant="top" />
      )}
      <div className="text-center py-1 text-[11px] text-gray-400">
        版本 {APP_VERSION}
      </div>

      {/* ===== LANDING PAGE ===== */}
      {phase === 'landing' && (
        <>
          {/* Mobile-optimized Hero */}
          <div className="relative pt-6 pb-8 md:pt-12 md:pb-16 overflow-hidden">
            {/* Background */}
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
              <div className="absolute -top-20 -right-20 w-[300px] h-[300px] md:w-[500px] md:h-[500px] bg-gradient-to-br from-sky-200/30 to-indigo-100/20 rounded-full blur-3xl" />
              <div className="absolute inset-0 premium-grid-bg opacity-[0.2]" />
            </div>

            <div className="relative max-w-3xl mx-auto px-3 md:px-6">
              <div className="premium-hero rounded-3xl px-4 py-6 md:px-8 md:py-9">
              {/* Badge - mobile compact */}
              <div className="flex justify-center mb-4 md:mb-6">
                <div className="inline-flex items-center gap-1.5 px-3 py-1.5 md:px-4 md:py-2 premium-chip rounded-full shadow-sm">
                  <span className="relative flex h-1.5 w-1.5 md:h-2 md:w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-purple-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-1.5 w-1.5 md:h-2 md:w-2 bg-purple-500"></span>
                  </span>
                  <span className="text-[10px] md:text-xs font-medium text-indigo-700">省心PPT · AI演示设计引擎</span>
                </div>
              </div>

              {/* Headline - mobile compact */}
              <div className="text-center mb-6 md:mb-8">
                <h1 className="text-2xl md:text-4xl lg:text-5xl font-black text-gray-900 leading-tight tracking-tight mb-3">
                  <span className="block">输入主题，</span>
                  <span className="block bg-gradient-to-r from-indigo-600 via-sky-500 to-cyan-500 bg-clip-text text-transparent">AI一键生成PPT</span>
                </h1>
                <p className="text-sm md:text-base font-semibold text-indigo-600 mb-1.5">省心PPT，让表达更专业</p>
                <p className="text-sm md:text-base text-gray-600 max-w-md mx-auto">输入主题即可完成结构、排版、配图，一次出稿直接可讲</p>
              </div>

              {/* Mobile: Dual mode cards (same as desktop) */}
              <div className="grid grid-cols-2 gap-3 mb-4 md:hidden">
                <button
                  onClick={() => handleModeSelect('direct')}
                  className="group premium-card p-4 rounded-xl border-2 border-gray-100 hover:border-indigo-200 transition-all text-left"
                >
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-purple-500 to-purple-400 flex items-center justify-center shadow-md shadow-purple-200/40">
                      <span className="text-white text-base">🚀</span>
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-gray-900">专业模式</h3>
                      <p className="text-[10px] text-gray-400">快速生成</p>
                    </div>
                  </div>
                  <span className="px-2 py-0.5 bg-green-50 text-green-600 rounded-full text-[10px]">免费</span>
                </button>

                <button
                  onClick={() => handleModeSelect('smart')}
                  className="group premium-card p-4 rounded-xl border-2 border-gray-100 hover:border-sky-200 transition-all text-left"
                >
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-amber-500 to-orange-500 flex items-center justify-center shadow-md shadow-amber-200/40">
                      <span className="text-white text-base">✨</span>
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-gray-900">省心定制</h3>
                      <p className="text-[10px] text-gray-400">深度优化</p>
                    </div>
                  </div>
                  <span className="px-2 py-0.5 bg-amber-50 text-amber-600 rounded-full text-[10px]">会员</span>
                </button>
              </div>

              {/* Desktop: Dual mode cards */}
              <div className="hidden md:grid grid-cols-2 gap-5 mb-8">
                <button
                  onClick={() => handleModeSelect('direct')}
                  className="group premium-card p-6 rounded-2xl border-2 border-gray-100 hover:border-indigo-200 transition-all text-left"
                >
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-purple-500 to-purple-400 flex items-center justify-center shadow-lg shadow-purple-200/40">
                      <span className="text-white text-lg">🚀</span>
                    </div>
                    <div>
                      <h3 className="text-base font-bold text-gray-900 group-hover:text-purple-700">专业模式</h3>
                      <p className="text-xs text-gray-400">快速生成</p>
                    </div>
                    <span className="ml-auto px-2 py-0.5 bg-green-50 text-green-600 rounded-full text-xs">免费</span>
                  </div>
                  <p className="text-sm text-gray-500 mb-3">输入内容直接生成，AI智能排版，适合快速制作</p>
                  <div className="flex flex-wrap gap-1.5">
                    <span className="px-2 py-0.5 bg-gray-50 text-gray-600 rounded text-xs">即时生成</span>
                    <span className="px-2 py-0.5 bg-gray-50 text-gray-600 rounded text-xs">智能排版</span>
                    <span className="px-2 py-0.5 bg-gray-50 text-gray-600 rounded text-xs">4种图片</span>
                  </div>
                </button>

                <button
                  onClick={() => handleModeSelect('smart')}
                  className="group premium-card p-6 rounded-2xl border-2 border-gray-100 hover:border-sky-200 transition-all text-left"
                >
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-amber-500 to-orange-500 flex items-center justify-center shadow-lg shadow-amber-200/40">
                      <span className="text-white text-lg">✨</span>
                    </div>
                    <div>
                      <h3 className="text-base font-bold text-gray-900 group-hover:text-amber-700">省心定制</h3>
                      <p className="text-xs text-gray-400">深度优化</p>
                    </div>
                    <span className="ml-auto px-2 py-0.5 bg-amber-50 text-amber-600 rounded-full text-xs">会员</span>
                  </div>
                  <p className="text-sm text-gray-500 mb-3">AI深度预处理，专业级呈现，适合高质量需求</p>
                  <div className="flex flex-wrap gap-1.5">
                    <span className="px-2 py-0.5 bg-gray-50 text-gray-600 rounded text-xs">AI预处理</span>
                    <span className="px-2 py-0.5 bg-gray-50 text-gray-600 rounded text-xs">保持原样</span>
                    <span className="px-2 py-0.5 bg-gray-50 text-gray-600 rounded text-xs">深度定制</span>
                  </div>
                </button>
              </div>

              {/* Hot scenes - mobile scrollable */}
              <div className="mb-6 md:mb-8">
                <p className="text-center text-xs text-gray-400 mb-3 md:hidden">热门场景</p>
                <div className="flex flex-wrap justify-center gap-2 md:gap-3">
                  {HOT_SCENES.slice(0, 4).map((s, i) => (
                    <button
                      key={i}
                      onClick={() => handleSceneClick(s.text)}
                      className="px-3 py-2 bg-white border border-gray-200 rounded-full text-xs text-gray-600 hover:text-purple-600 hover:border-purple-200 hover:bg-purple-50/50 transition-all md:px-4"
                    >
                      {s.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5 md:gap-3 mb-6">
                {[
                  '优势：一键生成完整可讲PPT',
                  '优势：主题色系与配图自动匹配',
                  '优势：支持文档上传智能转大纲',
                ].map((text) => (
                  <div key={text} className="premium-chip rounded-xl px-3 py-2.5 text-[11px] md:text-xs text-slate-600 text-center">
                    {text}
                  </div>
                ))}
              </div>

              <div className="premium-chip rounded-2xl px-3 py-3 md:px-4 mb-2">
                <p className="text-xs font-semibold text-slate-700 text-center">流程：输入主题 → 生成大纲 → 一键成稿 → 在线预览与下载</p>
              </div>

              {/* Social proof - desktop only */}
              <div className="hidden md:flex items-center justify-center gap-6 text-xs text-gray-400">
                <span className="flex items-center gap-2">
                  <div className="flex -space-x-1.5">
                    {['👨','👩','👨','👩'].map((e, i) => <div key={i} className="w-6 h-6 rounded-full bg-gray-100 border border-white flex items-center justify-center text-xs">{e}</div>)}
                  </div>
                  10万+用户
                </span>
                <span>★★★★★ 4.9</span>
                <span>已生成100万+份PPT</span>
              </div>
              </div>
            </div>
          </div>

          <SceneCards />
          <ProcessSection />
          <FAQSection />
          <TestimonialSection />
          {/* Footer - mobile compact */}
          <div className="max-w-3xl mx-auto px-3 md:px-4 pt-4 pb-3 md:pt-6 md:pb-4">
            <div className="flex items-center justify-center gap-4 md:gap-6 text-xs text-gray-400">
              <a href="/pricing" className="hover:text-purple-500">定价</a>
              <span className="hidden md:inline">·</span>
              <a href="/account" className="hover:text-purple-500">用户中心</a>
              <span className="hidden md:inline">·</span>
              <a href="/history" className="hover:text-purple-500">历史</a>
              <span className="hidden md:inline">·</span>
              <span>© 2026 省心PPT</span>
            </div>
          </div>
          <Footer />
        </>
      )}

      {/* ===== GENERATE FLOW ===== */}
      {(phase === 'input' || phase === 'outline') && (
        <div className="flex-1 sx-shell min-h-screen relative overflow-hidden">
          <div className="relative max-w-7xl mx-auto px-4 md:px-8 pt-3 md:pt-5 pb-24">

            {phase === 'input' && (
              <>
                <section className="relative">
                  <span className="sx-crystal hidden md:block" style={{ '--size': '82px', '--rotate': '-19deg', '--opacity': '0.5', left: '-18px', top: '250px' } as React.CSSProperties} />
                  <span className="sx-crystal hidden md:block" style={{ '--size': '46px', '--rotate': '21deg', '--opacity': '0.46', right: '68px', top: '92px' } as React.CSSProperties} />
                  <div className="sx-orbit hidden lg:block w-[760px] h-[170px] right-[-80px] top-[214px]" />

                  <div className="max-w-[840px] mx-auto mb-1 md:mb-0">
                    <div className="sx-appear pt-0 md:pt-8 lg:pt-3 text-center">
                      <h1 className="text-[30px] md:text-6xl lg:text-7xl font-black tracking-tight leading-[1.04] sx-gradient-text">创建你的 PPT</h1>
                      <p className="mt-1.5 md:mt-4 text-[17px] md:text-2xl font-extrabold text-slate-900">
                        <span className="sx-accent-text">省心PPT让演示更快，更精美，更省心！</span>
                      </p>
                      <p className="mt-2.5 md:mt-4 max-w-xl mx-auto text-[13px] md:text-base text-slate-500 leading-relaxed">
                        输入主题，AI 自动完成大纲、版式、配色和配图，让每一次表达都有专业设计感。
                      </p>
                      <div className="mt-5 hidden md:flex flex-wrap justify-center gap-3">
                        {[
                          ['智能结构梳理', 'M7 9h10M7 13h6M5 5h14v14H5z'],
                          ['统一配色主题', 'M12 3l2.5 5 5.5.8-4 3.9.9 5.5L12 15.8 7.1 18l.9-5.5-4-3.9 5.5-.8z'],
                          ['自动匹配配图', 'M4 6h16v12H4z M8 14l2.4-2.4 2.2 2.2 2.4-3L20 16'],
                        ].map(([label, path]) => (
                          <span key={label} className="sx-glass inline-flex items-center gap-2 rounded-2xl px-4 py-2.5 text-xs font-bold text-indigo-700">
                            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d={path} /></svg>
                            {label}
                          </span>
                        ))}
                      </div>
                      <div className="mt-6 hidden md:grid grid-cols-4 gap-3 max-w-lg mx-auto">
                        {[
                          ['30秒', '平均生成时间'],
                          ['50+', '精选主题'],
                          ['4种', '配图模式'],
                          ['10万+', '用户信赖'],
                        ].map(([value, label]) => (
                          <div key={label} className="text-center lg:text-left">
                            <p className="text-lg md:text-xl font-black sx-accent-text">{value}</p>
                            <p className="text-[10px] text-slate-400 mt-0.5">{label}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div id="hero-input" className="sx-glass-strong relative rounded-[28px] p-3.5 sm:p-5 md:p-6 max-w-[1040px] mx-auto sx-appear sx-appear-delay-2">
                  {/* Textarea - full width */}
                  <div className="relative">
                    <textarea
                      ref={topicInputRef}
                      value={topic}
                      onChange={e => setTopic(e.target.value)}
                      onInput={e => setTopic((e.target as HTMLTextAreaElement).value)}
                      placeholder="输入PPT主题，如：2024年度工作汇报、咖啡品牌推广方案"
                      className="w-full min-h-[118px] md:min-h-[148px] px-4 md:px-5 py-3.5 md:py-4 pb-11 md:pb-12 rounded-2xl bg-white/78 border border-indigo-100/80 focus:border-[#6C5CFF] focus:ring-4 focus:ring-indigo-100/70 focus:bg-white outline-none resize-none text-sm md:text-base text-slate-800 placeholder:text-slate-400 transition-all shadow-inner shadow-indigo-50/40"
                    />
                    {/* Attach button inside textarea (bottom-left) */}
                    <button
                      onClick={() => fileRef.current?.click()}
                      className="absolute bottom-3 left-3 w-9 h-9 flex items-center justify-center rounded-xl text-indigo-500 bg-white/82 border border-indigo-100 hover:text-[#5B4FE9] hover:bg-[#F5F3FF] transition-all"
                      title="上传附件"
                    >
                      <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M21.44 11.05l-9.19 9.19a6 6 0 01-8.49-8.49l9.19-9.19a4 4 0 015.66 5.66l-9.2 9.19a2 2 0 01-2.83-2.83l8.49-8.48" />
                      </svg>
                    </button>
                  </div>
                  <input ref={fileRef} type="file" multiple accept=".txt,.md,.doc,.docx,.pdf,.xls,.xlsx,.csv,.png,.jpg,.jpeg,.webp,.ppt,.pptx" onChange={async e => {
                    const raw = e.target.files;
                    if (!raw) return;
                    const newFiles = Array.from(raw);
                    if (files.length + newFiles.length > LIMITS.MAX_FILE_COUNT) {
                      setError(`最多上传${LIMITS.MAX_FILE_COUNT}个文件`);
                      e.target.value = '';
                      return;
                    }
                    if (newFiles.length) { const processed = await fileProcess(newFiles); setFiles(prev => [...prev, ...processed]); }
                    e.target.value = '';
                  }} className="hidden" />

                  {files.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {files.map((f, i) => (
                        <span key={i} className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-[#F5F3FF] rounded-lg text-[11px] text-[#4338CA] font-medium">
                          {f.type.startsWith('image/') ? '🖼️' : /\.(xls|csv)/.test(f.name) ? '📊' : '📄'} {f.name}
                          <span className="text-gray-400">{fmtSize(f.size)}</span>
                          <button onClick={() => setFiles(prev => prev.filter((_, j) => j !== i))} className="text-gray-300 hover:text-red-400">×</button>
                        </span>
                      ))}
                    </div>
                  )}

                  <div className="mt-2 text-[10px] text-slate-400 leading-relaxed">
                    支持常见格式：.txt .md .pdf .docx .xlsx  .png .pptx；文件9个，大小≤100MB，文本≤5万字。
                  </div>

                  <div className="border-t border-indigo-100/70 my-4" />

                  {/* Mode toggle - segmented control style */}
                  <div className="flex max-w-xl mx-auto bg-indigo-50/80 rounded-full p-1 mt-4 border border-white/80 shadow-inner">
                    <button
                      onClick={() => {
                        setMode('direct');
                        setShowDirectAdvanced(false);
                      }}
                      className={`flex-1 py-2.5 rounded-full text-center transition-all text-sm font-semibold ${
                        mode === 'direct'
                          ? 'bg-white text-[#4338CA] shadow-md shadow-indigo-100/70'
                          : 'text-gray-500 hover:text-gray-700'
                      }`}
                    >
                      专业模式
                    </button>
                    <button
                      onClick={() => {
                        const userPlan = getPlan(user?.plan_type || 'free');
                        if (!userPlan.smartMode) {
                          const planInfo = getPlan('shengxin');
                          openPayment({
                            id: planInfo.id,
                            name: `${planInfo.name} · ${planInfo.emoji}`,
                            price: `¥${planInfo.priceMonthly}/月`,
                            billing: 'monthly',
                            reason: `省心定制为${planInfo.name}专享，开通后即可使用`,
                          });
                          return;
                        }
                        setMode('smart');
                        setSmartThemeTouched(false);
                        setSmartToneTouched(false);
                        setSmartImageTouched(false);
                        setShowDirectAdvanced(false);
                      }}
                      className={`flex-1 py-2.5 rounded-full text-center transition-all text-sm font-semibold ${
                        mode === 'smart'
                          ? 'bg-white text-[#4338CA] shadow-md shadow-indigo-100/70'
                          : getPlan(user?.plan_type || 'free').smartMode
                            ? 'text-gray-500 hover:text-gray-700'
                            : 'text-gray-400'
                      }`}
                    >
                      省心定制
                      {!getPlan(user?.plan_type || 'free').smartMode && <span className="ml-1 text-[10px] opacity-60">💎</span>}
                    </button>
                  </div>

                  {mode === 'direct' && (
                    <div className="mt-3 flex justify-end">
                      <button
                        onClick={() => setShowDirectAdvanced(v => !v)}
                        className={`inline-flex items-center justify-center gap-2 h-9 px-3.5 rounded-xl text-sm font-semibold transition-all active:scale-[0.98] ${
                          showDirectAdvanced
                            ? 'text-white sx-primary-btn border border-indigo-200/30'
                            : 'text-indigo-700 bg-white border border-indigo-200 hover:bg-indigo-50'
                        }`}
                      >
                        <span className={`w-2 h-2 rounded-full ${showDirectAdvanced ? 'bg-white/90' : 'bg-indigo-500'}`} />
                        高级选项
                      </button>
                    </div>
                  )}

                  {((mode === 'direct' && directTextMode === 'preserve') || (mode === 'smart' && genMode === 'preserve')) && (
                    <div className="mt-3 rounded-2xl border border-purple-100 bg-[#FAF7FF] px-4 py-3 flex items-start justify-between gap-3">
                      <div>
                        <p className="text-xs font-semibold text-[#5B4FE9]">严格保真</p>
                        <p className="text-[11px] text-gray-500 mt-0.5">禁止改标题、禁止自动续页命名、禁止自动填充提示语。</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => setStrictPreserve(v => !v)}
                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${strictPreserve ? 'bg-[#5B4FE9]' : 'bg-gray-300'}`}
                        aria-pressed={strictPreserve}
                        title={strictPreserve ? '已开启严格保真' : '已关闭严格保真'}
                      >
                        <span className={`inline-block h-5 w-5 transform rounded-full bg-white transition-transform ${strictPreserve ? 'translate-x-5' : 'translate-x-1'}`} />
                      </button>
                    </div>
                  )}

                  {/* Direct mode: show ThemeSelector + params */}
                  {mode === 'direct' && showDirectAdvanced && (
                    <div className="mt-4 pt-4 border-t border-gray-100 space-y-5 -mx-1 px-1">
                      {/* 主题色系 */}
                      <div>
                        <h3 className="text-[15px] font-semibold text-gray-800 mb-3">主题色系</h3>
                        <ThemeSelector value={directTheme} onChange={setDirectTheme} />
                      </div>

                      {/* 文本处理 */}
                      <div>
                        <h3 className="text-[15px] font-semibold text-gray-800 mb-3">文本处理</h3>
                        <div className="grid grid-cols-3 gap-2.5 md:gap-3">
                          {[
                            { value: 'generate', label: '扩充文本', desc: 'AI丰富内容' },
                            { value: 'condense', label: '总结提炼', desc: 'AI精简核心' },
                            { value: 'preserve', label: '保持原样', desc: '忠实呈现' },
                          ].map(opt => (
                            <button
                              key={opt.value}
                              onClick={() => {
                                const nextMode = opt.value as 'generate' | 'condense' | 'preserve';
                                setDirectTextMode(nextMode);
                                if (nextMode === 'preserve') setStrictPreserve(true);
                              }}
                              className={`relative h-11 md:h-12 px-2 rounded-xl border-2 text-center transition-all ${
                                directTextMode === opt.value
                                  ? 'border-[#5B4FE9] bg-[#F5F3FF] shadow-sm'
                                  : 'border-gray-200 bg-white hover:border-gray-300'
                              }`}
                            >
                              {directTextMode === opt.value && (
                                <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-[#5B4FE9]" />
                              )}
                              <div className={`text-[13px] md:text-sm font-semibold leading-tight ${directTextMode === opt.value ? 'text-[#4338CA]' : 'text-gray-700'}`}>{opt.label}</div>
                              <div className="hidden md:block text-[11px] text-gray-500 mt-0.5">{opt.desc}</div>
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* 生成参数 */}
                      <div>
                        <h3 className="text-[15px] font-semibold text-gray-800 mb-3">生成参数</h3>
                        <div className="grid grid-cols-3 gap-2.5 md:gap-5">
                          <div>
                            <label className="text-[11px] md:text-xs text-gray-500 mb-1.5 block font-medium">页数</label>
                            <div className="relative" ref={pagePickerRef}>
                              <button
                                type="button"
                                onClick={() => setShowPagePicker(v => !v)}
                                className="w-full h-11 md:h-12 px-3 rounded-xl border border-gray-200 bg-white flex items-center justify-between hover:border-indigo-200 transition-colors"
                              >
                                <span className="text-[14px] md:text-[15px] font-semibold text-gray-800">{pageCount}</span>
                                <span className="text-[11px] md:text-xs text-slate-400">页</span>
                              </button>

                              {showPagePicker && (
                                <div className="absolute z-20 left-0 top-[calc(100%+8px)] w-full rounded-2xl border border-indigo-100 bg-white/95 backdrop-blur p-2 shadow-lg shadow-indigo-100/50">
                                  <div
                                    ref={pagePickerListRef}
                                    className="max-h-40 overflow-y-auto rounded-xl border border-slate-100 bg-white/70 p-1"
                                  >
                                    {pageOptions.map((page) => {
                                      const isLocked = page > planMaxPages;
                                      const tierBadge = page <= 8
                                        ? ''
                                        : page <= 20
                                          ? '✨'
                                          : '👑';
                                      return (
                                        <button
                                          key={page}
                                          data-page-option={page}
                                          type="button"
                                          onClick={() => {
                                            const ok = applyPageCountChange(page);
                                            if (ok) setShowPagePicker(false);
                                          }}
                                          className={`w-full h-8 rounded-lg text-sm transition-colors flex items-center justify-between px-2 ${
                                            page === pageCount
                                              ? 'bg-[#EEF2FF] text-[#4338CA] font-semibold'
                                              : isLocked
                                                ? 'text-slate-400 hover:bg-rose-50'
                                                : 'text-slate-600 hover:bg-slate-50'
                                          }`}
                                        >
                                          <span>{page}</span>
                                          <span className={`text-[10px] ${isLocked ? 'text-rose-400' : 'text-slate-400'}`}>
                                            {isLocked ? `🔒${tierBadge}` : tierBadge}
                                          </span>
                                        </button>
                                      );
                                    })}
                                  </div>
                                  <div className="mt-1.5 text-center text-[10px] text-indigo-500 font-medium">上下滑动并点击，精确到每一页</div>
                                </div>
                              )}
                            </div>
                          </div>
                          <div>
                            <label className="text-[11px] md:text-xs text-gray-500 mb-1.5 block font-medium">配图风格</label>
                            <select
                              value={directImgMode}
                              onChange={e => {
                                const val = e.target.value;
                                if (val === 'ai' || val === 'ai-pro') {
                                  const userPlan = getPlan(user?.plan_type || 'free');
                                  const needPro = val === 'ai-pro';
                                  const hasPermission = needPro
                                    ? userPlan.allowedAiModels.includes('imagen-3-pro')
                                    : userPlan.allowedAiModels.length > 0;
                                  if (!hasPermission) {
                                    const reqPlan = needPro ? 'advanced' : 'shengxin';
                                    const planInfo = getPlan(reqPlan);
                                    openPayment({
                                      id: planInfo.id,
                                      name: `${planInfo.name} · ${planInfo.emoji}`,
                                      price: `¥${planInfo.priceMonthly}/月`,
                                      billing: 'monthly',
                                      reason: `${needPro ? 'AI尊享图' : 'AI定制图'}为${planInfo.name}专享，开通后即可使用`,
                                    });
                                    return;
                                  }
                                }
                                setDirectImgMode(val);
                                // 同步 imgMode 状态，确保 confirmAndGenerate 使用正确的值
                                setImgMode(val);
                              }}
                              className="w-full h-11 md:h-12 px-2.5 rounded-xl border border-gray-200 text-[13px] md:text-sm bg-white focus:border-[#5B4FE9] focus:ring-2 focus:ring-[#EDE9FE] outline-none transition-all appearance-none cursor-pointer"
                              style={{backgroundImage: 'url(\"data:image/svg+xml,%3csvg xmlns=\'http://www.w3.org/2000/svg\' fill=\'none\' viewBox=\'0 0 20 20\'%3e%3cpath stroke=\'%236b7280\' stroke-linecap=\'round\' stroke-linejoin=\'round\' stroke-width=\'1.5\' d=\'M6 8l4 4 4-4\'/%3e%3c/svg%3e\")', backgroundPosition: 'right 0.5rem center', backgroundRepeat: 'no-repeat', backgroundSize: '1.5em 1.5em', paddingRight: '2.5rem'}}
                            >
                              <option value="noImages">极简无图</option>
                              <option value="theme-img">主题套图</option>
                              <option value="web">Pexels图库</option>
                              <option value="ai">{getPlan(user?.plan_type || 'free').allowedAiModels.length > 0 ? 'AI定制图 ✨' : 'AI定制图 🔒✨'}</option>
                              <option value="ai-pro">{getPlan(user?.plan_type || 'free').allowedAiModels.includes('imagen-3-pro') ? 'AI尊享图 👑' : 'AI尊享图 🔒👑'}</option>
                            </select>
                          </div>
                          <div>
                            <label className="text-[11px] md:text-xs text-gray-500 mb-1.5 block font-medium">语气风格</label>
                            <select
                              value={directTone}
                              onChange={e => setDirectTone(e.target.value)}
                              className="w-full h-11 md:h-12 px-2.5 rounded-xl border border-gray-200 text-[13px] md:text-sm bg-white focus:border-[#5B4FE9] focus:ring-2 focus:ring-[#EDE9FE] outline-none transition-all appearance-none cursor-pointer"
                              style={{backgroundImage: 'url(\"data:image/svg+xml,%3csvg xmlns=\'http://www.w3.org/2000/svg\' fill=\'none\' viewBox=\'0 0 20 20\'%3e%3cpath stroke=\'%236b7280\' stroke-linecap=\'round\' stroke-linejoin=\'round\' stroke-width=\'1.5\' d=\'M6 8l4 4 4-4\'/%3e%3c/svg%3e\")', backgroundPosition: 'right 0.5rem center', backgroundRepeat: 'no-repeat', backgroundSize: '1.5em 1.5em', paddingRight: '2.5rem'}}
                            >
                              <option value="professional">专业</option>
                              <option value="casual">轻松</option>
                              <option value="creative">创意</option>
                              <option value="bold">大胆</option>
                            </select>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {error && <div className="mt-4 px-4 py-2.5 bg-red-50 text-red-600 rounded-xl text-xs font-medium">{error}</div>}

                  {/* Generate action row */}
                  <div className="mt-5 flex flex-col md:flex-row md:items-center gap-3 pb-[calc(env(safe-area-inset-bottom)+6px)]">
                    <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-500">
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-white/70 border border-indigo-100 px-3 py-1.5">高级设置</span>
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-white/70 border border-indigo-100 px-3 py-1.5">页数 {pageCount} 页</span>
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-white/70 border border-indigo-100 px-3 py-1.5">{mode === 'smart' ? '省心一键出稿' : '大纲可编辑'}</span>
                    </div>
                    <button
                      onClick={() => { if (!user) { openLogin(); return; } handleGeneratePPT(); }}
                      disabled={!hasInput}
                      className={`md:ml-auto w-full md:w-[260px] h-[52px] rounded-2xl text-[15px] font-black transition-all ${
                        hasInput
                          ? 'sx-primary-btn text-white active:scale-[0.98]'
                          : 'bg-slate-100 text-slate-400 cursor-not-allowed'
                      }`}
                    >
                      ✨ 开始生成 PPT
                    </button>
                  </div>
                  {!hasInput && (
                    <p className="text-xs text-gray-400 text-center md:text-right mt-2">请输入PPT主题或上传文件</p>
                  )}
                  </div>
                </section>

                <div className="mt-12">
                  <div className="sx-glass rounded-[24px] px-4 py-4 sm:px-6 sm:py-5 mb-8">
                    <div>
                      <div>
                        <p className="text-sm sm:text-base font-bold text-gray-900">海报级模板体验，内容与视觉一步到位</p>
                        <p className="text-xs sm:text-sm text-gray-500 mt-1">围绕当前紫蓝主色系，自动完成版式、图像和层次的统一呈现。</p>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-0">
                    <SceneCards />
                    <ProcessSection />
                    <FAQSection />
                    <TestimonialSection />
                  </div>
                  <div className="mt-8">
                    <Footer />
                  </div>
                </div>
              </>
            )}

            {/* V9修复：恢复大纲编辑页（省心模式+专业模式共用） */}
            {phase === 'outline' && outlineResult && (
              <>
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h2 className="text-lg font-bold text-gray-900">{outlineResult?.title}</h2>
                    <p className="text-xs text-gray-400 mt-0.5">共 {editedSlides.length} 页 · 可编辑标题和内容</p>
                  </div>
                  <button onClick={() => { setPhase('input'); setOutlineResult(null); setEditedSlides([]); }} className="text-xs text-gray-400 hover:text-gray-600 transition-colors">← 修改需求</button>
                </div>

                {mode === 'smart' && outlinePreprocess && (outlinePreprocess.truncated || outlinePreprocess.autoAdjusted) && (
                  <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50/70 px-3 py-2.5">
                    <p className="text-xs font-semibold text-amber-700">预处理提示</p>
                    <p className="text-[11px] text-amber-700/90 mt-1">
                      {outlinePreprocess.truncated ? '本次已触发长文本智能截断；' : ''}
                      {outlinePreprocess.autoAdjusted
                        ? `内容处理方式已从「${toTextModeLabel(outlinePreprocess.requestedMode)}」自动调整为「${toTextModeLabel(outlinePreprocess.effectiveMode)}」。`
                        : '内容处理方式未自动调整。'}
                    </p>
                    {outlinePreprocess.autoAdjusted && (
                      <div className="mt-2">
                        <button
                          onClick={rerunOutlineWithPreserve}
                          className="px-3 py-1.5 rounded-lg bg-white border border-amber-300 text-[11px] font-semibold text-amber-700 hover:bg-amber-100 transition-colors"
                        >
                          一键恢复“保持原文”并重生成
                        </button>
                        {forceRequestedModeOnce && (
                          <p className="text-[10px] text-amber-700/80 mt-1">已按“保持原文”方式重新处理。</p>
                        )}
                      </div>
                    )}
                  </div>
                )}

                <div className="space-y-2 mb-4">
                  {editedSlides.map((slide, idx) => (
                    <div
                      key={slide.id}
                      draggable={true}
                      onDragStart={() => handleDragStart(idx)}
                      onDragOver={(e) => handleDragOver(e, idx)}
                      onDrop={() => handleDrop(idx)}
                      onDragEnd={handleDragEnd}
                      className={`bg-white rounded-xl border p-3 group transition-all ${
                        dragIndex === idx
                          ? 'border-[#5B4FE9] bg-[#F5F3FF] opacity-50 scale-[0.98]'
                          : dragOverIndex === idx
                            ? 'border-[#5B4FE9] bg-[#FAF5FF] shadow-md shadow-purple-100/50'
                            : 'border-gray-100 hover:border-[#EDE9FE]'
                      }`}
                    >
                      <div className="flex items-start gap-2">
                        <div className="flex-shrink-0 w-6 h-6 rounded-full bg-[#F5F3FF] text-[#5B4FE9] text-[10px] font-bold flex items-center justify-center mt-0.5">{idx + 1}</div>
                        <div className="flex-1 min-w-0">
                          <input value={slide.title} onChange={e => updateSlide(idx, 'title', e.target.value)}
                            className="w-full text-sm font-semibold text-gray-800 bg-transparent border-b border-transparent focus:border-[#5B4FE9] outline-none py-0.5" />
                          {(slide.content && slide.content.length > 0) && (
                            <textarea value={(slide.content || []).join('\n')} onChange={e => updateSlide(idx, 'content', e.target.value)}
                              rows={Math.min((slide.content || []).length, 4)}
                              className="w-full mt-1 text-xs text-gray-500 bg-gray-50 rounded-lg px-2.5 py-1.5 border border-transparent focus:border-[#5B4FE9] outline-none resize-none" />
                          )}
                        </div>
                        <div className="flex-shrink-0 flex items-center gap-0.5 opacity-60 group-hover:opacity-100 transition-opacity">
                          <button onClick={(e) => { e.stopPropagation(); moveSlide(idx, -1); }} className="w-7 h-7 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 flex items-center justify-center transition-colors active:scale-90" title="上移">
                            <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 15l-6-6-6 6"/></svg>
                          </button>
                          <button onClick={(e) => { e.stopPropagation(); moveSlide(idx, 1); }} className="w-7 h-7 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 flex items-center justify-center transition-colors active:scale-90" title="下移">
                            <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 9l6 6 6-6"/></svg>
                          </button>
                          <button onClick={(e) => { e.stopPropagation(); removeSlide(idx); }} className="w-7 h-7 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 flex items-center justify-center transition-colors active:scale-90" title="删除此页">
                            <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg>
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                  <button onClick={addSlide} className="w-full py-2.5 border border-dashed border-gray-200 rounded-xl text-xs text-gray-400 hover:text-[#5B4FE9] hover:border-[#5B4FE9] transition-colors">+ 添加幻灯片</button>

                  {/* 省心模式AI参数摘要 - 可编辑版 */}
                  {mode === 'smart' && smartGammaPayload && (() => {
                    // 读取当前 smartGammaPayload 里的参数
                    const currentThemeId = smartGammaPayload.themeId || 'consultant';
                    const currentTone = smartGammaPayload.tone || 'professional';
                    const currentImgSrc = smartGammaPayload.imageOptions?.source || 'themeAccent';
                    const currentTheme = getThemeById(currentThemeId);

                    return (
                      <div className="mt-4 bg-gradient-to-br from-[#F5F3FF] to-[#EDE9FE] rounded-xl p-4 border border-purple-100">
                        <div className="flex items-center gap-2 mb-3">
                          <span className="text-sm">🤖</span>
                          <span className="text-xs font-semibold text-[#5B4FE9]">AI 已为你定制最优参数</span>
                          <span className="text-[10px] text-gray-400">（可自行调整）</span>
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          {/* 主题 - 可点击弹出选择器 */}
                          <div
                            className="bg-white/70 rounded-lg px-3 py-2 cursor-pointer hover:bg-white transition-colors"
                            onClick={() => setShowThemePicker(true)}
                            title="点击切换主题"
                          >
                            <p className="text-[11px] font-semibold text-gray-500 mb-1">🎨 主题配色（点击可切换）</p>
                            <div className="rounded-md border border-slate-200 bg-white px-2 py-2">
                              <div
                                className="relative h-16 rounded-md border border-slate-200 overflow-hidden p-2"
                                style={{ backgroundColor: (currentTheme?.colors || ['#6366F1', '#8B5CF6', '#A78BFA'])[0] }}
                              >
                                <span
                                  className="absolute right-2 top-2 px-2 py-0.5 rounded text-[9px] font-semibold border border-white/40"
                                  style={{
                                    backgroundColor: (currentTheme?.colors || ['#6366F1', '#8B5CF6', '#A78BFA'])[1],
                                    color: (currentTheme?.colors || ['#6366F1', '#8B5CF6', '#A78BFA'])[2],
                                  }}
                                >
                                  强调色
                                </span>
                                <span
                                  className="absolute left-2 bottom-2 text-sm font-bold"
                                  style={{ color: (currentTheme?.colors || ['#6366F1', '#8B5CF6', '#A78BFA'])[2] }}
                                >
                                  省心PPT
                                </span>
                              </div>
                              <div className="mt-1.5 grid grid-cols-3 gap-1 text-[9px] text-slate-400">
                                <span className="truncate">背景 {(currentTheme?.colors || ['#6366F1', '#8B5CF6', '#A78BFA'])[0]}</span>
                                <span className="truncate">强调 {(currentTheme?.colors || ['#6366F1', '#8B5CF6', '#A78BFA'])[1]}</span>
                                <span className="truncate">字体 {(currentTheme?.colors || ['#6366F1', '#8B5CF6', '#A78BFA'])[2]}</span>
                              </div>
                            </div>
                            <div className="mt-1.5 text-xs font-medium text-gray-700">
                              {currentTheme?.name || currentThemeId}
                            </div>
                          </div>
                          {/* 语气 - 分段可切换 */}
                          <div className="bg-white/70 rounded-lg px-3 py-2">
                            <p className="text-[10px] text-gray-400 mb-1">🎭 语气</p>
                            <div className="flex flex-wrap gap-1">
                              {(['professional','casual','creative','bold','traditional'] as const).map(t => (
                                <button
                                  key={t}
                                  onClick={() => {
                                    setTone(t);
                                    setSmartToneTouched(true);
                                    setSmartGammaPayload((prev: any) => prev ? {
                                      ...prev,
                                      tone: t,
                                      gammaPayload: prev.gammaPayload ? { ...prev.gammaPayload, tone: t, textOptions: { ...prev.gammaPayload.textOptions, tone: t } } : undefined,
                                    } : prev);
                                  }}
                                  className={`px-1.5 py-0.5 rounded-md text-[9px] font-medium transition-all ${
                                    currentTone === t
                                      ? 'bg-[#5B4FE9] text-white'
                                      : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                                  }`}
                                >
                                  {{ professional:'专业', casual:'轻松', creative:'创意', bold:'大胆', traditional:'传统' }[t]}
                                </button>
                              ))}
                            </div>
                          </div>
                          {/* 配图 - 分段可切换 */}
                          <div className="bg-white/70 rounded-lg px-3 py-2">
                            <p className="text-[10px] text-gray-400 mb-1">🖼️ 配图</p>
                            <div className="flex flex-wrap gap-1">
                              {(['noImages','themeAccent','pexels','aiGenerated'] as const).map(src => (
                                <button
                                  key={src}
                                  onClick={() => {
                                    setImgMode(gammaSourceToAppMode(src));
                                    setSmartImageTouched(true);
                                    setSmartGammaPayload((prev: any) => prev ? {
                                      ...prev,
                                      imageOptions: { ...prev.imageOptions, source: src },
                                      gammaPayload: prev.gammaPayload ? { ...prev.gammaPayload, imageOptions: { ...prev.gammaPayload.imageOptions, source: src } } : undefined,
                                    } : prev);
                                  }}
                                  className={`px-1.5 py-0.5 rounded-md text-[9px] font-medium transition-all ${
                                    currentImgSrc === src
                                      ? 'bg-[#5B4FE9] text-white'
                                      : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                                  }`}
                                >
                                  {{ noImages:'极简无图', themeAccent:'主题套图', pexels:'Pexels图库', aiGenerated:'AI图 ✨' }[src]}
                                </button>
                              ))}
                            </div>
                          </div>
                          {/* 页数 - 只读 */}
                          <div className="bg-white/70 rounded-lg px-3 py-2">
                            <p className="text-[10px] text-gray-400 mb-0.5">📄 页数</p>
                            <p className="text-xs font-medium text-gray-700">{editedSlides.length} 页</p>
                          </div>
                        </div>
                        <p className="text-[10px] text-purple-400 mt-2">✨ 点击主题/语气/配图可直接修改 · 对话修改大纲功能（预留）</p>
                      </div>
                    );
                  })()}

                  {/* Outline 下一步按钮：始终显示，加载时禁用，避免偶发“按钮消失” */}
                  <div className="mt-4 sticky bottom-3 z-10">
                    <button
                      onClick={handleConfirmGenerate}
                      disabled={loading}
                      className={`w-full py-3 rounded-xl text-sm font-semibold shadow-md transition-all ${
                        loading
                          ? 'bg-gray-100 text-gray-400 cursor-not-allowed shadow-none'
                          : 'bg-gradient-to-r from-[#5B4FE9] to-[#8B5CF6] text-white shadow-purple-200/50 hover:shadow-lg hover:shadow-purple-300/50 active:scale-[0.98]'
                      }`}
                    >
                      {loading ? '处理中，请稍候...' : '下一步：生成PPT'}
                    </button>
                  </div>
                </div>

                {error && <div className="mb-4 px-3 py-2 bg-red-50 text-red-500 rounded-lg text-xs">❌ {error}</div>}
              </>
            )}
          </div>

          {/* Floating button removed — generate is now inline in the input row */}
        </div>
      )}

      {/* ===== STREAMING OUTLINE ===== */}
      {phase === 'streaming' && (
        <div className="flex-1 sx-shell">
          <div className="max-w-5xl mx-auto px-4 md:px-8 pt-5 pb-20">
            <button
              onClick={() => { setPhase('input'); setLoading(false); clearPersistedResumeState(); }}
              className="flex items-center gap-2 text-xs text-slate-500 hover:text-indigo-600 mb-5 transition-colors"
            >
              ← 返回输入
            </button>

            <div className="sx-glass-strong rounded-[30px] p-4 md:p-7">
              <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4 mb-5">
                <div>
                  <p className="inline-flex items-center gap-2 rounded-full bg-white/70 border border-indigo-100 px-3 py-1 text-[11px] font-bold text-indigo-600">
                    {OUTLINE_STAGE_META[outlineStage].label}
                  </p>
                  <h2 className="mt-3 text-2xl md:text-3xl font-black text-slate-900">AI 正在生成大纲</h2>
                  <p className="mt-1 text-xs md:text-sm text-slate-500">
                    {stepText || OUTLINE_STAGE_META[outlineStage].hint}
                  </p>
                </div>
                <div className="text-left md:text-right">
                  <p className="text-3xl font-black sx-accent-text">{Math.round(outlineDisplayProgress)}%</p>
                  <p className="text-[11px] text-slate-400 mt-1">已生成 {outlineGeneratedPages} / {outlineTargetPages} 页</p>
                </div>
              </div>

              <div className="h-3 rounded-full bg-indigo-100/70 overflow-hidden border border-indigo-100 mb-5">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-[#2f86ff] via-[#6c5cff] to-[#8b35ff] transition-all duration-700 shadow-[0_0_24px_rgba(104,92,255,0.45)]"
                  style={{ width: `${Math.round(outlineDisplayProgress)}%` }}
                />
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-5">
                {(['analyzing', 'planning', 'generating', 'polishing'] as OutlineStageKey[]).map((key) => {
                  const isCurrent = key === outlineStage;
                  const done = ['analyzing', 'planning', 'generating', 'polishing'].indexOf(key) < ['analyzing', 'planning', 'generating', 'polishing'].indexOf(outlineStage);
                  return (
                    <div
                      key={key}
                      className={`rounded-2xl border p-3 transition-all ${
                        isCurrent
                          ? 'bg-gradient-to-r from-indigo-50 to-violet-50 border-indigo-200 shadow-[0_8px_30px_rgba(103,80,255,0.18)]'
                          : done
                            ? 'bg-white/80 border-indigo-100'
                            : 'bg-white/50 border-slate-100'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <span className={`w-7 h-7 rounded-xl flex items-center justify-center ${done ? 'bg-emerald-500 text-white' : isCurrent ? 'bg-gradient-to-br from-[#2f86ff] to-[#8b35ff] text-white' : 'bg-indigo-50 text-indigo-300'}`}>
                          {done ? (
                            <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M5 13l4 4L19 7" /></svg>
                          ) : (
                            <svg className={`w-3.5 h-3.5 ${isCurrent ? 'animate-pulse' : ''}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d={OUTLINE_STAGE_META[key].icon} /></svg>
                          )}
                        </span>
                        <p className={`text-xs font-bold ${isCurrent ? 'text-indigo-700' : done ? 'text-emerald-600' : 'text-slate-400'}`}>
                          {OUTLINE_STAGE_META[key].label}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>

              {streamingSlides.length > 0 ? (
                <div className="rounded-[22px] border border-indigo-100 bg-white/75 p-3 md:p-4">
                  <StreamingOutline slides={streamingSlides} />
                </div>
              ) : (
                <div className="rounded-[22px] border border-indigo-100 bg-white/75 p-4 md:p-6">
                  <div className="space-y-3">
                    {[0, 1, 2, 3].map((row) => (
                      <div key={row} className="animate-pulse space-y-2" style={{ animationDelay: `${row * 120}ms` }}>
                        <div className="h-4 bg-gradient-to-r from-indigo-100 via-violet-100 to-indigo-100 rounded-lg w-4/5" />
                        <div className="h-3 bg-indigo-50 rounded-lg w-2/5" />
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ===== GENERATING PROGRESS ===== */}
      {phase === 'generating' && loading && (
        <GenerationProgress currentStep={genStep} progress={genProgress} subtext={stepText} />
      )}

      {/* ===== RESULT — 结果页面（新设计） ===== */}
      {phase === 'result' && result && !loading && (
        <div className="flex-1 bg-gradient-to-b from-purple-50/30 to-white">
          <div className="max-w-[1400px] mx-auto px-3 md:px-6 pt-6 md:pt-8 pb-16">
            {/* 成功提示 */}
            <div className="text-center mb-5">
              <div className="text-5xl mb-2">🎉</div>
              <h2 className="text-2xl md:text-3xl font-black text-slate-900 mb-1">PPT 已生成</h2>
              <p className="text-sm text-slate-500">{result.title || '演示文稿'} · {result.actualPages || pageCount} 页</p>
            </div>

            {/* 导出与预览（结果页内自动加载） */}
            <div className="sx-glass-strong rounded-[28px] shadow-xl border border-indigo-100/70 overflow-hidden mb-6">
              <div className="bg-gradient-to-r from-purple-50/90 to-indigo-50/90 px-4 py-2.5 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-green-500">✓</span>
                  <span className="text-xs text-slate-600">文稿已生成 · {result.actualPages || pageCount} 页</span>
                </div>
                <button
                  onClick={() => {
                    previewLoadedGenerationRef.current = '';
                    void loadInlinePreview();
                  }}
                  className="px-3 py-1.5 text-xs text-purple-600 hover:text-purple-800 hover:bg-purple-100 rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  disabled={!result.generationId || exporting || previewLoading}
                >
                  {previewLoading ? '预览加载中...' : '刷新预览'}
                </button>
              </div>

              <div className="p-3 md:p-5">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-3">
                  <p className="text-sm text-slate-600">在线预览（滚动查看）</p>
                  <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                    <button
                      onClick={handleExportPDF}
                      disabled={!result.generationId || exportingPdf}
                      className="px-4 py-2.5 bg-white text-indigo-600 border border-indigo-200 rounded-xl text-sm font-bold hover:bg-indigo-50 transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {exportingPdf ? (
                        <div className="w-4 h-4 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
                      ) : '🧾'}
                      免费导出 PDF
                    </button>
                    <button
                      onClick={handleExportPPT}
                      disabled={!result.generationId || exporting}
                      className="px-4 py-2.5 bg-gradient-to-r from-orange-500 to-red-500 text-white rounded-xl text-sm font-bold shadow-lg shadow-orange-200/40 hover:shadow-xl active:scale-[0.98] transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {exporting ? (
                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                      ) : '📄'}
                      下载 PPTX
                    </button>
                  </div>
                </div>

                <div className="flex items-center justify-between mb-2 px-1">
                  <p className="text-xs text-slate-400">共 {previewTotalPages} 页 · 支持滚动预览</p>
                  <div className="text-xs text-slate-400">电脑/手机均可横竖屏查看</div>
                </div>

                <div className="relative rounded-2xl overflow-hidden border border-indigo-100 bg-[#0f1020] md:min-h-[78vh]">
                  {previewLoading ? (
                    <div className="w-full min-h-[62vh] md:min-h-[78vh] flex items-center justify-center text-white text-sm">
                      正在加载 PDF 预览...
                    </div>
                  ) : previewError ? (
                    <div className="w-full min-h-[62vh] md:min-h-[78vh] flex flex-col items-center justify-center text-white gap-4 px-6 text-center">
                      <p className="text-sm text-red-300">{previewError}</p>
                      <button
                        onClick={() => {
                          previewLoadedGenerationRef.current = '';
                          void loadInlinePreview();
                        }}
                        className="px-4 py-2 rounded-lg bg-white/10 hover:bg-white/20 text-sm"
                      >
                        重试预览
                      </button>
                    </div>
                  ) : previewPdfUrl ? (
                    <ResponsivePdfPreview
                      src={previewPdfUrl}
                      fetchSrc={previewPdfFetchUrl}
                      title={result?.title || 'PDF 预览'}
                    />
                  ) : (
                    <div className="w-full min-h-[62vh] md:min-h-[78vh] flex items-center justify-center text-white text-sm">
                      暂无可预览内容
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* 底部操作按钮 */}
            <div className="flex items-center justify-center gap-4">
              <button
                onClick={backToOutline}
                className="px-6 py-2.5 text-gray-600 hover:text-purple-600 hover:bg-purple-50 rounded-xl text-sm font-medium transition-all"
              >
                ✏️ 修改大纲
              </button>
              <button
                onClick={reset}
                className="px-6 py-2.5 text-gray-600 hover:text-purple-600 hover:bg-purple-50 rounded-xl text-sm font-medium transition-all"
              >
                ➕ 继续创建
              </button>
            </div>
          </div>
        </div>
      )}

      {payPerDownload && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 backdrop-blur-sm px-4">
          <div className="w-full max-w-md rounded-3xl border border-indigo-100 bg-white shadow-2xl overflow-hidden">
            <div className="h-1.5 bg-gradient-to-r from-[#5B4FE9] via-[#7C3AED] to-[#8B5CF6]" />
            <div className="p-6">
              <h3 className="text-lg font-bold text-slate-900 mb-2">下载权限说明</h3>
              <p className="text-sm text-slate-600 mb-5">
                免费用户本次下载需按页付费：{payPerDownload.pageCount} 页，约 ¥{payPerDownload.cost.toFixed(2)}。
              </p>
              <div className="rounded-2xl border border-indigo-100 bg-indigo-50/60 p-3 mb-5 text-xs text-slate-600">
                单次付费与开通会员二选一。开通会员后可不限次下载 PPTX。
              </div>
              <div className="space-y-2">
                <button
                  onClick={handleOneTimeDownload}
                  disabled={payingOnce}
                  className="w-full py-3 rounded-xl bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-700 transition-all disabled:opacity-60"
                >
                  {payingOnce ? '处理中...' : '单次付费下载（按页）'}
                </button>
                <button
                  onClick={() => {
                    setPayPerDownload(null);
                    openPayment({
                      id: 'shengxin',
                      name: '省心会员',
                      price: '¥19.9/月',
                      billing: 'monthly',
                      reason: `当前下载需 ¥${payPerDownload.cost.toFixed(2)}，开通会员可不限次下载`,
                    });
                  }}
                  className="w-full py-3 rounded-xl bg-gradient-to-r from-[#5B4FE9] to-[#8B5CF6] text-white text-sm font-semibold hover:opacity-95 transition-all"
                >
                  开通会员更省心
                </button>
                <button
                  onClick={() => setPayPerDownload(null)}
                  className="w-full py-2 text-xs text-slate-500 hover:text-slate-700 transition-colors"
                >
                  暂不下载
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ===== MODALS ===== */}
      <ProPanel
        open={showPro && mode === 'smart'}
        onClose={() => setShowPro(false)}
        genMode={genMode} setGenMode={(v) => { setGenMode(v); if (v === 'preserve') setStrictPreserve(true); }}
        theme={theme} setTheme={(v) => { setTheme(v); setSmartThemeTouched(true); }}
        tone={tone} setTone={(v) => { setTone(v); setSmartToneTouched(true); }}
        imgMode={imgMode} setImgMode={(v) => { setImgMode(v); setSmartImageTouched(true); }}
        pages={pageCount} setPages={setPageCount}
      />

      <LoginModal open={showLogin} onClose={closeLogin} />
      <PaymentModal open={showPayment} onClose={closePayment} plan={paymentPlan} />
      <ThemePickerModal
        open={showThemePicker}
        currentThemeId={smartGammaPayload?.themeId || 'consultant'}
        currentTone={smartGammaPayload?.tone || 'professional'}
        currentImgSrc={smartGammaPayload?.imageOptions?.source || 'themeAccent'}
        onThemeChange={(themeId) => {
          setTheme(themeId);
          setSmartThemeTouched(true);
          setSmartGammaPayload((prev: any) => prev ? {
            ...prev,
            themeId,
            gammaPayload: prev.gammaPayload ? { ...prev.gammaPayload, themeId } : undefined,
          } : prev);
        }}
        onToneChange={(tone) => {
          setTone(tone);
          setSmartToneTouched(true);
          setSmartGammaPayload((prev: any) => prev ? {
            ...prev,
            tone,
            gammaPayload: prev.gammaPayload ? { ...prev.gammaPayload, tone, textOptions: { ...prev.gammaPayload.textOptions, tone } } : undefined,
          } : prev);
        }}
        onImgChange={(imgSrc) => {
          const normalizedSource = toGammaImageSource(imgSrc);
          setSmartGammaPayload((prev: any) => prev ? {
            ...prev,
            imageOptions: { ...prev.imageOptions, source: normalizedSource },
            gammaPayload: prev.gammaPayload ? { ...prev.gammaPayload, imageOptions: { ...prev.gammaPayload.imageOptions, source: normalizedSource } } : undefined,
          } : prev);
          setImgMode(gammaSourceToAppMode(normalizedSource));
          setSmartImageTouched(true);
        }}
        onClose={() => setShowThemePicker(false)}
      />


    </div>
  );
}
