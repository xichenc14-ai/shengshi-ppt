'use client';

import React, { useState, useCallback, useRef, useEffect } from 'react';
import { useAuth } from '@/lib/auth-context';
import { useRouter } from 'next/navigation';

import Navbar from '@/components/Navbar';
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
import { getThemeById } from '@/lib/theme-database';
import { checkPermission, mapImgModeToSource, getPlan, PLAN_LIST } from '@/lib/membership';

/* ==================== Config ==================== */

const GEN_MODES_MAP: Record<string, string> = { generate: 'generate', condense: 'condense', preserve: 'preserve' };

type UploadedFile = { name: string; type: string; size: number; content?: string };
type SlideItem = { id: string; title: string; content?: string[]; notes?: string };

// buildMd 已替换为 buildMdV2（lib/build-md-v2.ts）
// 在 confirmAndGenerate 中直接传 slides 给 /api/gamma

export default function Home() {
  const { user, showLogin, showPayment, paymentPlan, openPayment, openLogin, closeLogin, closePayment, updateCredits } = useAuth();
  const router = useRouter();

  // Dual-track mode
  const [mode, setMode] = useState<'direct' | 'smart'>('direct');
  const [directTheme, setDirectTheme] = useState('default-light');
  const [directTone, setDirectTone] = useState('professional');
  const [directImgMode, setDirectImgMode] = useState('theme-img');
  const [directTextMode, setDirectTextMode] = useState<'generate' | 'condense' | 'preserve'>('generate');

  // Landing page vs generate flow
  const [phase, setPhase] = useState<'landing' | 'input' | 'streaming' | 'outline' | 'generating' | 'direct-generating' | 'result'>('input');

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
  const [outlineResult, setOutlineResult] = useState<{ title: string; slides: SlideItem[]; themeId?: string } | null>(null);
  const [smartGammaPayload, setSmartGammaPayload] = useState<any>(null); // 省心模式 AI 生成的完整参数
  const [editedSlides, setEditedSlides] = useState<SlideItem[]>([]);
  const [streamingSlides, setStreamingSlides] = useState<SlideItem[]>([]);

  // Drag-and-drop state for outline reordering
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

  // Result
  const [result, setResult] = useState<{ title: string; slides: SlideItem[]; dlUrl: string; actualPages?: number } | null>(null);

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

  // Enter generate flow
  const startGenerate = useCallback(() => {
    if (!user) return;
    setMode('direct');
    setPhase('input');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [user]);

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

      const gRes = await fetch('/api/gamma-direct', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          inputText,
          themeId: directTheme,
          numCards: pages,
          imageSource: directImgMode,
          tone: directTone,
          textMode: directTextMode,
          exportAs: 'pptx',
        }),
      });
      if (!gRes.ok) {
        const d = await gRes.json();
        throw new Error(d.error || 'PPT 生成失败');
      }
      const gd = await gRes.json();

      if (gd.generationId) {
        // API 是异步的，需要前端轮询状态
        setGenStep(2);
        setGenProgress(50);
        setStepText('正在等待 AI 渲染 PPT...');

        const startTime = Date.now();
        const pollInterval = 3000; // 🚨 优化：缩短轮询间隔，快速响应
        let finalExportUrl = '';

        let finalGammaUrl = '';

        while (Date.now() - startTime < 180000) { // 🚨 优化：延长超时到3分钟（复杂PPT需要更多时间）
          await new Promise(r => setTimeout(r, pollInterval));

          const statusRes = await fetch(`/api/gamma?id=${gd.generationId}`);
          if (!statusRes.ok) continue;

          const statusData = await statusRes.json();

          if (statusData.status === 'completed') {
            finalExportUrl = statusData.exportUrl || '';
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

        if (!finalExportUrl) {
          throw new Error('生成超时（2分钟），PPT内容较复杂，请稍后重试');
        }

        await new Promise(r => setTimeout(r, 500));
        const topicText = inputText.split('\n')[0].replace(/^#\s*/, '').trim();
        setResult({ title: topicText || 'PPT', slides: [], dlUrl: finalExportUrl, actualPages: pages });
        setGenProgress(100);
        setPhase('result');
      }
    } catch (e: any) {
      // 🚨 V6新增：生成失败/超时时回滚积分
      rollbackCredits(creditsToDeduct, e.message || '生成失败');
      setError(e.message);
      setPhase('input');
    }
    setLoading(false);
  }, [user, collectText, directTheme, directTone, directImgMode, directTextMode, pages, openPayment, rollbackCredits]);

  // 省心模式生成流程：调用 smart-outline API（深度理解需求 + 自动确定参数）
  const generateSmartOutline = useCallback(async () => {
    const inputText = collectText();
    if (!inputText.trim()) return;
    if (!user) return;

    // 🔐 省心模式权限检查（免费用户不可用）
    const smartPerm = checkPermission(user.plan_type || 'free', {
      numPages: 8,
      imageSource: 'noImages',
      mode: 'smart',
    });
    if (!smartPerm.allowed) {
      const reqPlan = smartPerm.requiredPlan || 'basic';
      const planInfo = getPlan(reqPlan);
      openPayment({
        id: reqPlan,
        name: `${planInfo.name} · ${planInfo.emoji}`,
        price: planInfo.priceMonthly > 0 ? `¥${planInfo.priceMonthly}/月` : '免费',
        billing: 'monthly',
        reason: smartPerm.reason || '省心定制为会员专属功能',
      });
      return;
    }

    setLoading(true);
    setError('');
    setPhase('streaming');
    setGenStep(0);
    setGenProgress(5);
    setStepText('AI 正在深度理解你的需求...');

    // 🚨 V6新增：计算待扣积分（用于回滚，提前声明避免catch作用域问题）
    // 注意：pageCount 和 configImageSrc 在 API 调用成功后才有，这里用保守默认值估算
    const BASE2 = 2;
    const fallbackPages = 8;
    const imgCredits2 = 0; // pictographic 不产生图片积分
    const estImg2 = Math.ceil(fallbackPages / 2);
    const creditsToDeduct2 = fallbackPages * BASE2 + estImg2 * imgCredits2;

    try {
      // Step 1: 调用 smart-outline API（自动分析需求 + 确定参数 + 生成大纲）
      setGenProgress(15);
      setStepText('AI 正在分析场景和确定最佳方案...');

      const smartRes = await fetch('/api/smart-outline', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          inputText,
          uploadedFiles: files.map(f => ({ name: f.name, type: f.type, size: f.size }))
        }),
      });

      if (!smartRes.ok) {
        const d = await smartRes.json();
        throw new Error(d.error || '需求分析失败');
      }

      const smartData = await smartRes.json();

      // Step 2: 显示分析结果（V3 使用 gammaScript，不再依赖 outline）
      const gammaScript = smartData.gammaScript || '';
      const pageCount = smartData.pageCount || 8;
      const configThemeId = smartData.config?.themeId || 'consultant';
      const configTone = smartData.config?.tone || 'professional';
      const configImageSrc = smartData.config?.imageSource || 'pictographic';
      const configVisualMetaphor = smartData.config?.visualMetaphor || '';

      if (!gammaScript || gammaScript.trim().length < 50) {
        throw new Error('AI 生成的脚本内容为空，请重试');
      }

      setGenProgress(30);
      setStepText(`识别场景: ${smartData.analysis?.scene || '通用'} · 页数: ${pageCount}页`);

      await new Promise(r => setTimeout(r, 800));

      // Step 3: 流式显示"正在生成专业脚本..."
      setGenProgress(50);
      setStepText('AI 正在生成 Gamma 定制脚本...');
      await new Promise(r => setTimeout(r, pageCount * 150 + 400));

      // ====== 省心模式 V3：直接使用 AI 生成的 gammaScript ======
      setGenProgress(60);
      setPhase('generating');
      setGenStep(0);
      setStepText('正在准备渲染...');

      const userPlan = getPlan(user.plan_type || 'free');
      const perm = checkPermission(user.plan_type || 'free', { numPages: pageCount, imageSource: configImageSrc, mode: 'smart' });
      if (!perm.allowed) { setLoading(false); setPhase('input'); setError(perm.reason || '权限不足'); return; }

      // 扣积分
      setGenStep(1); setGenProgress(65);
      const deductRes = await fetch('/api/user', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'deduct', userId: user.id, numPages: pageCount, imageSource: configImageSrc }) });
      const deductData = await deductRes.json();
      if (!deductRes.ok || deductData.error) {
        setLoading(false); setPhase('input');
        if (deductData.error === '积分不足') { openPayment({ id: 'shengxin', name: '积分不足', price: '¥9.9/月', billing: 'monthly', reason: '积分不足' }); }
        else { setError(deductData.error || '积分扣除失败'); }
        return;
      }
      updateCredits(deductData.balance);

      // 构建 Gamma 请求（V3：直接使用 AI 生成的 gammaScript）
      setGenStep(2); setGenProgress(75);
      setStepText('正在精准渲染...');

      // 构建 additionalInstructions
      const instructions = buildAdditionalInstructions(configTone, smartData.analysis?.scene || 'biz', configImageSrc, configVisualMetaphor);

      // 🚨 P0 Fix: 移除 cardSplit（Gamma 不认识此参数，会导致 400）
      // 🚨 P0 Fix: preserve 模式需要忠实呈现用户原始内容，不做 AI 提炼
      //   gammaScript 是 AI 提炼过的，会改变用户内容
      //   改为：直接用用户的原始输入（inputText）传给 Gamma preserve 模式
      const rawInput = collectText();
      // 构建用于 preserve 的 markdown：只用用户的原始内容加基础分页，不做 AI 提炼
      const preserveMd = buildPreserveMarkdown(rawInput, pageCount);

      const gammaRequestBody: Record<string, any> = {
        inputText: preserveMd,   // ✅ preserve 模式忠实呈现用户原文
        textMode: 'preserve',    // ✅ 保持原文结构，不做 AI 改写
        format: 'presentation',
        numCards: pageCount,
        themeId: configThemeId,
        additionalInstructions: instructions,
        textOptions: { amount: 'medium', tone: configTone, language: 'zh-cn' },
        imageOptions: { source: configImageSrc },
        cardOptions: { dimensions: '16x9' },
        exportAs: 'pptx',
      };

      // 调用 Gamma API
      let gRes = await fetch('/api/gamma', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(gammaRequestBody) });

      // 失败自动降级：pictographic → noImages
      if (!gRes.ok && configImageSrc !== 'noImages') {
        console.warn('[SmartMode V3] Gamma failed, fallback to noImages');
        setStepText('图片模式不支持，切换渲染...');
        gammaRequestBody.imageOptions = { source: 'noImages' };
        gRes = await fetch('/api/gamma', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(gammaRequestBody) });
      }

      if (!gRes.ok) { const d = await gRes.json(); throw new Error(d.error || `生成失败(${gRes.status})`); }
      const gd = await gRes.json();

      if (gd.generationId) {
        setGenStep(2); setGenProgress(80);
        setStepText('正在等待 AI 渲染 PPT...');
        const startTime = Date.now();
        while (Date.now() - startTime < 180000) { // 🚨 优化：延长超时到3分钟
          await new Promise(r => setTimeout(r, 3000)); // 🚨 优化：缩短轮询间隔到3秒
          const statusRes = await fetch(`/api/gamma?id=${gd.generationId}`);
          if (!statusRes.ok) continue;
          const statusData = await statusRes.json();
          if (statusData.status === 'completed') {
            setGenProgress(95); setStepText('PPT 生成完成！');
            await new Promise(r => setTimeout(r, 500));
            const pptTitle = smartData.analysis?.keyTopics?.[0] || smartData.analysis?.scene || 'PPT';
            setResult({ title: pptTitle, slides: [], dlUrl: statusData.exportUrl || '', actualPages: pageCount });
            setGenProgress(100); setPhase('result'); return;
          }
          if (statusData.status === 'failed') { throw new Error(statusData.error || '生成失败'); }
          setStepText(`AI 渲染中... ${Math.floor((Date.now() - startTime) / 1000)}秒`);
        }
        throw new Error('生成超时（3分钟），PPT内容较复杂，请稍后重试');
      }
    } catch (e: any) {
      // 🚨 V6新增：生成失败/超时时回滚积分
      rollbackCredits(creditsToDeduct2, e.message || '生成失败');
      setError(e.message);
      setPhase('input');
    }
    setLoading(false);
  }, [user, files, topic, collectText, updateCredits, openPayment, rollbackCredits]);

  // 专业模式生成流程：调用 outline API（用户手动选择参数）
  const generateOutline = useCallback(async () => {
    // 如果是省心模式，调用新的智能流程
    if (mode === 'smart') {
      return generateSmartOutline();
    }

    // 专业模式：原流程
    const inputText = collectText();
    if (!inputText.trim()) return;

    setLoading(true);
    setError('');
    setPhase('streaming');
    setGenStep(0);
    setGenProgress(10);
    setStepText('AI 正在分析你的需求...');

    try {
      const isEasy = !showPro;
      const tm = isEasy ? 'generate' : genMode;

      // Step 1: Analyze
      await new Promise(r => setTimeout(r, 800));
      setGenStep(1);
      setGenProgress(30);
      setStepText('AI 正在生成大纲...');

      const oRes = await fetch('/api/outline', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ inputText, slideCount: pages, textMode: tm, auto: isEasy }),
      });
      if (!oRes.ok) { const d = await oRes.json(); throw new Error(d.error || '大纲生成失败'); }
      const od = await oRes.json();

      // Step 2: Show streaming outline
      setGenProgress(60);
      setStreamingSlides(od.slides || []);

      // Wait for streaming animation
      await new Promise(r => setTimeout(r, od.slides.length * 300 + 500));

      setOutlineResult(od);
      setEditedSlides(od.slides || []);
      setPhase('outline');
      setGenProgress(100);
    } catch (e: any) {
      setError(e.message);
      setPhase('input');
    }
    setLoading(false);
  }, [user, files, topic, showPro, genMode, pages, collectText, mode, generateSmartOutline]);

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
      setStepText(mode === 'smart' && smartGammaPayload ? '正在精准渲染...' : 'AI 正在渲染 PPT 页面...');

      // 🚨 省心模式：直接用 AI 生成的完整参数
      // 🚨 专业模式：用 buildMdV2 构建内容
      let gammaRequestBody: any;

      if (mode === 'smart' && smartGammaPayload) {
        // 省心模式：用 smartGammaPayload.gammaPayload（只取 Gamma 需要的参数）
        // 用户可能编辑了大纲，需要重建 inputText 和更新页数
        const basePayload = smartGammaPayload.gammaPayload || smartGammaPayload;
        const imgSrc = basePayload.imageOptions?.source || 'pictographic';
        // ✅ Gamma API 直接支持这些 source 值，不需要映射
        // pictographic, themeAccent, webFreeToUseCommercially, aiGenerated, noImages
        const gammaImgSrc = imgSrc;
        const { markdown: rebuiltMd } = buildMdV2(outlineResult.title, editedSlides, imgSrc, false); // 🚨 V6修复：preserve模式不允许ENHANCEMENT_MAP扩写
        gammaRequestBody = {
          ...basePayload,
          inputText: rebuiltMd,
          numCards: editedSlides.length,
          textMode: 'preserve',
          imageOptions: {
            ...(basePayload.imageOptions || {}),
            source: gammaImgSrc,
          },
        };
      } else {
        // 专业模式：用用户选择的参数
        const { markdown: md, visualMetaphor } = buildMdV2(outlineResult.title, editedSlides, imgMode, false); // 🚨 V6修复：preserve模式不允许ENHANCEMENT_MAP扩写
        gammaRequestBody = {
          inputText: md,
          textMode: 'preserve',
          format: 'presentation',
          numCards: editedSlides.length,
          exportAs: 'pptx',
          themeId: theme === 'auto' ? outlineResult.themeId : theme,
          tone,
          imageMode: imgMode,
          slides: editedSlides,
          visualMetaphor,
        };
      }

      const gRes = await fetch('/api/gamma', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(gammaRequestBody),
      });
      if (!gRes.ok) { const d = await gRes.json(); throw new Error(d.error || `生成失败(${gRes.status})`); }
      const gd = await gRes.json();

      if (gd.generationId) {
        // API 是异步的，需要轮询状态
        setGenStep(2);
        setGenProgress(60);
        setStepText('正在等待 AI 渲染 PPT...');

        // 轮询状态（最多 3 分钟）
        const startTime = Date.now();
        const pollInterval = 3000; // 🚨 优化：缩短轮询间隔，快速响应
        let finalExportUrl = '';

        while (Date.now() - startTime < 180000) { // 🚨 优化：延长超时到3分钟
          await new Promise(r => setTimeout(r, pollInterval));

          const statusRes = await fetch(`/api/gamma?id=${gd.generationId}`);
          if (!statusRes.ok) continue;

          const statusData = await statusRes.json();

          if (statusData.status === 'completed') {
            finalExportUrl = statusData.exportUrl || '';
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

        if (!finalExportUrl) {
          throw new Error('生成超时（2分钟），PPT内容较复杂，请稍后重试');
        }

        await new Promise(r => setTimeout(r, 500));
        setResult({ title: outlineResult.title, slides: editedSlides, dlUrl: finalExportUrl, actualPages: editedSlides.length });
        setGenProgress(100);
        setPhase('result');
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
      const item: UploadedFile = { name: f.name, type: f.type, size: f.size };
      if (f.type === 'text/plain' || /\.(md|txt|csv)$/.test(f.name)) {
        item.content = await f.text();
      } else if (f.type.startsWith('image/')) {
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
      r.push(item);
    }
    return r;
  };

  const fmtSize = (b: number) => b < 1024 ? b + ' B' : b < 1048576 ? (b / 1024).toFixed(1) + ' KB' : (b / 1048576).toFixed(1) + ' MB';

  return (
    <div className="min-h-screen bg-[#FAFBFE] flex flex-col">
      <Navbar onLogoClick={backToLanding} />

      {/* 顶部通知条 - 仅生成中阶段隐藏 */}
      {phase !== 'generating' && phase !== 'direct-generating' && (
        <ScrollingBanner variant="top" />
      )}

      {/* ===== LANDING PAGE ===== */}
      {phase === 'landing' && (
        <>
          <HeroSection onSelectMode={(m) => { setMode(m); setPhase('input'); window.scrollTo({ top: 0, behavior: 'smooth' }); }} />

          <SceneCards />
          <ProcessSection />
          <FAQSection />
          <TestimonialSection />
          {/* 底部极简导航 */}
          <div className="max-w-3xl mx-auto px-4 pt-6 pb-4">
            <div className="flex items-center justify-center gap-6 text-xs text-gray-400">
              <a href="/pricing" className="hover:text-[#5B4FE9] transition-colors">定价</a>
              <span>·</span>
              <a href="/account" className="hover:text-[#5B4FE9] transition-colors">用户中心</a>
              <span>·</span>
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
                      onClick={() => { if (!user) { openLogin(); return; } if (mode === 'direct') generateDirect(); else generateOutline(); }}
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
                  <input ref={fileRef} type="file" multiple accept=".txt,.md,.doc,.docx,.pdf,.xls,.xlsx,.csv,.png,.jpg,.jpeg,.webp,.ppt,.pptx" onChange={async e => { if (e.target.files?.length) { const processed = await fileProcess(e.target.files); setFiles(prev => [...prev, ...processed]); } e.target.value = ''; }} className="hidden" />

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

            {/* 2026-04-13: 省心模式暂时跳过 outline 编辑，直接生成 */}
            {/* {phase === 'outline' && outlineResult && ( */}
            {false && outlineResult && (
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
                              {(['noImages','pictographic','webFreeToUseCommercially','aiGenerated'] as const).map(src => (
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
                                  {{ noImages:'无图', pictographic:'套图', webFreeToUseCommercially:'网图', aiGenerated:'AI图' }[src]}
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

      {/* ===== RESULT ===== */}
      {phase === 'result' && result && !loading && (
        <div className="flex-1">
          <div className="max-w-2xl mx-auto px-4 md:px-6 pt-16 text-center animate-fade-in-up">
            <div className="text-5xl mb-4">🎉</div>
            <h2 className="text-xl font-bold text-gray-900 mb-1">PPT 已生成！</h2>
            <p className="text-xs text-gray-400 mb-8">{result.title} · {result.actualPages || result.slides.length || pages} 页</p>

            <div className="bg-white rounded-2xl border border-gray-100 p-6 mb-6">
              <div className="grid grid-cols-3 gap-4 mb-6">
                <div className="text-center">
                  <div className="text-2xl mb-1">📄</div>
                  <p className="text-xs text-gray-500">{result.actualPages || result.slides.length || pages} 页</p>
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
                {result.dlUrl && (
                  <button onClick={async () => {
                    const filename = result.title ? `省心PPT_${result.title.substring(0, 20)}.pptx` : '省心PPT.pptx';
                    if (result.dlUrl.startsWith('data:')) {
                      const link = document.createElement('a');
                      link.href = result.dlUrl;
                      link.download = filename;
                      document.body.appendChild(link);
                      link.click();
                      document.body.removeChild(link);
                      return;
                    }
                    // 统一走代理下载（服务端处理跨域和格式转换）
                    const proxyUrl = `/api/export?url=${encodeURIComponent(result.dlUrl)}&name=${encodeURIComponent(filename)}`;
                    try {
                      const res = await fetch(proxyUrl);
                      if (!res.ok) {
                        // 代理失败：尝试直接打开 Gamma 链接
                        if (result.dlUrl.includes('gamma.app')) {
                          window.open(result.dlUrl, '_blank');
                        }
                        alert('下载暂时失败，请点击「在线查看」打开 Gamma 页面，从右上角下载PPT');
                        return;
                      }
                      const blob = await res.blob();
                      if (blob.size < 1000) {
                        // 返回的不是有效文件（可能是错误页）
                        if (result.dlUrl.includes('gamma.app')) {
                          window.open(result.dlUrl, '_blank');
                        }
                        alert('下载暂时失败，请点击「在线查看」打开 Gamma 页面下载');
                        return;
                      }
                      const blobUrl = URL.createObjectURL(blob);
                      const link = document.createElement('a');
                      link.href = blobUrl;
                      link.download = filename;
                      document.body.appendChild(link);
                      link.click();
                      document.body.removeChild(link);
                      setTimeout(() => URL.revokeObjectURL(blobUrl), 5000);
                    } catch {
                      // 网络错误：尝试直接打开
                      if (result.dlUrl.includes('gamma.app')) {
                        window.open(result.dlUrl, '_blank');
                      }
                      alert('下载失败，请点击「在线查看」打开 Gamma 页面下载');
                    }
                  }} className="w-full sm:w-auto px-8 py-3.5 bg-gradient-to-r from-green-500 to-emerald-600 text-white rounded-xl text-sm font-semibold hover:shadow-lg hover:shadow-green-200/50 transition-all">
                    📥 下载 PPTX
                  </button>
                )}
                {result.dlUrl && (result.dlUrl.includes('gamma.app') || result.dlUrl.includes('Gamma') || result.dlUrl.includes('assets.api')) && (
                  <button onClick={() => window.open(result.dlUrl, '_blank')} className="w-full sm:w-auto px-6 py-3 text-purple-600 hover:text-purple-700 text-sm font-medium border border-purple-200 hover:border-purple-300 rounded-xl transition-all">
                    🔗 在线查看 / 下载
                  </button>
                )}
                <button onClick={reset} className="w-full sm:w-auto px-8 py-3.5 text-gray-500 hover:text-gray-700 text-sm font-medium hover:bg-gray-50 rounded-xl transition-all">
                  继续创建
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
        }}
        onClose={() => setShowThemePicker(false)}
      />
    </div>
  );
}
// Build: 20260411-120402
