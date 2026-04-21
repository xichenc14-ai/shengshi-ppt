'use client';

import React, { useState, useCallback, useRef, useEffect } from 'react';
import { useAuth } from '@/lib/auth-context';
import { useRouter } from 'next/navigation';

import Navbar from '@/components/Navbar';
import AnnouncementBar, { getLatestAnnouncement } from '@/components/AnnouncementBar';
import HeroSection from '@/components/HeroSection';
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
// FloatingButton removed (unused)
import SkeletonCard from '@/components/SkeletonCard';
import ThemeSelector from '@/components/ThemeSelector';
import ScrollingBanner from '@/components/ScrollingBanner';
import { buildMdV2, buildAdditionalInstructions } from '@/lib/build-md-v2';
import { validateInput, LIMITS } from '@/lib/input-validation';
import { getThemeById } from '@/lib/theme-database';
import { checkPermission, mapImgModeToSource, getPlan, PLAN_LIST } from '@/lib/membership';

/* ==================== Config ==================== */

export const dynamic = 'force-dynamic';

const GEN_MODES_MAP: Record<string, string> = { generate: 'generate', condense: 'condense', preserve: 'preserve' };

const HOT_SCENES = [
  { label: '📊 工作汇报', text: '本周工作汇报，包含完成任务、问题分析、下周计划' },
  { label: '💼 商业方案', text: '咖啡品牌市场推广方案PPT' },
  { label: '🎓 教学课件', text: '初中数学《勾股定理》教学课件' },
  { label: '📋 年终总结', text: '2025年度工作总结，包含主要成绩、数据亮点和明年规划' },
];

type UploadedFile = { name: string; type: string; size: number; content?: string };
type SlideItem = { id: string; title: string; content?: string[]; notes?: string };

// buildMd 已替换为 buildMdV2（lib/build-md-v2.ts）
// 在 confirmAndGenerate 中直接传 slides 给 /api/gamma

export default function Home() {
  const { user, showLogin, showPayment, paymentPlan, openPayment, openLogin, closeLogin, closePayment, updateCredits } = useAuth();
  const router = useRouter();

  // Dual-track mode
  const [mode, setMode] = useState<'direct' | 'smart'>('direct');
  const [directTheme, setDirectTheme] = useState('consultant');
  const [directTone, setDirectTone] = useState('professional');
  const [directImgMode, setDirectImgMode] = useState('theme-img');
  const [directTextMode, setDirectTextMode] = useState<'generate' | 'condense' | 'preserve'>('generate');

  // Landing page vs generate flow
  const [phase, setPhase] = useState<'landing' | 'input' | 'streaming' | 'outline' | 'generating' | 'direct-generating' | 'result'>('landing');

  // Input state
  const [topic, setTopic] = useState('');
  const [files, setFiles] = useState<UploadedFile[]>([]);
  const [hasInput, setHasInput] = useState(false);

  // Pro mode
  const [showPro, setShowPro] = useState(false);

  const [genMode, setGenMode] = useState('generate');
  const [theme, setTheme] = useState('auto');
  const [tone, setTone] = useState('professional');
  const [imgMode, setImgMode] = useState('theme-img');
  const [pages, setPages] = useState(8);

  // Generation state
  const [loading, setLoading] = useState(false);

  const [showThemePicker, setShowThemePicker] = useState(false);
  const [error, setError] = useState('');
  const [stepText, setStepText] = useState('');
  const [genProgress, setGenProgress] = useState(0);
  const [genStep, setGenStep] = useState(0);

  // Outline & 省心模式 Payload
  const [outlineResult, setOutlineResult] = useState<{ title: string; slides: SlideItem[]; themeId?: string; tone?: string; imageMode?: string } | null>(null);
  const [smartGammaPayload, setSmartGammaPayload] = useState<any>(null); // 省心模式 AI 生成的完整参数
  const [editedSlides, setEditedSlides] = useState<SlideItem[]>([]);
  const [streamingSlides, setStreamingSlides] = useState<SlideItem[]>([]);

  // Drag-and-drop state for outline reordering
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

  // Result
  const [result, setResult] = useState<{ title: string; slides: SlideItem[]; pptxUrl: string; gammaUrl?: string; actualPages?: number; generationId?: string } | null>(null);
  const [showPreview, setShowPreview] = useState(false); // 预览弹窗状态
  const [previewPdfUrl, setPreviewPdfUrl] = useState<string | null>(null); // PDF预览URL（从Gamma导出）
  const [previewLoading, setPreviewLoading] = useState(false);
  const [pdfPage, setPdfPage] = useState(1); // PDF当前页
  const [pdfTotalPages, setPdfTotalPages] = useState(1); // PDF总页数
  const [exporting, setExporting] = useState(false); // 导出PPTX中
  const [pdfExporting, setPdfExporting] = useState(false); // 导出PDF中

  const fileRef = useRef<HTMLInputElement>(null);

  const collectText = useCallback(() => {
    const p: string[] = [];
    files.forEach(f => p.push(f.content ? `[${f.name}]\n${f.content}` : `[${f.name}]`));
    if (topic.trim()) p.push(topic.trim());
    return p.join('\n\n');
  }, [files, topic]);

  // 🚨 P0 Fix: 构建 preserve 模式的 Markdown（忠实呈现用户原文，不做 AI 提炼）
  // 原则：用户写什么，PPT 就呈现什么。只需要加基础 markdown 结构（分页、标题）。
  function buildPreserveMarkdown(rawText: string, pageCount: number): string {
    if (!rawText || !rawText.trim()) return '# PPT\n\n---\n\n## 内容\n\n请添加内容';

    const sections: string[] = [];

    // 如果已有 --- 分页符，直接使用
    if (rawText.includes('---')) {
      const pages = rawText.split(/\n*---\n*/).filter(p => p.trim());
      if (pages.length > 0) {
        // 第一页作为封面
        const first = pages[0].trim();
        const firstLine = first.split('\n')[0].replace(/^#+\s*/, '');
        sections.push(`# ${firstLine}\n\n${first}`);
        // 其余页
        for (let i = 1; i < pages.length; i++) {
          const pg = pages[i].trim();
          if (!pg) continue;
          const lines = pg.split('\n');
          const title = lines[0].replace(/^#+\s*/, '');
          const body = lines.slice(1).join('\n').trim();
          sections.push(`## ${title}\n\n${body}\n\n---\n`);
        }
        return sections.join('\n');
      }
    }

    // 否则按段落/换行智能分页（每页 ≈ 总长度/pageCount）
    const paragraphs = rawText.split(/\n\n+/).filter(p => p.trim());
    const totalLen = paragraphs.reduce((s, p) => s + p.length, 0);
    const targetPerPage = Math.max(200, Math.floor(totalLen / pageCount));

    let currentPage: string[] = [];
    let currentLen = 0;
    const pages: string[][] = [];

    for (const para of paragraphs) {
      if (currentLen + para.length > targetPerPage && currentPage.length > 0) {
        pages.push([...currentPage]);
        currentPage = [];
        currentLen = 0;
      }
      currentPage.push(para);
      currentLen += para.length;
    }
    if (currentPage.length > 0) pages.push(currentPage);

    // 构建 markdown
    const firstPageContent = pages[0]?.join('\n\n') || rawText;
    const firstLine = firstPageContent.split('\n')[0].replace(/^#+\s*/, '');
    sections.push(`# ${firstLine}\n\n${firstPageContent}`);

    for (let i = 1; i < pages.length; i++) {
      const pgText = pages[i].join('\n\n');
      const lines = pgText.split('\n');
      const title = lines[0].replace(/^#+\s*/, '').slice(0, 30) || `第${i + 1}页`;
      const body = lines.slice(1).join('\n').trim();
      sections.push(`\n---\n\n## ${title}\n\n${body}`);
    }

    return sections.join('\n');
  }

  // 🚨 V6新增：积分回滚工具（生成失败/超时时调用）
  const rollbackCredits = useCallback(async (credits: number, reason: string) => {
    if (!user || credits <= 0) return;
    try {
      const res = await fetch('/api/user', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
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

  // Track hasInput
  useEffect(() => { setHasInput(files.length > 0 || topic.trim().length > 0); }, [files, topic]);

  // ===== PDF 预览渲染（pdf.js，16:9 强制单页 + 翻页控制） =====
  const pdfDocRef = useRef<any>(null);

  // previewPdfUrl 变化 → 加载 PDF 文档
  useEffect(() => {
    if (!previewPdfUrl) return;
    setPreviewLoading(true);
    import('pdfjs-dist/legacy/build/pdf.mjs').then(async ({ getDocument }) => {
      try {
        const loadingTask = previewPdfUrl.startsWith('blob:') || previewPdfUrl.startsWith('data:')
          ? getDocument({ url: previewPdfUrl })
          : getDocument({ url: previewPdfUrl });
        const doc = await loadingTask.promise;
        pdfDocRef.current = doc;
        setPdfTotalPages(doc.numPages);
        setPdfPage(1);
      } catch (e) { console.warn('[PDF] 加载失败:', e); }
      setPreviewLoading(false);
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [previewPdfUrl]);

  // pdfPage 变化 → 渲染当前页（16:9 强制适配）
  useEffect(() => {
    if (!pdfDocRef.current) return;
    const doc = pdfDocRef.current;
    const pageNum = Math.min(Math.max(1, pdfPage), pdfTotalPages);
    doc.getPage(pageNum).then((page: any) => {
      const canvas = document.getElementById('pdf-canvas') as HTMLCanvasElement;
      if (!canvas) return;
      // 16:9 强制适配：宽度撑满容器，高度按比例计算
      const containerW = canvas.parentElement?.clientWidth || window.innerWidth * 0.9;
      const targetRatio = 16 / 9;
      let scale = containerW / page.getViewport({ scale: 1 }).width;
      // 限制在合理范围
      scale = Math.min(scale, 2.5);
      const viewport = page.getViewport({ scale });
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      const ctx = canvas.getContext('2d');
      page.render({ canvasContext: ctx, viewport }).promise;
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pdfPage, pdfTotalPages]);

  // 窗口变化时重新渲染当前页（保持 16:9 适配）
  useEffect(() => {
    if (!pdfDocRef.current) return;
    const handler = () => {
      if (!pdfDocRef.current) return;
      const pageNum = Math.min(Math.max(1, pdfPage), pdfTotalPages);
      pdfDocRef.current.getPage(pageNum).then((page: any) => {
        const canvas = document.getElementById('pdf-canvas') as HTMLCanvasElement;
        if (!canvas) return;
        const containerW = canvas.parentElement?.clientWidth || window.innerWidth * 0.9;
        const scale = Math.min(containerW / page.getViewport({ scale: 1 }).width, 2.5);
        const viewport = page.getViewport({ scale });
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        const ctx = canvas.getContext('2d');
        page.render({ canvasContext: ctx, viewport }).promise;
      });
    };
    window.addEventListener('resize', handler);
    return () => window.removeEventListener('resize', handler);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pdfPage, pdfTotalPages]);

  // 🚨 V9.1 (架构师修复版): 彻底抛弃 setTimeout，采用状态驱动与防竞态设计
  useEffect(() => {
    // 只有当生成完成且进入 result 页面时，才触发自动预览
    if (phase !== 'result' || !result?.gammaUrl || !result?.generationId) return;

    let isMounted = true; // 防竞态标志

    // 1. 立即响应状态变化，打开弹窗并显示 Loading，不依赖不可靠的时间猜测
    setShowPreview(true);
    setPreviewLoading(true);
    setPreviewPdfUrl(null);

    // 2. 异步获取 PDF 渲染流
    const fetchPreview = async () => {
      try {
        const r = await fetch(`/api/preview-pdf?generationId=${result.generationId}`);
        if (!r.ok) throw new Error('获取预览链接失败');
        const data = await r.json();

        if (data.pdfUrl && isMounted) {
          const pdfRes = await fetch(`/api/export?url=${encodeURIComponent(data.pdfUrl)}&name=preview.pdf`);
          if (!pdfRes.ok) throw new Error('PDF 数据流代理失败');
          const blob = await pdfRes.blob();

          if (isMounted) {
            setPreviewPdfUrl(URL.createObjectURL(blob));
            setPreviewLoading(false);
          }
        } else if (isMounted) {
          setPreviewLoading(false);
        }
      } catch (e) {
        console.warn('[Preview] 自动加载预览异常:', e);
        if (isMounted) {
          setPreviewLoading(false);
          // 这里可以静默失败，因为弹窗已经打开，用户仍然可以点击下载按钮
        }
      }
    };fetchPreview();

    // 3. 卸载清理：如果用户关闭弹窗或重新生成，立即切断旧的网络请求状态更新
    return () => {
      isMounted = false;};
  }, [phase, result?.generationId, result?.gammaUrl]); // 补全依赖项

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

  // Direct mode: generate directly without outline editing
  const generateDirect = useCallback(async () => {
    const inputText = collectText();
    if (!inputText.trim()) return;
    if (!user) return;

    // 🔐 会员权限检查（用实际最大页数，避免state不同步问题）
    const userPlan = getPlan(user.plan_type || 'free');
    const effectivePages = Math.min(pages, userPlan.maxPages);
    const imageSource = mapImgModeToSource(directImgMode);
    const perm = checkPermission(user.plan_type || 'free', {
      numPages: effectivePages,
      imageSource,
      mode: 'direct',
    });
    if (!perm.allowed) {
      setError(perm.reason || '当前套餐权限不足');
      const reqPlan = perm.requiredPlan || 'basic';
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
    setError('');
    setPhase('direct-generating');
    setGenStep(0);
    setGenProgress(10);
    setStepText('AI 正在提交生成任务...');

    // 🚨 V6新增：计算待扣积分（用于回滚，提前声明避免catch作用域问题）
    const BASE_CREDIT_PER_PAGE = 2;
    const imgCreditsPerImg = directImgMode === 'ai' || directImgMode === 'ai-pro' ? 2 : 0;
    const estImgCount = Math.ceil(effectivePages / 2);
    const creditsToDeduct = effectivePages * BASE_CREDIT_PER_PAGE + estImgCount * imgCreditsPerImg;

    try {

      // Step 0: Deduct credits
      const deductRes = await fetch('/api/user', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'deduct', userId: user.id, numPages: effectivePages, imageSource: directImgMode === 'none' ? 'noImages' : directImgMode === 'theme' ? 'pictographic' : directImgMode === 'theme-img' ? 'themeAccent' : directImgMode === 'web' ? 'webFreeToUseCommercially' : directImgMode === 'ai' ? 'aiGenerated' : directImgMode === 'ai-pro' ? 'aiGenerated' : 'pictographic' }),
      });
      const deductData = await deductRes.json();
      if (!deductRes.ok || deductData.error) {
        if (deductData.error === '积分不足') {
          setLoading(false);
          setPhase('input');
          openPayment({
            id: 'basic',
            name: '积分不足，请充值',
            price: '¥29.9/月',
            billing: 'monthly',
            reason: '积分不足，无法生成PPT',
            neededCredits: deductData.needed,
            currentCredits: deductData.balance,
          });
          return;
        }
        throw new Error(deductData.error || '积分扣除失败');
      }
      const updatedUser = { ...user, credits: deductData.balance };
      updateCredits(deductData.balance);
      setGenStep(1);
      setGenProgress(25);
      setStepText('AI 正在渲染 PPT 页面...');

      // 🚨 V9修复：preserve 模式需要确保有分页符
      let finalInputText = inputText;
      if (directTextMode === 'preserve' && !inputText.includes('---')) {
        finalInputText = buildPreserveMarkdown(inputText, pages);
      }

      const gRes = await fetch('/api/gamma-direct', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          inputText: finalInputText,
          themeId: directTheme,
          numCards: pages,
          imageSource: directImgMode,
          tone: directTone,
          textMode: directTextMode,
          exportAs: 'pptx',
        }),
      });
      // 先读取响应文本，再尝试解析 JSON
      const gText = await gRes.text();
      if (!gRes.ok) {
        let errMsg = 'PPT 生成失败';try { const d = JSON.parse(gText); errMsg = d.error || errMsg; } catch {}
        throw new Error(errMsg);
      }
      let gd;
      try { gd = JSON.parse(gText); } catch { throw new Error('Gamma响应格式错误，请重试'); }

      if (gd.generationId) {
        // API 是异步的，需要前端轮询状态
        setGenStep(2);
        setGenProgress(50);
        setStepText('正在等待 AI 渲染 PPT...');

        const startTime = Date.now();
        const pollInterval = 3000; // 🚨 优化：缩短轮询间隔，快速响应
        let finalExportUrl = '';
        let finalGammaUrl = '';
        let lastStatusData: any = null;

        while (Date.now() - startTime < 180000) { // 🚨 优化：延长超时到3分钟（复杂PPT需要更多时间）
          await new Promise(r => setTimeout(r, pollInterval));

          const statusRes = await fetch(`/api/gamma?id=${gd.generationId}`);
          if (!statusRes.ok) continue;

          const statusData = await statusRes.json();

          if (statusData.status === 'completed') {
            finalExportUrl = statusData.exportUrl || '';
            lastStatusData = statusData;
            setGenProgress(90);
            setStepText('PPT 生成完成，准备下载...');
            break;
          }

          if (statusData.status === 'failed') {
            throw new Error(statusData.error || '生成失败');
          }

          const elapsed = Math.floor((Date.now() - startTime) / 1000);
          setStepText(`AI 渲染中... ${elapsed}秒`);
        }

        if (!finalExportUrl && !lastStatusData?.gammaUrl) {
          throw new Error('生成超时（3分钟），PPT内容较复杂，请稍后重试');
        }

        await new Promise(r => setTimeout(r, 500));
        const topicText = inputText.split('\n')[0].replace(/^#\s*/, '').trim();
        setResult({ title: topicText || 'PPT', slides: [], pptxUrl: finalExportUrl, gammaUrl: lastStatusData?.gammaUrl || '', actualPages: pages, generationId: gd.generationId });
        setGenProgress(100);
        setPhase('result');

        // 🆕 保存生成历史
        try {
          await fetch('/api/history', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'save', userId: user.id, title: topicText || 'PPT', slides: [], themeId: directTheme, downloadUrl: finalExportUrl, pageCount: pages, imageMode: directImgMode }),
          });
        } catch (e) { console.warn('[History] 保存失败:', e); }
      }
    } catch (e: any) {
      // 🚨 V6新增：生成失败/超时时回滚积分
      rollbackCredits(creditsToDeduct, e.message || '生成失败');
      setError(e.message);
      setPhase('input');
    }
    setLoading(false);
  }, [user, collectText, directTheme, directTone, directImgMode, directTextMode, pages, openPayment, rollbackCredits]);

  // 🚨 V6 标准化：所有模式统一走 outline API → 大纲确认 → Gamma
  const generateOutline = useCallback(async () => {
    const inputText = collectText();
    if (!inputText.trim()) return;

    // V7 输入校验
    const validation = validateInput(topic, files);
    if (!validation.valid) {
      setError(validation.errors[0]);
      return;
    }

    setLoading(true);
    setError('');
    setPhase('streaming');
    setGenStep(0);
    setGenProgress(10);
    setStepText('AI 正在分析你的需求...');

    try {
      // ====== V7 统一流程：所有模式走 outline → 编辑 → 生成 ======
      // · 专业模式扩充 (genMode='generate') → textMode='generate'
      // · 专业模式缩减 (genMode='condense') → textMode='condense'
      // · 专业模式保持 (genMode='preserve') → textMode='preserve'
      // · 省心定制 (mode='smart')           → textMode='preserve' + auto=true
      // 专业模式使用 directTextMode，省心模式固定 preserve
      const effectiveTextMode = mode === 'direct' ? directTextMode : 'preserve';
      let textMode: string = effectiveTextMode;
      let auto = mode === 'smart';   // 省心模式自动确定
      if (mode === 'smart') {
        textMode = 'preserve';
      }

      // 省心模式：从用户输入中提取页数（如"6页"、"6 页"、"6"）
      let effectivePages = pages;
      if (mode === 'smart') {
        const pageMatch = inputText.match(/(\d+)\s*页/);
        if (pageMatch) {
          const extractedPages = parseInt(pageMatch[1], 10);
          if (extractedPages >= 3 && extractedPages <= 30) {
            effectivePages = extractedPages;
            setPages(extractedPages);
            console.log('[SmartMode] 从输入中提取页数:', extractedPages);
          }
        }
      }

      // Step 1: 调用 outline API（所有模式统一入口）
      await new Promise(r => setTimeout(r, 800));
      setGenStep(1);
      setGenProgress(30);
      setStepText('AI 正在生成大纲...');

      const oRes = await fetch('/api/outline', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ inputText, slideCount: effectivePages, textMode, auto }),
      });
      // 先读取响应文本，再尝试解析 JSON（避免非 JSON 响应导致的解析错误）
      const oText = await oRes.text();
      if (!oRes.ok) {
        let errMsg = '大纲生成失败';
        try { const d = JSON.parse(oText); errMsg = d.error || errMsg; } catch {}
        throw new Error(errMsg);
      }
      let od;
      try { od = JSON.parse(oText); } catch { throw new Error('大纲响应格式错误，请重试'); }

      // Step 2: 流式显示大纲 → 进入大纲编辑页（所有模式都确认）
      setGenProgress(60);
      setStreamingSlides(od.slides || []);
      await new Promise(r => setTimeout(r, od.slides.length * 300 + 500));

      setOutlineResult(od);
      setEditedSlides(od.slides || []);
      // 🚨 V6：省心模式需要构造 smartGammaPayload（大纲确认页 UI 依赖它）
      if (mode === 'smart') {
        // 将 outline API 返回的 imageMode 映射为 Gamma API 期望的 source 值
        const imageModeMap: Record<string, string> = {
          'theme-img': 'themeAccent',
          'theme': 'themeAccent',
          'web': 'webFreeToUseCommercially',
          'ai': 'aiGenerated',
          'none': 'noImages',
        };
        const gammaImageSource = imageModeMap[od.imageMode || ''] || 'themeAccent';
        setSmartGammaPayload({
          themeId: od.themeId || 'consultant',
          tone: od.tone || 'professional',
          imageOptions: { source: gammaImageSource },
        });
        // 同步 imgMode 状态，确保 confirmAndGenerate 使用正确的值
        const reverseImageModeMap: Record<string, string> = {
          'themeAccent': 'theme-img',
          'noImages': 'none',
          'webFreeToUseCommercially': 'web',
          'aiGenerated': 'ai',
        };
        setImgMode(reverseImageModeMap[gammaImageSource] || 'theme-img');
      }
      setPhase('outline');
      setGenProgress(100);
    } catch (e: any) {
      setError(e.message);
      setPhase('input');
    }
    setLoading(false);
  }, [user, files, topic, showPro, genMode, pages, collectText, mode, directTextMode]);

  // 🚨 V6 简化：省心模式入口（权限检查 + 调用统一流程）
  const generateSmartOutline = useCallback(async () => {
    if (!user) return;
    const smartPerm = checkPermission(user.plan_type || 'free', { numPages: 8, imageSource: 'noImages', mode: 'smart' });
    if (!smartPerm.allowed) {
      const reqPlan = smartPerm.requiredPlan || 'basic';
      const planInfo = getPlan(reqPlan);
      openPayment({ id: reqPlan, name: `${planInfo.name} · ${planInfo.emoji}`, price: planInfo.priceMonthly > 0 ? `¥${planInfo.priceMonthly}/月` : '免费', billing: 'monthly', reason: smartPerm.reason || '省心定制为会员专属功能' });
      return;
    }
    return generateOutline();
  }, [user, generateOutline]);

  // Step 2: Confirm and generate PPT
  const confirmAndGenerate = useCallback(async () => {
    if (!outlineResult || !user) return;

    // 🔐 会员权限检查
    const userPlan = getPlan(user.plan_type || 'free');
    const imageSource = imgMode === 'none' ? 'noImages' : imgMode === 'ai' ? 'aiGenerated' : imgMode === 'ai-pro' ? 'aiGenerated' : imgMode === 'web' ? 'webFreeToUseCommercially' : imgMode === 'theme-img' ? 'themeAccent' : 'pictographic';
    const numPages = Math.min(editedSlides.length, userPlan.maxPages);
    const perm = checkPermission(user.plan_type || 'free', {
      numPages,
      imageSource,
      mode: mode === 'smart' ? 'smart' : 'direct',
    });
    if (!perm.allowed) {
      setError(perm.reason || '当前套餐权限不足');
      const reqPlan = perm.requiredPlan || 'basic';
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
    setError('');
    setPhase('generating');
    setGenStep(0);
    setGenProgress(0);
    setStepText('AI 正在准备渲染...');

    // 🚨 V6新增：计算待扣积分（用于回滚，提前声明避免catch作用域问题）
    const imgCredits3 = imgMode === 'ai' || imgMode === 'ai-pro' ? 2 : 0;
    const estImg3 = Math.ceil(editedSlides.length / 2);
    const creditsToDeduct3 = editedSlides.length * 2 + estImg3 * imgCredits3;

    try {
      const tm = mode === 'smart' ? 'preserve' : genMode;

      // Step 0: Deduct credits
      setGenStep(0);
      setGenProgress(10);
      const deductRes = await fetch('/api/user', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'deduct', userId: user.id, numPages: editedSlides.length, imageSource: imgMode === 'none' ? 'noImages' : imgMode === 'ai' ? 'aiGenerated' : imgMode === 'web' ? 'webFreeToUseCommercially' : imgMode === 'theme-img' ? 'themeAccent' : 'pictographic' }),
      });
      const deductData = await deductRes.json();
      if (!deductRes.ok || deductData.error) {
        if (deductData.error === '积分不足') {
          // Open payment modal instead of throwing error
          setLoading(false);
          setPhase('outline');
          openPayment({
            id: 'basic',
            name: '积分不足，请充值',
            price: '¥29.9/月',
            billing: 'monthly',
            reason: '积分不足，无法生成PPT',
            neededCredits: deductData.needed,
            currentCredits: deductData.balance,
          });
          return;
        }
        throw new Error(deductData.error || '积分扣除失败');
      }
      // Update credits locally
      const updatedUser = { ...user, credits: deductData.balance };
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

      // 🚨 V6 统一：所有模式（省心+专业）都用 buildMdV2 构建内容
      const imgSrc = imgMode;
      const { markdown: md, visualMetaphor } = buildMdV2(outlineResult.title, editedSlides, imgSrc, false);
      // 🚨 V6.1 修复：themeId/tone 优先从 outlineResult 取（outline API 已匹配最佳配置）
      const finalThemeId = (theme !== 'auto' ? theme : outlineResult.themeId) || 'consultant';
      const finalTone = tone || outlineResult.tone || 'professional';
      const gammaRequestBody: any = {
        inputText: md,
        textMode: 'preserve',
        format: 'presentation',
        numCards: editedSlides.length,
        exportAs: 'pptx',
        themeId: finalThemeId,
        tone: finalTone,
        imageMode: imgSrc,
        visualMetaphor,
      };

      const gRes = await fetch('/api/gamma', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(gammaRequestBody),
      });
      // 先读取响应文本，再尝试解析 JSON
      const gText = await gRes.text();
      if (!gRes.ok) {
        let errMsg = `生成失败(${gRes.status})`;try { const d = JSON.parse(gText); errMsg = d.error || errMsg; } catch {}
        throw new Error(errMsg);
      }
      let gd;
      try { gd = JSON.parse(gText); } catch { throw new Error('Gamma响应格式错误，请重试'); }

      if (gd.generationId) {
        // API 是异步的，需要轮询状态
        setGenStep(2);
        setGenProgress(60);
        setStepText('正在等待 AI 渲染 PPT...');

        // 轮询状态（最多 3 分钟）
        const startTime = Date.now();
        const pollInterval = 3000; // 🚨 优化：缩短轮询间隔，快速响应
        let finalExportUrl = '';
        let lastStatusData: any = null;

        while (Date.now() - startTime < 180000) { // 🚨 优化：延长超时到3分钟
          await new Promise(r => setTimeout(r, pollInterval));

          const statusRes = await fetch(`/api/gamma?id=${gd.generationId}`);
          if (!statusRes.ok) continue;

          const statusData = await statusRes.json();

          if (statusData.status === 'completed') {
            finalExportUrl = statusData.exportUrl || '';
            lastStatusData = statusData;
            setGenProgress(90);
            setStepText('PPT 生成完成，准备下载...');
            break;
          }

          if (statusData.status === 'failed') {
            throw new Error(statusData.error || '生成失败');
          }

          // pending / processing - 继续轮询，显示进度
          const elapsed = Math.floor((Date.now() - startTime) / 1000);
          setStepText(`AI 渲染中... ${elapsed}秒`);
        }

        if (!finalExportUrl && !lastStatusData?.gammaUrl) {
          throw new Error('生成超时（3分钟），PPT内容较复杂，请稍后重试');
        }

        await new Promise(r => setTimeout(r, 500));
        setResult({ title: outlineResult.title, slides: editedSlides, pptxUrl: finalExportUrl, gammaUrl: lastStatusData?.gammaUrl || '', actualPages: editedSlides.length, generationId: gd.generationId });
        setGenProgress(100);
        setPhase('result');

        // 🆕 保存生成历史
        try {
          await fetch('/api/history', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'save', userId: user.id, title: outlineResult.title, slides: editedSlides, themeId: finalThemeId, downloadUrl: finalExportUrl, pageCount: editedSlides.length, imageMode: imgSrc }),
          });
        } catch (e) { console.warn('[History] 保存失败:', e); }
      }
    } catch (e: any) {
      // 🚨 V6新增：生成失败/超时时回滚积分
      rollbackCredits(creditsToDeduct3, e.message || '生成失败');
      setError(e.message);
      setPhase('outline');
    }
    setLoading(false);
  }, [user, outlineResult, editedSlides, showPro, genMode, theme, tone, imgMode, rollbackCredits]);

  const reset = () => {
    setLoading(false);
    setError('');
    setResult(null);
    setOutlineResult(null);
    setEditedSlides([]);
    setStreamingSlides([]);
    setFiles([]);
    setTopic('');
    setShowPro(false);
    setPhase('landing');
    setGenProgress(0);
    setGenStep(0);
  };

  const backToLanding = () => {
    setPhase('landing');
    setOutlineResult(null);
    setEditedSlides([]);
    setStreamingSlides([]);
    setError('');
  };

  const backToOutline = () => {
    setPhase('outline');
    setError('');
  };

  // Outline editing helpers
  const updateSlide = (idx: number, field: 'title' | 'content', val: string) => {
    setEditedSlides(prev => prev.map((s, i) =>
      i === idx ? (field === 'title' ? { ...s, title: val } : { ...s, content: val.split('\n').filter(Boolean) }) : s
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
    for (const f of Array.from(fl)) {
      // V7 前端校验
      if (f.size > LIMITS.MAX_FILE_SIZE) {
        setError(`文件 "${f.name}" 超过50MB限制`);
        continue;
      }

      const item: UploadedFile = { name: f.name, type: f.type, size: f.size };
      const ext = f.name.toLowerCase();

      // 纯文本文件：直接读取
      if (f.type === 'text/plain' || /\.(md|txt|csv)$/.test(ext)) {
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
      else if (/\.(pdf|xlsx?|docx?|pptx?)$/.test(ext)) {
        try {
          const formData = new FormData();
          formData.append('file', f);
          const res = await fetch('/api/parse-file', {
            method: 'POST',
            body: formData,
          });
          if (!res.ok) {
            const errData = await res.json().catch(() => ({}));
            alert(`文件 "${f.name}" 解析失败: ${errData.error || res.statusText}`);
            item.content = `[文件: ${f.name}, 解析失败]`;
          } else {
            const data = await res.json();
            // 🚨 解析明确失败时（failed=true），不设置 content，阻止垃圾文本进入 outline
            if (data.failed) {
              alert(`文件 "${f.name}" ${data.error || '解析失败'}，请将文字直接粘贴到输入框。`);
              continue; // 跳过此文件，不添加到 files 列表
            }
            item.content = data.text || `[文件: ${f.name}]`;
            // 检测服务端返回的解析失败提示
            if (item.content && /解析失败|扫描件|无文字/.test(item.content)) {
              alert(`文件 "${f.name}" 无法提取文字内容，请尝试手动复制粘贴。`);
              continue; // 跳过，不添加到列表
            }
          }
        } catch (e) {
          console.warn('[FileProcess] 解析失败:', e);
          item.content = `[文件: ${f.name}]`;
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
    <div className="min-h-screen bg-[#FAFBFE] flex flex-col">
      <Navbar onLogoClick={backToLanding} />
      <AnnouncementBar announcement={getLatestAnnouncement()} />

      {/* 顶部通知条 - 仅生成中阶段隐藏 */}
      {phase !== 'generating' && phase !== 'direct-generating' && (
        <ScrollingBanner variant="top" />
      )}

      {/* ===== LANDING PAGE ===== */}
      {phase === 'landing' && (
        <>
          {/* Mobile-optimized Hero */}
          <div className="relative pt-6 pb-8 md:pt-12 md:pb-16 overflow-hidden">
            {/* Background */}
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
              <div className="absolute -top-20 -right-20 w-[300px] h-[300px] md:w-[500px] md:h-[500px] bg-gradient-to-br from-purple-200/30 to-purple-100/20 rounded-full blur-3xl" />
            </div>

            <div className="relative max-w-3xl mx-auto px-3 md:px-6">
              {/* Badge - mobile compact */}
              <div className="flex justify-center mb-4 md:mb-6">
                <div className="inline-flex items-center gap-1.5 px-3 py-1.5 md:px-4 md:py-2 bg-white/80 rounded-full shadow-sm border border-purple-100/50">
                  <span className="relative flex h-1.5 w-1.5 md:h-2 md:w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-purple-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-1.5 w-1.5 md:h-2 md:w-2 bg-purple-500"></span>
                  </span>
                  <span className="text-[10px] md:text-xs font-medium text-purple-700">AI驱动 · 30秒出稿</span>
                </div>
              </div>

              {/* Headline - mobile compact */}
              <div className="text-center mb-6 md:mb-8">
                <h1 className="text-2xl md:text-4xl lg:text-5xl font-black text-gray-900 leading-tight tracking-tight mb-3">
                  <span className="block">输入主题，</span>
                  <span className="block bg-gradient-to-r from-purple-600 to-amber-500 bg-clip-text text-transparent">AI一键生成PPT</span>
                </h1>
                <p className="text-sm md:text-base text-gray-500 max-w-md mx-auto">告别繁琐排版，AI自动生成精美演示文稿</p>
              </div>

              {/* Mobile: Single input card */}
              <div className="bg-white rounded-xl md:rounded-2xl shadow-lg border border-gray-100 p-4 md:p-6 mb-4 md:hidden">
                <div className="relative">
                  <textarea
                    value={topic}
                    onChange={e => setTopic(e.target.value)}
                    placeholder="输入PPT主题，如：年度工作汇报"
                    className="w-full min-h-[80px] px-3 py-2.5 rounded-lg bg-gray-50 border border-gray-200 focus:border-purple-400 focus:ring-2 focus:ring-purple-100 outline-none resize-none text-sm"
                  />
                  <button
                    onClick={() => fileRef.current?.click()}
                    className="absolute bottom-2 right-2 w-6 h-6 flex items-center justify-center rounded-md text-gray-300 hover:text-purple-500 transition-colors"
                  >
                    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21.44 11.05l-9.19 9.19a6 6 0 01-8.49-8.49l9.19-9.19a4 4 0 015.66 5.66l-9.2 9.19a2 2 0 01-2.83-2.83l8.49-8.48"/></svg>
                  </button>
                </div>
                <input ref={fileRef} type="file" multiple className="hidden" onChange={async e => {
                  const raw = e.target.files;
                  if (!raw) return;
                  const processed = await fileProcess(raw);
                  setFiles(prev => [...prev, ...processed]);
                  e.target.value = '';
                }} />

                {files.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1">
                    {files.map((f, i) => (
                      <span key={i} className="inline-flex items-center gap-1 px-2 py-0.5 bg-purple-50 rounded text-[10px] text-purple-600">
                        {f.type.startsWith('image/') ? '🖼' : '📄'} {f.name.slice(0, 10)}
                        <button onClick={() => setFiles(prev => prev.filter((_, j) => j !== i))} className="text-gray-300 hover:text-red-400">×</button>
                      </span>
                    ))}
                  </div>
                )}

                <button
                  onClick={() => { if (!user) { openLogin(); return; } if (hasInput) startGenerate(); }}
                  disabled={!hasInput}
                  className={`w-full mt-3 py-3 rounded-xl text-sm font-semibold transition-all ${hasInput ? 'bg-gradient-to-r from-purple-500 to-purple-600 text-white shadow-md hover:shadow-lg' : 'bg-gray-100 text-gray-400'}`}
                >
                  ✨ 生成PPT
                </button>
              </div>

              {/* Desktop: Dual mode cards */}
              <div className="hidden md:grid grid-cols-2 gap-5 mb-8">
                <button
                  onClick={() => handleModeSelect('direct')}
                  className="group p-6 bg-white rounded-2xl border-2 border-gray-100 hover:border-purple-200 transition-all text-left"
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
                  className="group p-6 bg-white rounded-2xl border-2 border-gray-100 hover:border-amber-200 transition-all text-left"
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
                    <span className="px-2 py-0.5 bg-gray-50 text-gray-600 rounded text-xs">preserve</span>
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
        <div className="flex-1 bg-white min-h-screen">
          <div className="max-w-3xl mx-auto px-4 md:px-6 pt-4 pb-24">

            {phase === 'input' && (
              <>
                {/* Brand header */}
                <div className="text-center mb-6">
                  <h1 className="text-2xl md:text-3xl font-extrabold text-gray-900 tracking-tight">
                    创建你的<span className="bg-gradient-to-r from-[#5B4FE9] to-[#8B5CF6] bg-clip-text text-transparent"> PPT</span>
                  </h1>
                  <p className="text-sm text-gray-400 mt-1.5">描述你的需求，AI 30秒出稿</p>
                </div>

                {/* Input card */}
                <div className="relative bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
                  {/* Input row: textarea (with inline attach) + generate button (height aligned) */}
                  <div className="flex gap-2">
                    {/* Textarea container with attach button inside */}
                    <div className="relative flex-1">
                      <textarea
                        value={topic}
                        onChange={e => setTopic(e.target.value)}
                        placeholder="输入你想创建的 PPT 主题，例如：2024年度营销策略汇报"
                        className="w-full min-h-[120px] px-4 py-3 rounded-xl bg-[#FAFBFE] border border-gray-200/80 focus:border-[#5B4FE9] focus:ring-2 focus:ring-[#EDE9FE] focus:bg-white outline-none resize-none text-sm text-gray-800 placeholder:text-gray-400 transition-all"
                      />
                      {/* Attach button inside textarea (bottom-left) */}
                      <button
                        onClick={() => fileRef.current?.click()}
                        className="absolute bottom-2.5 left-2.5 w-7 h-7 flex items-center justify-center rounded-lg text-gray-300 hover:text-[#5B4FE9] hover:bg-[#F5F3FF]/80 transition-all"
                        title="上传附件"
                      >
                        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M21.44 11.05l-9.19 9.19a6 6 0 01-8.49-8.49l9.19-9.19a4 4 0 015.66 5.66l-9.2 9.19a2 2 0 01-2.83-2.83l8.49-8.48" />
                        </svg>
                      </button>
                    </div>
                    {/* Generate button - height aligned with textarea, more attractive */}
                    <button
                      onClick={() => { if (!user) { openLogin(); return; } generateOutline(); }}
                      disabled={!hasInput}
                      className={`relative flex-shrink-0 min-h-[120px] px-5 flex flex-col items-center justify-center gap-2 rounded-xl text-sm font-semibold transition-all overflow-hidden ${
                        hasInput
                          ? 'bg-gradient-to-br from-[#5B4FE9] via-[#7C3AED] to-[#8B5CF6] text-white shadow-lg shadow-purple-300/40 hover:shadow-xl hover:shadow-purple-400/50 active:scale-[0.97]'
                          : 'bg-gray-100 text-gray-400 cursor-not-allowed'
                      }`}
                    >
                      {/* Breathing glow ring for active state */}
                      {hasInput && (
                        <span className="absolute inset-0 rounded-xl bg-gradient-to-br from-[#5B4FE9]/30 to-[#8B5CF6]/30 animate-pulse" />
                      )}
                      {/* Magic star icon */}
                      <span className={`relative z-10 text-2xl ${hasInput ? 'animate-bounce' : ''}`}>✨</span>
                      <span className="relative z-10 font-bold tracking-wide">生成</span>
                      {/* Decorative sparkles */}
                      {hasInput && (
                        <span className="absolute top-2 right-2 text-xs animate-ping">💫</span>
                      )}
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

                  <div className="border-t border-gray-100 my-4" />

                  {/* Mode indicator */}
                  <div className="flex gap-2 mt-1">
                    <button
                      onClick={() => setMode('direct')}
                      className={`flex-1 py-2.5 rounded-xl border text-center transition-all text-sm font-medium ${
                        mode === 'direct'
                          ? 'border-[#5B4FE9] bg-[#F5F3FF] text-[#4338CA] shadow-sm'
                          : 'border-gray-200 text-gray-400 hover:border-gray-300'
                      }`}
                    >
                      🛠️ 专业模式
                    </button>
                    <button
                      onClick={() => {
                        const userPlan = getPlan(user?.plan_type || 'free');
                        if (!userPlan.smartMode) {
                          const planInfo = getPlan('basic');
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
                      }}
                      className={`flex-1 py-2.5 rounded-xl border text-center transition-all text-sm font-medium ${
                        mode === 'smart'
                          ? 'border-[#5B4FE9] bg-[#F5F3FF] text-[#4338CA] shadow-sm'
                          : getPlan(user?.plan_type || 'free').smartMode
                            ? 'border-gray-200 text-gray-500 hover:border-gray-300'
                            : 'border-gray-100 text-gray-300 hover:border-gray-200 bg-gray-50/50'
                      }`}
                    >
                      ✨ 省心定制
                      {!getPlan(user?.plan_type || 'free').smartMode && <span className="ml-1 text-[10px] opacity-70">💎基础</span>}
                    </button>
                  </div>

                  {/* Direct mode: show ThemeSelector + simplified params */}
                  {mode === 'direct' && (
                    <div className="mt-4 pt-4 border-t border-gray-100">
                      {/* 主题色系 */}
                      <div className="flex items-center gap-2 mb-3">
                        <label className="text-xs text-gray-500 font-medium">主题风格</label>
                      </div>
                      <ThemeSelector value={directTheme} onChange={setDirectTheme} />

                      {/* 直通三模式 */}
                      <div className="mt-3">
                        <label className="text-xs text-gray-500 mb-2 block">文本处理模式</label>
                        <div className="grid grid-cols-3 gap-2">
                          {[
                            { value: 'generate', label: '🚀 扩充文本', desc: 'AI丰富内容' },
                            { value: 'condense', label: '✨ 总结提炼', desc: 'AI精简核心' },
                            { value: 'preserve', label: '📝 保持原样', desc: '忠实呈现' },
                          ].map(opt => (
                            <button
                              key={opt.value}
                              onClick={() => setDirectTextMode(opt.value as 'generate' | 'condense' | 'preserve')}
                              className={`py-2.5 px-2 rounded-xl border-2 text-center transition-all ${
                                directTextMode === opt.value
                                  ? 'border-[#5B4FE9] bg-[#F5F3FF] shadow-sm'
                                  : 'border-gray-100 hover:border-gray-200 bg-white'
                              }`}
                            >
                              <div className={`text-xs font-semibold ${directTextMode === opt.value ? 'text-[#4338CA]' : 'text-gray-600'}`}>{opt.label}</div>
                              <div className="text-[9px] text-gray-400 mt-0.5">{opt.desc}</div>
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Simplified params — 3 columns: 页数(左) / 配图(中) / 风格(右) */}
                      <div className="grid grid-cols-3 gap-3 mt-3">
                        <div>
                          <label className="text-xs text-gray-500 mb-1 block">页数</label>
                          <select
                            value={Math.min(pages, getPlan(user?.plan_type || 'free').maxPages)}
                            onChange={e => {
                              const val = Number(e.target.value);
                              const maxP = getPlan(user?.plan_type || 'free').maxPages;
                              if (val > maxP) {
                                const planInfo = getPlan(PLAN_LIST.find(p => p.maxPages >= val)?.id || 'basic');
                                openPayment({
                                  id: planInfo.id,
                                  name: `${planInfo.name} · ${planInfo.emoji}`,
                                  price: `¥${planInfo.priceMonthly}/月`,
                                  billing: 'monthly',
                                  reason: `${val}页需要${planInfo.name}或更高套餐`,
                                });
                                return;
                              }
                              setPages(val);
                            }}
                            className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm bg-white"
                          >
                            {[5,6,7,8,9,10,12,15,20,25,30].map(n => {
                              const maxP = getPlan(user?.plan_type || 'free').maxPages;
                              const locked = n > maxP;
                              // 根据页数判断需要的会员等级
                              let lockBadge = '';
                              if (locked) {
                                if (n <= 15) lockBadge = ' 💎基础';
                                else if (n <= 20) lockBadge = ' 👑标准';
                                else lockBadge = ' 🏆高级';
                              }
                              return (
                                <option key={n} value={n} disabled={locked}>
                                  {n} 页{locked ? lockBadge : ''}
                                </option>
                              );
                            })}
                          </select>
                        </div>
                        <div>
                          <label className="text-xs text-gray-500 mb-1 block">配图风格</label>
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
                                  const reqPlan = needPro ? 'pro' : 'standard';
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
                            }}
                            className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm bg-white"
                          >
                            <option value="none">📝 纯净无图</option>
                            <option value="theme-img">🖼️ 主题套图</option>
                            <option value="web">🌐 定制网图</option>
                            <option value="ai">{getPlan(user?.plan_type || 'free').allowedAiModels.length > 0 ? '🤖 AI定制图' : '🤖 AI定制图 👑标准'}</option>
                            <option value="ai-pro">{getPlan(user?.plan_type || 'free').allowedAiModels.includes('imagen-3-pro') ? '✨ AI尊享图' : '✨ AI尊享图 🏆高级'}</option>
                          </select>
                        </div>
                        <div>
                          <label className="text-xs text-gray-500 mb-1 block">语气风格</label>
                          <select
                            value={directTone}
                            onChange={e => setDirectTone(e.target.value)}
                            className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm bg-white"
                          >
                            <option value="professional">专业</option>
                            <option value="casual">轻松</option>
                            <option value="creative">创意</option>
                            <option value="bold">大胆</option>
                          </select>
                        </div>
                      </div>
                    </div>
                  )}

                  {error && <div className="mt-3 px-3 py-2 bg-red-50 text-red-500 rounded-lg text-xs">❌ {error}</div>}
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
                          {slide.content && slide.content.length > 0 && (
                            <textarea value={slide.content.join('\n')} onChange={e => updateSlide(idx, 'content', e.target.value)}
                              rows={Math.min(slide.content.length, 4)}
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
                    const currentImgSrc = smartGammaPayload.imageOptions?.source || 'pictographic';
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
                            <p className="text-[10px] text-gray-400 mb-1">🎨 主题</p>
                            <div className="flex items-center gap-1.5">
                              {(currentTheme?.colors || ['#6366F1', '#8B5CF6', '#A78BFA']).slice(0, 3).map((c, i) => (
                                <span key={i} className="w-2.5 h-2.5 rounded-full border border-gray-200" style={{ backgroundColor: c }} />
                              ))}
                              <p className="text-xs font-medium text-gray-700 ml-1">{currentTheme?.name || currentThemeId}</p>
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
                              {(['themeAccent','noImages','webFreeToUseCommercially','aiGenerated'] as const).map(src => (
                                <button
                                  key={src}
                                  onClick={() => {
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
                                  {{ themeAccent:'主题套图', noImages:'无图', webFreeToUseCommercially:'网图', aiGenerated:'AI图' }[src]}
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

                  {/* Inline generate button for outline phase */}
                  {!loading && (
                    <button
                      onClick={confirmAndGenerate}
                      className="w-full mt-4 py-3 rounded-xl bg-gradient-to-r from-[#5B4FE9] to-[#8B5CF6] text-white text-sm font-semibold shadow-md shadow-purple-200/50 hover:shadow-lg hover:shadow-purple-300/50 active:scale-[0.98] transition-all"
                    >
                      🪄 确认生成 PPT
                    </button>
                  )}
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
        <div className="flex-1">
          <div className="max-w-3xl mx-auto px-4 md:px-6 pt-4 pb-24">
            <button onClick={() => { setPhase('input'); setLoading(false); }} className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-gray-600 mb-6 transition-colors">← 取消</button>

            <div className="mb-4">
              <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                <span className="relative flex h-3 w-3">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-purple-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-3 w-3 bg-purple-500"></span>
                </span>
                AI 正在生成大纲...
              </h2>
              <p className="text-xs text-gray-400 mt-0.5">
                {streamingSlides.length > 0
                  ? `已生成 ${streamingSlides.length} 页...`
                  : '深度分析需求中，请稍候'}
              </p>
            </div>

            {streamingSlides.length > 0 ? (
              <StreamingOutline slides={streamingSlides} />
            ) : (
              <div className="space-y-3">
                <div className="animate-pulse space-y-2">
                  <div className="h-4 bg-gray-200 rounded-lg w-3/4"></div>
                  <div className="h-3 bg-gray-100 rounded-lg w-1/2"></div>
                </div>
                <div className="animate-pulse space-y-2" style={{animationDelay: '0.1s'}}>
                  <div className="h-4 bg-gray-200 rounded-lg w-2/3"></div>
                  <div className="h-3 bg-gray-100 rounded-lg w-1/3"></div>
                </div>
                <div className="animate-pulse space-y-2" style={{animationDelay: '0.2s'}}>
                  <div className="h-4 bg-gray-200 rounded-lg w-4/5"></div>
                  <div className="h-3 bg-gray-100 rounded-lg w-2/5"></div>
                </div>
                <div className="flex items-center justify-center py-4">
                  <div className="flex gap-1">
                    <div className="w-2 h-2 bg-purple-300 rounded-full animate-bounce" style={{animationDelay: '0ms'}}></div>
                    <div className="w-2 h-2 bg-purple-400 rounded-full animate-bounce" style={{animationDelay: '150ms'}}></div>
                    <div className="w-2 h-2 bg-purple-500 rounded-full animate-bounce" style={{animationDelay: '300ms'}}></div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ===== DIRECT GENERATING PROGRESS ===== */}
      {phase === 'direct-generating' && (
        <GenerationProgress
            currentStep={genStep}
            progress={genProgress}
            subtext={stepText}
          />
      )}

      {/* ===== GENERATING PROGRESS ===== */}
      {phase === 'generating' && loading && (
        <GenerationProgress currentStep={genStep} progress={genProgress} subtext={stepText} />
      )}

      {/* ===== RESULT — 在线预览 ===== */}
      {phase === 'result' && result && !loading && (
        <div className="flex-1">
          <div className="max-w-3xl mx-auto px-4 md:px-6 pt-16 text-center animate-fade-in-up">
            <div className="text-5xl mb-4">🎉</div>
            <h2 className="text-xl font-bold text-gray-900 mb-1">PPT 已生成！</h2>
            <p className="text-xs text-gray-400 mb-8">{result.title} · {result.actualPages || pages} 页</p>

            <div className="bg-white rounded-2xl border border-gray-100 p-6 mb-6">
              <div className="grid grid-cols-3 gap-4 mb-6">
                <div className="text-center">
                  <div className="text-2xl mb-1">📄</div>
                  <p className="text-xs text-gray-500">{result.actualPages || pages} 页</p>
                </div>
                <div className="text-center">
                  <div className="text-2xl mb-1">🎨</div>
                  <p className="text-xs text-gray-500">AI 排版</p>
                </div>
                <div className="text-center">
                  <div className="text-2xl mb-1">⬇️</div>
                  <p className="text-xs text-gray-500">即下即用</p>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
                {/* 📥 PDF下载 */}
                {result.gammaUrl && (
                  <button
                    onClick={async () => {
                      if (!result.generationId) return;
                      setPdfExporting(true);
                      try {
                        const filename = result.title ? `${result.title}.pdf` : '省心PPT.pdf';
                        let pdfBlob: Blob;

                        if (user && user.plan_type && user.plan_type !== 'free') {
                          const res = await fetch(`/api/preview-pdf?generationId=${result.generationId}`);
                          const data = await res.json();
                          if (!data.pdfUrl) { alert('PDF导出失败，请稍后重试'); return; }
                          const pdfRes = await fetch(`/api/export?url=${encodeURIComponent(data.pdfUrl)}&name=${encodeURIComponent(filename)}`);
                          pdfBlob = await pdfRes.blob();
                        } else {
                          const pdfRes = await fetch(`/api/export-watermarked?generationId=${result.generationId}&name=${encodeURIComponent(filename)}`);
                          if (!pdfRes.ok) { alert('PDF下载失败，请稍后重试'); return; }
                          pdfBlob = await pdfRes.blob();
                        }

                        if (pdfBlob.size < 100) { alert('PDF下载失败'); return; }
                        const blobUrl = URL.createObjectURL(pdfBlob);
                        const link = document.createElement('a');
                        link.href = blobUrl;
                        link.download = filename;
                        document.body.appendChild(link);
                        link.click();
                        document.body.removeChild(link);
                        setTimeout(() => URL.revokeObjectURL(blobUrl), 5000);
                      } catch (e) { console.warn('[PDF] 下载失败:', e); alert('PDF下载失败，请稍后重试'); }
                      finally { setPdfExporting(false); }
                    }}
                    disabled={pdfExporting}
                    className={`w-full sm:w-auto px-8 py-3.5 text-white rounded-xl text-sm font-semibold transition-all cursor-pointer flex items-center justify-center gap-2 ${
                      pdfExporting
                        ? 'bg-gray-400 cursor-not-allowed'
                        : 'bg-gradient-to-r from-blue-500 to-indigo-600 hover:shadow-lg hover:shadow-blue-200/50 active:scale-95'
                    }`}
                  >
                    {pdfExporting ? (
                      <span className="flex items-center gap-2">
                        <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>
                        正在导出PDF...
                      </span>
                    ) : (
                      <span>📥 {user && user.plan_type && user.plan_type !== 'free' ? 'PDF下载' : '免费PDF下载'}</span>
                    )}
                  </button>
                )}
                {/* 🔒 导出PPTX（会员专属，非会员弹出单次/订阅选择） */}
                {result.pptxUrl && (
                  <button
                    onClick={async () => {
                      if (!user) { openLogin(); return; }
                      setExporting(true);
                      try {
                        const pageCount = result.actualPages || pages;
                        const pricePerPage = 0.2;
                        const totalPrice = Math.round(pageCount * pricePerPage * 100) / 100;
                        if (user.plan_type && user.plan_type !== 'free') {
                          try {
                            await fetch("/api/download", {
                              method: "POST",
                              headers: { "Content-Type": "application/json" },
                              body: JSON.stringify({ action: "record", userId: user.id, pageCount, format: "pptx" }),
                            });
                          } catch (err) { console.warn("[Download] 记录失败:", err); }
                          const filename = result.title ? `省心PPT_${result.title.substring(0, 20)}.pptx` : '省心PPT.pptx';
                          const res = await fetch(`/api/export?url=${encodeURIComponent(result.pptxUrl)}&name=${encodeURIComponent(filename)}`);
                          const blob = await res.blob();
                          const blobUrl = URL.createObjectURL(blob);
                          const link = document.createElement('a');
                          link.href = blobUrl;
                          link.download = filename;
                          document.body.appendChild(link);
                          link.click();
                          document.body.removeChild(link);
                          setTimeout(() => URL.revokeObjectURL(blobUrl), 5000);
                        } else {
                          const choice = window.confirm(
                            `导出此PPT需扣除积分。\n\n📄 当前PPT共 ${pageCount} 页\n💰 单次付费：¥${totalPrice}（${Math.ceil(pageCount * 20)}积分）\n⭐ 订阅会员：免费无限次下载\n\n点「确定」= 单次付费下载\n点「取消」= 查看订阅方案`
                          );
                          if (choice) {
                            const filename = result.title ? `省心PPT_${result.title.substring(0, 20)}.pptx` : '省心PPT.pptx';
                            fetch('/api/pay-once', {
                              method: 'POST',
                              headers: { 'Content-Type': 'application/json' },
                              body: JSON.stringify({ userId: user.id, pptxUrl: result.pptxUrl, pageCount, filename }),
                            }).then(r => r.json()).then(data => {
                              if (data.error) { alert(data.message || data.error); return; }
                              fetch(data.downloadUrl).then(r => r.blob()).then(blob => {
                                const blobUrl = URL.createObjectURL(blob);
                                const link = document.createElement('a');
                                link.href = blobUrl;
                                link.download = filename;
                                document.body.appendChild(link);
                                link.click();
                                document.body.removeChild(link);
                                setTimeout(() => URL.revokeObjectURL(blobUrl), 5000);
                                if (data.remainingCredits !== undefined) updateCredits(data.remainingCredits);
                              });
                            }).catch(() => alert('付费下载失败，请稍后重试'));
                          } else {
                            openPayment({ id: 'basic', name: '基础版', price: '¥19', billing: 'monthly', reason: `订阅会员 · ${pageCount}页PPT免费下` });
                          }
                        }
                      } finally { setExporting(false); }
                    }}
                    disabled={exporting}
                    className={`w-full sm:w-auto px-8 py-3.5 text-white rounded-xl text-sm font-semibold transition-all cursor-pointer flex items-center justify-center gap-2 ${
                      exporting
                        ? 'bg-gray-400 cursor-not-allowed'
                        : 'bg-gradient-to-r from-purple-600 to-violet-600 hover:shadow-lg hover:shadow-purple-200/50 active:scale-95'
                    }`}
                  >
                    {exporting ? (
                      <>
                        <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>
                        正在导出PPTX...
                      </>
                    ) : (
                      <span>🔒 导出PPTX</span>
                    )}
                  </button>
                )}
              </div>

              <div className="flex flex-col sm:flex-row items-center justify-center gap-2 sm:gap-3 mt-4">
                <button onClick={backToOutline} className="w-full sm:w-auto px-6 py-2.5 text-gray-500 hover:text-gray-700 text-sm font-medium hover:bg-gray-50 rounded-xl transition-all">
                  ✏️ 修改大纲重做
                </button>
                <button onClick={reset} className="w-full sm:w-auto px-6 py-2.5 text-gray-500 hover:text-gray-700 text-sm font-medium hover:bg-gray-50 rounded-xl transition-all">
                  ➕ 继续创建
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
        genMode={genMode} setGenMode={setGenMode}
        theme={theme} setTheme={setTheme}
        tone={tone} setTone={setTone}
        imgMode={imgMode} setImgMode={setImgMode}
        pages={pages} setPages={setPages}
      />

      <LoginModal open={showLogin} onClose={closeLogin} />
      <PaymentModal open={showPayment} onClose={closePayment} plan={paymentPlan} />
      <ThemePickerModal
        open={showThemePicker}
        currentThemeId={smartGammaPayload?.themeId || 'consultant'}
        currentTone={smartGammaPayload?.tone || 'professional'}
        currentImgSrc={smartGammaPayload?.imageOptions?.source || 'theme-img'}
        onThemeChange={(themeId) => {
          setSmartGammaPayload((prev: any) => prev ? {
            ...prev,
            themeId,
            gammaPayload: prev.gammaPayload ? { ...prev.gammaPayload, themeId } : undefined,
          } : prev);
        }}
        onToneChange={(tone) => {
          setSmartGammaPayload((prev: any) => prev ? {
            ...prev,
            tone,
            gammaPayload: prev.gammaPayload ? { ...prev.gammaPayload, tone, textOptions: { ...prev.gammaPayload.textOptions, tone } } : undefined,
          } : prev);
        }}
        onImgChange={(imgSrc) => {
          // ✅ Gamma API 直接支持，不需要映射
          setSmartGammaPayload((prev: any) => prev ? {
            ...prev,
            imageOptions: { ...prev.imageOptions, source: imgSrc },
            gammaPayload: prev.gammaPayload ? { ...prev.gammaPayload, imageOptions: { ...prev.gammaPayload.imageOptions, source: imgSrc } } : undefined,
          } : prev);
          // 同步 imgMode 状态，确保 confirmAndGenerate 使用正确的值
          const reverseMap: Record<string, string> = {
            'themeAccent': 'theme-img',
            'noImages': 'none',
            'webFreeToUseCommercially': 'web',
            'aiGenerated': 'ai',
          };
          setImgMode(reverseMap[imgSrc] || 'theme-img');
        }}
        onClose={() => setShowThemePicker(false)}
      />

      {/* ===== 预览弹窗（pdf.js 渲染，16:9 强制单页 + 翻页控制） ===== */}
      {showPreview && result?.gammaUrl && (
        <div className="fixed inset-0 z-50 flex flex-col bg-black/90 backdrop-blur-sm"
          onClick={(e) => { if (e.target === e.currentTarget) setShowPreview(false); }}>
          {/* 顶部工具栏 */}
          <div className="flex items-center justify-between px-6 py-3 bg-gray-900 text-white flex-shrink-0">
            <div>
              <p className="text-sm font-medium">📄 {result.title || 'PPT预览'}</p>
              <p className="text-xs text-gray-400">第 {pdfPage} / {pdfTotalPages} 页 · 水印预览版</p>
            </div>
            {/* 翻页控制 */}
            <div className="flex items-center gap-2">
              <button onClick={() => setPdfPage(p => Math.max(1, p - 1))}
                disabled={pdfPage <= 1}
                className="px-3 py-1.5 text-sm bg-gray-700 hover:bg-gray-600 disabled:opacity-30 rounded-lg transition-all">←</button>
              <span className="text-xs text-gray-400 min-w-[60px] text-center">{pdfPage}/{pdfTotalPages}</span>
              <button onClick={() => setPdfPage(p => Math.min(pdfTotalPages, p + 1))}
                disabled={pdfPage >= pdfTotalPages}
                className="px-3 py-1.5 text-sm bg-gray-700 hover:bg-gray-600 disabled:opacity-30 rounded-lg transition-all">→</button>
            </div>
            <button onClick={() => setShowPreview(false)}
              className="px-4 py-1.5 text-sm bg-gray-700 hover:bg-gray-600 rounded-lg transition-all">
              ✕ 关闭
            </button>
          </div>

          {/* PDF 预览区（16:9 强制单页，pdf.js 渲染） */}
          <div className="flex-1 flex items-center justify-center bg-gray-900 overflow-hidden">
            {previewLoading ? (
              <div className="text-center text-white">
                <div className="animate-spin w-10 h-10 border-3 border-purple-500 border-t-transparent rounded-full mx-auto mb-4"></div>
                <p className="text-sm text-gray-300">正在加载预览...</p>
              </div>
            ) : previewPdfUrl ? (
              <div className="relative" style={{ aspectRatio: '16/9', maxWidth: '90vw', maxHeight: '75vh' }}>
                <canvas id="pdf-canvas" className="block w-full h-full shadow-2xl rounded" />
                {/* 水印 */}
                <div className="absolute inset-0 pointer-events-none flex items-center justify-center overflow-hidden rounded">
                  <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%) rotate(-20deg)', fontSize: 'clamp(20px,4vw,48px)', color: 'rgba(180,180,180,0.07)', whiteSpace: 'nowrap', fontWeight: 700, letterSpacing: '4px' }}>
                    省心PPT · 仅供预览
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-center text-gray-400">
                <p className="text-sm">预览加载中...</p>
              </div>
            )}
          </div>

          {/* 底部操作栏 */}
          <div className="flex items-center justify-between px-6 py-4 bg-gray-900 flex-shrink-0">
            <p className="text-xs text-gray-500">点击 ← → 翻页 · 完整效果请下载查看</p>
            <div className="flex items-center gap-3">
              <button onClick={() => setShowPreview(false)}
                className="px-5 py-2 text-sm text-gray-400 hover:text-white rounded-lg transition-all">
                返回
              </button>
              {/* 📥 免费PDF下载（弹窗内重定向到PDF下载） */}
              {result.gammaUrl && (
                <a
                  href={previewPdfUrl ? previewPdfUrl : '#'}
                  download={result.title ? `${result.title}.pdf` : '省心PPT.pdf'}
                  onClick={(e) => { if (!previewPdfUrl) { e.preventDefault(); alert('请等待预览加载完成'); } }}
                  className="px-5 py-2 text-sm bg-blue-600 hover:bg-blue-500 text-white rounded-lg transition-all"
                >
                  📥 下载PDF
                </a>
              )}
              {/* 🔒 会员导出PPTX */}
              {result.pptxUrl && (
                <button
                  onClick={async () => {
                    if (!user) { openLogin(); return; }
                    const creditsRes = await fetch(`/api/credits?userId=${user.id}`);
                    const cd = await creditsRes.json();
                    if (!((cd.credits || 0) > 0 || cd.isVip)) {
                      openPayment({ id: 'basic', name: '基础版', price: '¥19', billing: 'monthly', reason: '导出PPTX需要会员权限', neededCredits: (result.actualPages || pages) });
                      return;
                    }
                    const filename = result.title ? `省心PPT_${result.title.substring(0, 20)}.pptx` : '省心PPT.pptx';
                    const res = await fetch(`/api/export?url=${encodeURIComponent(result.pptxUrl)}&name=${encodeURIComponent(filename)}`);
                    const blob = await res.blob();
                    const blobUrl = URL.createObjectURL(blob);
                    const link = document.createElement('a');
                    link.href = blobUrl;
                    link.download = filename;
                    document.body.appendChild(link);
                    link.click();
                    document.body.removeChild(link);
                    setTimeout(() => URL.revokeObjectURL(blobUrl), 5000);
                  }}
                  className="px-5 py-2 text-sm bg-purple-600 hover:bg-purple-500 text-white rounded-lg transition-all"
                >
                  🔒 导出PPTX
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
