'use client';

import React, { createContext, useContext, useState, useCallback, useEffect, ReactNode } from 'react';
import { useAuth } from '@/lib/auth-context';
import { checkPermission, mapImgModeToSource, getPlan } from '@/lib/membership';
import { buildMdV2 } from '@/lib/build-md-v2';
import { DEFAULT_THEME_ID } from '@/lib/theme-database';

export type Phase = 'landing' | 'input' | 'streaming' | 'outline' | 'generating' | 'direct-generating' | 'result';

export type UploadedFile = { name: string; type: string; size: number; content?: string };
export type SlideItem = { id: string; title: string; content?: string[]; notes?: string };
type OutlineResultPayload = { title: string; slides: SlideItem[]; themeId?: string; tone?: string; imageMode?: string };
type GenerationResultPayload = { title: string; slides: SlideItem[]; dlUrl: string; actualPages?: number };
type SmartGammaPayloadState = Record<string, unknown> | null;

interface GenerationState {
  phase: Phase;
  mode: 'direct' | 'smart';
  topic: string;
  files: UploadedFile[];
  hasInput: boolean;
  
  // Direct mode params
  directTheme: string;
  directTone: string;
  directImgMode: string;
  directTextMode: 'generate' | 'condense' | 'preserve';
  pages: number;
  
  // Generation state
  loading: boolean;
  error: string;
  stepText: string;
  genProgress: number;
  genStep: number;
  
  // Outline & Smart mode
  outlineResult: OutlineResultPayload | null;
  smartGammaPayload: SmartGammaPayloadState;
  editedSlides: SlideItem[];
  streamingSlides: SlideItem[];
  dragIndex: number | null;
  dragOverIndex: number | null;
  
  // Result
  result: GenerationResultPayload | null;
}

interface GenerationActions {
  setPhase: (phase: Phase) => void;
  setMode: (mode: 'direct' | 'smart') => void;
  setTopic: (topic: string) => void;
  setFiles: (files: UploadedFile[]) => void;
  setDirectTheme: (theme: string) => void;
  setDirectTone: (tone: string) => void;
  setDirectImgMode: (mode: string) => void;
  setDirectTextMode: (mode: 'generate' | 'condense' | 'preserve') => void;
  setPages: (pages: number) => void;
  setError: (error: string) => void;
  setLoading: (loading: boolean) => void;
  setOutlineResult: (result: OutlineResultPayload | null) => void;
  setSmartGammaPayload: (payload: SmartGammaPayloadState) => void;
  setEditedSlides: (slides: SlideItem[]) => void;
  setStreamingSlides: (slides: SlideItem[]) => void;
  setResult: (result: GenerationResultPayload | null) => void;
  collectText: () => string;
  reset: () => void;
  backToLanding: () => void;
  backToOutline: () => void;
  generateDirect: () => Promise<void>;
  generateOutline: () => Promise<void>;
  confirmAndGenerate: () => Promise<void>;
  updateSlide: (idx: number, field: 'title' | 'content', val: string) => void;
  addSlide: () => void;
  removeSlide: (idx: number) => void;
  moveSlide: (idx: number, dir: -1 | 1) => void;
  handleDragStart: (idx: number) => void;
  handleDragOver: (e: React.DragEvent, idx: number) => void;
  handleDrop: (idx: number) => void;
  handleDragEnd: () => void;
}

const GenerationContext = createContext<(GenerationState & GenerationActions) | null>(null);

export function GenerationProvider({ children }: { children: ReactNode }) {
  const { user, openPayment, openLogin, updateCredits } = useAuth();

  const [phase, setPhase] = useState<Phase>('landing');
  const [mode, setMode] = useState<'direct' | 'smart'>('direct');
  const [topic, setTopic] = useState('');
  const [files, setFiles] = useState<UploadedFile[]>([]);
  const [hasInput, setHasInput] = useState(false);
  
  const [directTheme, setDirectTheme] = useState<string>(DEFAULT_THEME_ID);
  const [directTone, setDirectTone] = useState('professional');
  const [directImgMode, setDirectImgMode] = useState('theme-img');
  const [directTextMode, setDirectTextMode] = useState<'generate' | 'condense' | 'preserve'>('generate');
  const [pages, setPages] = useState(8);
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [stepText, setStepText] = useState('');
  const [genProgress, setGenProgress] = useState(0);
  const [genStep, setGenStep] = useState(0);
  
  const [outlineResult, setOutlineResult] = useState<OutlineResultPayload | null>(null);
  const [smartGammaPayload, setSmartGammaPayload] = useState<SmartGammaPayloadState>(null);
  const [editedSlides, setEditedSlides] = useState<SlideItem[]>([]);
  const [streamingSlides, setStreamingSlides] = useState<SlideItem[]>([]);
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  
  const [result, setResult] = useState<{ title: string; slides: SlideItem[]; dlUrl: string; actualPages?: number } | null>(null);

  const collectText = useCallback(() => {
    const p: string[] = [];
    files.forEach(f => p.push(f.content ? `[${f.name}]\n${f.content}` : `[${f.name}]`));
    if (topic.trim()) p.push(topic.trim());
    return p.join('\n\n');
  }, [files, topic]);

  const openInsufficientCreditsPayment = useCallback((needed: number, balance: number, reason = '积分不足，无法生成PPT') => {
    openPayment({
      id: 'shengxin',
      name: '积分不足，请充值',
      price: '¥19.9/月',
      billing: 'monthly',
      reason,
      neededCredits: needed,
      currentCredits: balance,
    });
  }, [openPayment]);

  const getDirectAiModel = useCallback((imgMode: string): string | undefined => {
    if (imgMode === 'ai-pro') return 'imagen-3-pro';
    if (imgMode === 'ai') return 'imagen-3-flash';
    return undefined;
  }, []);

  const estimateGenerationCredits = useCallback(async (payload: {
    numPages: number;
    imageSource: string;
    imageModel?: string;
    estimatedImages?: number;
  }) => {
    if (!user) throw new Error('请先登录');
    const res = await fetch('/api/user', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'estimate_generation',
        userId: user.id,
        ...payload,
      }),
    });
    const data = await res.json();
    if (!res.ok || data.error) throw new Error(data.error || '积分预算校验失败');
    return data as { needed: number; balance: number; sufficient: boolean };
  }, [user]);

  const settleGenerationCredits = useCallback(async (payload: {
    generationId: string;
    numPages: number;
    imageSource: string;
    imageModel?: string;
    estimatedImages?: number;
  }) => {
    if (!user) throw new Error('请先登录');
    const res = await fetch('/api/user', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'settle_generation',
        userId: user.id,
        ...payload,
      }),
    });
    const data = await res.json();
    if (!res.ok || data.error) {
      if (data.error === '积分不足') {
        openInsufficientCreditsPayment(Number(data.needed || 0), Number(data.balance || 0), '积分不足，请补充后继续生成');
      }
      throw new Error(data.error || '积分结算失败');
    }
    if (typeof data.balance === 'number') updateCredits(data.balance);
    return data as { creditsUsed: number; balance: number; alreadySettled?: boolean };
  }, [user, openInsufficientCreditsPayment, updateCredits]);

  useState(() => {
    // Track hasInput
  });

  const reset = () => {
    setLoading(false);
    setError('');
    setResult(null);
    setOutlineResult(null);
    setEditedSlides([]);
    setStreamingSlides([]);
    setFiles([]);
    setTopic('');
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
    if (idx < 2) { alert('封面页和目录页不可删除'); return; }
    if (!window.confirm(`确定要删除第 ${idx + 1} 页吗？`)) return;
    setEditedSlides(prev => prev.filter((_, i) => i !== idx));
  };
  
  const moveSlide = (idx: number, dir: -1 | 1) => {
    const newIdx = idx + dir;
    if (newIdx < 0 || newIdx >= editedSlides.length) return;
    setEditedSlides(prev => { const arr = [...prev]; [arr[idx], arr[newIdx]] = [arr[newIdx], arr[idx]]; return arr; });
  };

  const handleDragStart = (idx: number) => setDragIndex(idx);
  const handleDragOver = (e: React.DragEvent, idx: number) => {
    e.preventDefault();
    if (dragIndex !== null && dragIndex !== idx) setDragOverIndex(idx);
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
  const handleDragEnd = () => { setDragIndex(null); setDragOverIndex(null); };

  // ========== generateDirect ==========
  const generateDirect = useCallback(async () => {
    const inputText = collectText();
    if (!inputText.trim()) return;
    if (!user) { openLogin(); return; }

    const userPlan = getPlan(user.plan_type || 'free');
    const effectivePages = Math.min(pages, userPlan.maxPages);
    const imageSource = mapImgModeToSource(directImgMode);
    const perm = checkPermission(user.plan_type || 'free', { numPages: effectivePages, imageSource, mode: 'direct' });
    if (!perm.allowed) {
      setError(perm.reason || '当前套餐权限不足');
      const reqPlan = perm.requiredPlan || 'basic';
      const planInfo = getPlan(reqPlan);
      openPayment({ id: reqPlan, name: `${planInfo.name} · ${planInfo.emoji}`, price: planInfo.priceMonthly > 0 ? `¥${planInfo.priceMonthly}/月` : '免费', billing: 'monthly', reason: perm.reason });
      return;
    }

    setLoading(true); setError(''); setPhase('direct-generating'); setGenStep(0); setGenProgress(10); setStepText('AI 正在提交生成任务...');
    const imageModel = getDirectAiModel(directImgMode);

    try {
      const estimate = await estimateGenerationCredits({
        numPages: effectivePages,
        imageSource,
        imageModel,
      });
      if (!estimate.sufficient) {
        setLoading(false); setPhase('input');
        openInsufficientCreditsPayment(Number(estimate.needed || 0), Number(estimate.balance || 0));
        return;
      }
      setGenStep(1); setGenProgress(25); setStepText('AI 正在渲染 PPT 页面...');

      const gRes = await fetch('/api/gamma-direct', {
        method: 'POST', headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${user.id}`,
        },
        body: JSON.stringify({ inputText, themeId: directTheme, numCards: pages, imageSource: directImgMode, tone: directTone, textMode: directTextMode, exportAs: 'pptx' }),
      });
      if (!gRes.ok) { const d = await gRes.json(); throw new Error(d.error || 'PPT 生成失败'); }
      const gd = await gRes.json();

      if (gd.generationId) {
        setGenStep(2); setGenProgress(50); setStepText('正在等待 AI 渲染 PPT...');
        const startTime = Date.now(); let finalExportUrl = '';
        while (Date.now() - startTime < 180000) { // 🚨 优化：延长超时到3分钟
          await new Promise(r => setTimeout(r, 3000)); // 🚨 优化：缩短轮询间隔到3秒
          const statusRes = await fetch(`/api/gamma?id=${gd.generationId}`);
          if (!statusRes.ok) continue;
          const statusData = await statusRes.json();
          if (statusData.status === 'completed') { finalExportUrl = statusData.exportUrl || ''; setGenProgress(90); setStepText('PPT 生成完成，准备下载...'); break; }
          if (statusData.status === 'failed') throw new Error(statusData.error || '生成失败');
          const elapsed = Math.floor((Date.now() - startTime) / 1000);
          setStepText(`AI 渲染中... ${elapsed}秒`);
        }
        if (!finalExportUrl) throw new Error('生成超时（3分钟），PPT内容较复杂，请稍后重试');
        await settleGenerationCredits({
          generationId: gd.generationId,
          numPages: effectivePages,
          imageSource,
          imageModel,
        });
        await new Promise(r => setTimeout(r, 500));
        const topicText = inputText.split('\n')[0].replace(/^#\s*/, '').trim();
        setResult({ title: topicText || 'PPT', slides: [], dlUrl: finalExportUrl, actualPages: pages });
        setGenProgress(100); setPhase('result');
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : '生成失败'); setPhase('input');
    }
    setLoading(false);
  }, [user, collectText, directTheme, directTone, directImgMode, directTextMode, pages, openLogin, openPayment, getDirectAiModel, estimateGenerationCredits, openInsufficientCreditsPayment, settleGenerationCredits]);

  // ========== generateOutline（V6 标准化：所有模式统一走 outline API）==========
  const generateOutline = useCallback(async () => {
    const inputText = collectText();
    if (!inputText.trim()) return;
    setLoading(true); setError(''); setPhase('streaming'); setGenStep(0); setGenProgress(10); setStepText('AI 正在分析你的需求...');
    try {
      // ====== V6 标准化 ======
      let textMode = 'generate';
      let auto = false;
      if (mode === 'smart') { textMode = 'preserve'; auto = true; }
      // 专业模式（direct）在 GenerationContext 中默认 generate
      // genMode 的判断由 page.tsx 的 generateOutline 处理

      await new Promise(r => setTimeout(r, 800));
      setGenStep(1); setGenProgress(30); setStepText('AI 正在生成大纲...');
      const oRes = await fetch('/api/outline', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ inputText, slideCount: pages, textMode, auto }),
      });
      if (!oRes.ok) { const d = await oRes.json(); throw new Error(d.error || '大纲生成失败'); }
      const od = await oRes.json();
      setGenProgress(60); setStreamingSlides(od.slides || []);
      await new Promise(r => setTimeout(r, (od.slides?.length || 0) * 300 + 500));
      setOutlineResult(od); setEditedSlides(od.slides || []); setPhase('outline'); setGenProgress(100);
    } catch (e: unknown) { setError(e instanceof Error ? e.message : '大纲生成失败'); setPhase('input'); }
    setLoading(false);
  }, [mode, collectText, pages]);

  // ========== generateSmartOutline（V6 简化：权限检查 + 调用统一流程）==========
  // ========== confirmAndGenerate ==========

  const confirmAndGenerate = useCallback(async () => {
    if (!outlineResult || !user) return;
    const userPlan = getPlan(user.plan_type || 'free');
    const imageSource = directImgMode === 'ai'
      ? 'aiGenerated'
      : directImgMode === 'web'
        ? 'pexels'
        : directImgMode === 'noImages'
          ? 'noImages'
          : 'themeAccent';
    const numPages = Math.min(editedSlides.length, userPlan.maxPages);
    const perm = checkPermission(user.plan_type || 'free', { numPages, imageSource, mode: mode === 'smart' ? 'smart' : 'direct' });
    if (!perm.allowed) {
      setError(perm.reason || '当前套餐权限不足');
      const reqPlan = perm.requiredPlan || 'basic';
      const planInfo = getPlan(reqPlan);
      openPayment({ id: reqPlan, name: `${planInfo.name} · ${planInfo.emoji}`, price: planInfo.priceMonthly > 0 ? `¥${planInfo.priceMonthly}/月` : '免费', billing: 'monthly', reason: perm.reason });
      return;
    }
    setLoading(true); setError(''); setPhase('generating'); setGenStep(0); setGenProgress(0); setStepText('AI 正在准备渲染...');
    const imageModel = getDirectAiModel(directImgMode);

    try {
      setGenStep(0); setGenProgress(10);
      const estimate = await estimateGenerationCredits({
        numPages: editedSlides.length,
        imageSource,
        imageModel,
      });
      if (!estimate.sufficient) {
        setLoading(false); setPhase('outline');
        openInsufficientCreditsPayment(Number(estimate.needed || 0), Number(estimate.balance || 0));
        return;
      }
      setGenStep(1); setGenProgress(25); setStepText('AI 正在优化内容...');
      await new Promise(r => setTimeout(r, 600));
      setGenStep(2); setGenProgress(40); setStepText('AI 正在渲染 PPT 页面...');

      // 🚨 V6 统一：所有模式都用 buildMdV2
      const { markdown: md, visualMetaphor } = buildMdV2(outlineResult.title, editedSlides, directImgMode);
      // 🚨 V6.1 修复：themeId/tone 优先从 outlineResult 取
      const finalThemeId = (directTheme !== 'auto' ? directTheme : outlineResult.themeId) || DEFAULT_THEME_ID;
      const finalTone = directTone || outlineResult.tone || 'professional';
      // P0 Fix: 删除 slides 字段，Gamma API 不接受此参数，会导致 400 错误
      // P1 Fix: 当 genMode='condense' 时，Gamma 只支持 preserve 模式（已硬编码）
      const gammaRequestBody = { inputText: md, textMode: 'preserve', format: 'presentation', numCards: editedSlides.length, exportAs: 'pptx', themeId: finalThemeId, tone: finalTone, imageMode: directImgMode, visualMetaphor };

      const gRes = await fetch('/api/gamma', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(gammaRequestBody),
      });
      if (!gRes.ok) { const d = await gRes.json(); throw new Error(d.error || `生成失败(${gRes.status})`); }
      const gd = await gRes.json();
      if (gd.generationId) {
        setGenStep(2); setGenProgress(60); setStepText('正在等待 AI 渲染 PPT...');
        const startTime = Date.now(); let finalExportUrl = '';
        while (Date.now() - startTime < 180000) { // 🚨 优化：延长超时到3分钟
          await new Promise(r => setTimeout(r, 3000)); // 🚨 优化：缩短轮询间隔到3秒
          const statusRes = await fetch(`/api/gamma?id=${gd.generationId}`);
          if (!statusRes.ok) continue;
          const statusData = await statusRes.json();
          if (statusData.status === 'completed') { finalExportUrl = statusData.exportUrl || ''; setGenProgress(90); setStepText('PPT 生成完成，准备下载...'); break; }
          if (statusData.status === 'failed') throw new Error(statusData.error || '生成失败');
          const elapsed = Math.floor((Date.now() - startTime) / 1000);
          setStepText(`AI 渲染中... ${elapsed}秒`);
        }
        if (!finalExportUrl) throw new Error('生成超时（3分钟），PPT内容较复杂，请稍后重试');
        await settleGenerationCredits({
          generationId: gd.generationId,
          numPages: editedSlides.length,
          imageSource,
          imageModel,
        });
        await new Promise(r => setTimeout(r, 500));
        setResult({ title: outlineResult.title, slides: editedSlides, dlUrl: finalExportUrl, actualPages: editedSlides.length });
        setGenProgress(100); setPhase('result');
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : '生成失败'); setPhase('outline');
    }
    setLoading(false);
  }, [user, outlineResult, editedSlides, mode, directTheme, directTone, directImgMode, openPayment, getDirectAiModel, estimateGenerationCredits, openInsufficientCreditsPayment, settleGenerationCredits]);

  // Track hasInput
  useEffect(() => {
    setHasInput(files.length > 0 || topic.trim().length > 0);
  }, [files, topic]);

  const state: GenerationState = {
    phase, mode, topic, files, hasInput,
    directTheme, directTone, directImgMode, directTextMode, pages,
    loading, error, stepText, genProgress, genStep,
    outlineResult, editedSlides, streamingSlides, dragIndex, dragOverIndex,
    smartGammaPayload,
    result,
  };

  const actions: GenerationActions = {
    setPhase, setMode, setTopic, setFiles,
    setDirectTheme, setDirectTone, setDirectImgMode, setDirectTextMode, setPages,
    setError, setLoading, setOutlineResult, setSmartGammaPayload,
    setEditedSlides, setStreamingSlides, setResult,
    collectText, reset, backToLanding, backToOutline,
    generateDirect, generateOutline, confirmAndGenerate,
    updateSlide, addSlide, removeSlide, moveSlide,
    handleDragStart, handleDragOver, handleDrop, handleDragEnd,
  };

  return <GenerationContext.Provider value={{ ...state, ...actions }}>{children}</GenerationContext.Provider>;
}

export const useGeneration = () => {
  const ctx = useContext(GenerationContext);
  if (!ctx) throw new Error('useGeneration must be used within GenerationProvider');
  return ctx;
};
