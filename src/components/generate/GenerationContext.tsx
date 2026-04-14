'use client';

import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import { useAuth } from '@/lib/auth-context';
import { checkPermission, mapImgModeToSource, getPlan } from '@/lib/membership';

export type Phase = 'landing' | 'input' | 'streaming' | 'outline' | 'generating' | 'direct-generating' | 'result';

export type UploadedFile = { name: string; type: string; size: number; content?: string };
export type SlideItem = { id: string; title: string; content?: string[]; notes?: string };

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
  outlineResult: { title: string; slides: SlideItem[]; themeId?: string } | null;
  smartGammaPayload: any;
  editedSlides: SlideItem[];
  streamingSlides: SlideItem[];
  dragIndex: number | null;
  dragOverIndex: number | null;
  
  // Result
  result: { title: string; slides: SlideItem[]; dlUrl: string; actualPages?: number } | null;
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
  setOutlineResult: (result: any) => void;
  setSmartGammaPayload: (payload: any) => void;
  setEditedSlides: (slides: SlideItem[]) => void;
  setStreamingSlides: (slides: SlideItem[]) => void;
  setResult: (result: any) => void;
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

const GenerationContext = createContext<GenerationState & GenerationActions>({} as any);

export function GenerationProvider({ children }: { children: ReactNode }) {
  const { user, openPayment, openLogin, updateCredits } = useAuth();

  const [phase, setPhase] = useState<Phase>('landing');
  const [mode, setMode] = useState<'direct' | 'smart'>('direct');
  const [topic, setTopic] = useState('');
  const [files, setFiles] = useState<UploadedFile[]>([]);
  const [hasInput, setHasInput] = useState(false);
  
  const [directTheme, setDirectTheme] = useState('default-light');
  const [directTone, setDirectTone] = useState('professional');
  const [directImgMode, setDirectImgMode] = useState('none');
  const [directTextMode, setDirectTextMode] = useState<'generate' | 'condense' | 'preserve'>('generate');
  const [pages, setPages] = useState(8);
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [stepText, setStepText] = useState('');
  const [genProgress, setGenProgress] = useState(0);
  const [genStep, setGenStep] = useState(0);
  
  const [outlineResult, setOutlineResult] = useState<{ title: string; slides: SlideItem[]; themeId?: string } | null>(null);
  const [smartGammaPayload, setSmartGammaPayload] = useState<any>(null);
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

    // 🚨 V6新增：计算待扣积分（用于回滚，提前声明避免catch作用域问题）
    const imgCredits = directImgMode === 'ai' || directImgMode === 'ai-pro' ? 2 : 0;
    const estImgs = Math.ceil(effectivePages / 2);
    const creditsToRollback = effectivePages * 2 + estImgs * imgCredits;

    try {

      const deductRes = await fetch('/api/user', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'deduct', userId: user.id, numPages: effectivePages, imageSource }),
      });
      const deductData = await deductRes.json();
      if (!deductRes.ok || deductData.error) {
        if (deductData.error === '积分不足') {
          setLoading(false); setPhase('input');
          openPayment({ id: 'basic', name: '积分不足，请充值', price: '¥29.9/月', billing: 'monthly', reason: '积分不足，无法生成PPT', neededCredits: deductData.needed, currentCredits: deductData.balance });
          return;
        }
        throw new Error(deductData.error || '积分扣除失败');
      }
      updateCredits(deductData.balance);
      setGenStep(1); setGenProgress(25); setStepText('AI 正在渲染 PPT 页面...');

      const gRes = await fetch('/api/gamma-direct', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
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
        await new Promise(r => setTimeout(r, 500));
        const topicText = inputText.split('\n')[0].replace(/^#\s*/, '').trim();
        setResult({ title: topicText || 'PPT', slides: [], dlUrl: finalExportUrl, actualPages: pages });
        setGenProgress(100); setPhase('result');
      }
    } catch (e: any) {
      // 🚨 V6新增：生成失败/超时时回滚积分
      if (user) {
        fetch('/api/user', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'rollback', userId: user.id, credits: creditsToRollback, reason: e.message || '生成失败' }) }).then(r => r?.ok && r.json().then(d => d?.balance != null && updateCredits(d.balance))).catch(() => {});
      }
      setError(e.message); setPhase('input');
    }
    setLoading(false);
  }, [user, collectText, directTheme, directTone, directImgMode, directTextMode, pages, openPayment, updateCredits]);

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
    } catch (e: any) { setError(e.message); setPhase('input'); }
    setLoading(false);
  }, [mode, collectText, pages]);

  // ========== generateSmartOutline（V6 简化：权限检查 + 调用统一流程）==========
  const generateSmartOutline = useCallback(async () => {
    if (!user) { openLogin(); return; }
    const smartPerm = checkPermission(user.plan_type || 'free', { numPages: 8, imageSource: 'noImages', mode: 'smart' });
    if (!smartPerm.allowed) {
      const reqPlan = smartPerm.requiredPlan || 'basic';
      const planInfo = getPlan(reqPlan);
      openPayment({ id: reqPlan, name: `${planInfo.name} · ${planInfo.emoji}`, price: planInfo.priceMonthly > 0 ? `¥${planInfo.priceMonthly}/月` : '免费', billing: 'monthly', reason: smartPerm.reason || '省心定制为会员专属功能' });
      return;
    }
    return generateOutline();
  }, [user, generateOutline]);

  // ========== confirmAndGenerate ==========
  const { buildMdV2 } = require('@/lib/build-md-v2');

  const confirmAndGenerate = useCallback(async () => {
    if (!outlineResult || !user) return;
    const userPlan = getPlan(user.plan_type || 'free');
    const imageSource = directImgMode === 'none' ? 'noImages' : directImgMode === 'ai' ? 'aiGenerated' : directImgMode === 'web' ? 'webFreeToUseCommercially' : 'pictographic';
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

    // 🚨 V6新增：计算待扣积分（用于回滚，提前声明避免catch作用域问题）
    const imgCredits3 = directImgMode === 'ai' || directImgMode === 'ai-pro' ? 2 : 0;
    const estImgs3 = Math.ceil(editedSlides.length / 2);
    const creditsToRollback3 = editedSlides.length * 2 + estImgs3 * imgCredits3;

    try {
      const tm = mode === 'smart' ? 'preserve' : 'generate';
      setGenStep(0); setGenProgress(10);
      const deductRes = await fetch('/api/user', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'deduct', userId: user.id, numPages: editedSlides.length, imageSource }),
      });
      const deductData = await deductRes.json();
      if (!deductRes.ok || deductData.error) {
        if (deductData.error === '积分不足') {
          setLoading(false); setPhase('outline');
          openPayment({ id: 'basic', name: '积分不足，请充值', price: '¥29.9/月', billing: 'monthly', reason: '积分不足，无法生成PPT', neededCredits: deductData.needed, currentCredits: deductData.balance });
          return;
        }
        throw new Error(deductData.error || '积分扣除失败');
      }
      updateCredits(deductData.balance);
      setGenStep(1); setGenProgress(25); setStepText('AI 正在优化内容...');
      await new Promise(r => setTimeout(r, 600));
      setGenStep(2); setGenProgress(40); setStepText(mode === 'smart' && smartGammaPayload ? '正在精准渲染...' : 'AI 正在渲染 PPT 页面...');

      let gammaRequestBody: any;
      if (mode === 'smart' && smartGammaPayload) {
        const { markdown: rebuiltMd } = buildMdV2(outlineResult.title, editedSlides, smartGammaPayload.imageOptions?.source || 'pictographic');
        gammaRequestBody = { ...smartGammaPayload, inputText: rebuiltMd, numCards: editedSlides.length, textMode: 'preserve' };
      } else {
        const { markdown: md, visualMetaphor } = buildMdV2(outlineResult.title, editedSlides, directImgMode);
        gammaRequestBody = { inputText: md, textMode: 'preserve', format: 'presentation', numCards: editedSlides.length, exportAs: 'pptx', themeId: directTheme, tone: directTone, imageMode: directImgMode, slides: editedSlides, visualMetaphor };
      }

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
        await new Promise(r => setTimeout(r, 500));
        setResult({ title: outlineResult.title, slides: editedSlides, dlUrl: finalExportUrl, actualPages: editedSlides.length });
        setGenProgress(100); setPhase('result');
      }
    } catch (e: any) {
      // 🚨 V6新增：生成失败/超时时回滚积分
      if (user) {
        fetch('/api/user', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'rollback', userId: user.id, credits: creditsToRollback3, reason: e.message || '生成失败' }) }).then(r => r?.ok && r.json().then(d => d?.balance != null && updateCredits(d.balance))).catch(() => {});
      }
      setError(e.message); setPhase('outline');
    }
    setLoading(false);
  }, [user, outlineResult, editedSlides, mode, smartGammaPayload, directTheme, directTone, directImgMode, updateCredits]);

  // Track hasInput
  useState(() => {
    setHasInput(files.length > 0 || topic.trim().length > 0);
  });

  const state: GenerationState = {
    phase, mode, topic, files, hasInput,
    directTheme, directTone, directImgMode, directTextMode, pages,
    loading, error, stepText, genProgress, genStep,
    outlineResult, smartGammaPayload, editedSlides, streamingSlides, dragIndex, dragOverIndex,
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

export const useGeneration = () => useContext(GenerationContext);
