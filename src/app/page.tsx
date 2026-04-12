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
import StreamingOutline from '@/components/StreamingOutline';
import GenerationProgress from '@/components/GenerationProgress';
// FloatingButton removed (unused)
import SkeletonCard from '@/components/SkeletonCard';
import ThemeSelector from '@/components/ThemeSelector';
import ScrollingBanner from '@/components/ScrollingBanner';
import { buildMdV2 } from '@/lib/build-md-v2';
import { checkPermission, mapImgModeToSource, getPlan } from '@/lib/membership';

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
  const [directImgMode, setDirectImgMode] = useState('none');
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
  const [imgMode, setImgMode] = useState('none');
  const [pages, setPages] = useState(10);

  // Generation state
  const [loading, setLoading] = useState(false);
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
  const [result, setResult] = useState<{ title: string; slides: SlideItem[]; dlUrl: string; gammaUrl?: string; actualPages?: number } | null>(null);

  const fileRef = useRef<HTMLInputElement>(null);

  const collectText = useCallback(() => {
    const p: string[] = [];
    files.forEach(f => p.push(f.content ? `[${f.name}]\n${f.content}` : `[${f.name}]`));
    if (topic.trim()) p.push(topic.trim());
    return p.join('\n\n');
  }, [files, topic]);

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

    // 🔐 会员权限检查
    const imageSource = mapImgModeToSource(directImgMode);
    const perm = checkPermission(user.plan_type || 'free', {
      numPages: pages,
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

    try {
      // Step 0: Deduct credits
      const deductRes = await fetch('/api/user', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'deduct', userId: user.id, numPages: pages, imageSource: directImgMode === 'none' ? 'noImages' : directImgMode === 'ai' ? 'aiGenerated' : directImgMode === 'web' ? 'webFreeToUseCommercially' : 'pictographic' }),
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
        const pollInterval = 4000;
        let finalExportUrl = '';

        let finalGammaUrl = '';

        while (Date.now() - startTime < 120000) {
          await new Promise(r => setTimeout(r, pollInterval));

          const statusRes = await fetch(`/api/gamma?id=${gd.generationId}`);
          if (!statusRes.ok) continue;

          const statusData = await statusRes.json();

          if (statusData.status === 'completed') {
            finalExportUrl = statusData.exportUrl || '';
            finalGammaUrl = statusData.gammaUrl || '';
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
        setResult({ title: topicText || 'PPT', slides: [], dlUrl: finalExportUrl, gammaUrl: finalGammaUrl, actualPages: pages });
        setGenProgress(100);
        setPhase('result');
      }
    } catch (e: any) {
      setError(e.message);
      setPhase('input');
    }
    setLoading(false);
  }, [user, collectText, directTheme, directTone, directImgMode, directTextMode, pages, openPayment]);

  // 省心模式生成流程：调用 smart-outline API（深度理解需求 + 自动确定参数）
  const generateSmartOutline = useCallback(async () => {
    const inputText = collectText();
    if (!inputText.trim()) return;
    if (!user) return;

    setLoading(true);
    setError('');
    setPhase('streaming');
    setGenStep(0);
    setGenProgress(5);
    setStepText('AI 正在深度理解你的需求...');

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

      // Step 2: 显示分析结果
      setGenProgress(30);
      setStepText(`识别场景: ${smartData.analysis?.scene || '通用'} · 主题: ${smartData.config?.themeName || '商务蓝'}`);

      await new Promise(r => setTimeout(r, 800));

      // Step 3: 显示大纲
      setGenProgress(50);
      setStreamingSlides(smartData.outline?.slides || []);
      setStepText('生成专业大纲...');

      await new Promise(r => setTimeout(r, smartData.outline?.slides?.length * 200 + 400));

      // Step 4: 进入大纲编辑阶段
      setOutlineResult({
        title: smartData.outline?.title || 'PPT',
        slides: smartData.outline?.slides || [],
        themeId: smartData.config?.themeId,
      });
      setEditedSlides(smartData.outline?.slides || []);

      // 保存 Gamma Payload（后续生成时直接使用）
      setSmartGammaPayload(smartData.gammaPayload);

      setGenProgress(100);
      setPhase('outline');
    } catch (e: any) {
      setError(e.message);
      setPhase('input');
    }
    setLoading(false);
  }, [user, files, topic, collectText]);

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
    const imageSource = imgMode === 'none' ? 'noImages' : imgMode === 'ai' ? 'aiGenerated' : imgMode === 'web' ? 'webFreeToUseCommercially' : 'pictographic';
    const numPages = editedSlides.length;
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

    try {
      const tm = mode === 'smart' ? 'preserve' : genMode;

      // Step 0: Deduct credits
      setGenStep(0);
      setGenProgress(10);
      const deductRes = await fetch('/api/user', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'deduct', userId: user.id, numPages: editedSlides.length, imageSource: imgMode === 'none' ? 'noImages' : imgMode === 'ai' ? 'aiGenerated' : imgMode === 'web' ? 'webFreeToUseCommercially' : 'pictographic' }),
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
        // 省心模式：用 smartGammaPayload（AI 已分析并生成完整参数）
        // 用户可能编辑了大纲，需要重建 inputText
        const { markdown: rebuiltMd } = buildMdV2(outlineResult.title, editedSlides, smartGammaPayload.imageOptions?.source || 'pictographic');
        gammaRequestBody = {
          ...smartGammaPayload,
          inputText: rebuiltMd, // 用用户编辑后的大纲
          numCards: editedSlides.length, // 更新页数
        };
      } else {
        // 专业模式：用用户选择的参数
        const { markdown: md, visualMetaphor } = buildMdV2(outlineResult.title, editedSlides, imgMode);
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
      if (!gRes.ok) throw new Error('PPT 生成失败');
      const gd = await gRes.json();

      if (gd.generationId) {
        // API 是异步的，需要轮询状态
        setGenStep(3);
        setGenProgress(60);
        setStepText('正在等待 AI 渲染 PPT...');

        // 轮询状态（最多 2 分钟）
        const startTime = Date.now();
        const pollInterval = 4000;
        let finalExportUrl = '';
        let finalGammaUrl = '';

        while (Date.now() - startTime < 120000) {
          await new Promise(r => setTimeout(r, pollInterval));

          const statusRes = await fetch(`/api/gamma?id=${gd.generationId}`);
          if (!statusRes.ok) continue;

          const statusData = await statusRes.json();

          if (statusData.status === 'completed') {
            finalExportUrl = statusData.exportUrl || '';
            finalGammaUrl = statusData.gammaUrl || '';
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
        setResult({ title: outlineResult.title, slides: editedSlides, dlUrl: finalExportUrl, gammaUrl: finalGammaUrl, actualPages: editedSlides.length });
        setGenProgress(100);
        setPhase('result');
      }
    } catch (e: any) {
      setError(e.message);
      setPhase('outline');
    }
    setLoading(false);
  }, [user, outlineResult, editedSlides, showPro, genMode, theme, tone, imgMode]);

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
          <div className="max-w-3xl mx-auto px-4 md:px-6 pt-8 pb-24">

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
                      onClick={() => setMode('smart')}
                      className={`flex-1 py-2.5 rounded-xl border text-center transition-all text-sm font-medium ${
                        mode === 'smart'
                          ? 'border-[#5B4FE9] bg-[#F5F3FF] text-[#4338CA] shadow-sm'
                          : 'border-gray-200 text-gray-400 hover:border-gray-300'
                      }`}
                    >
                      ✨ 省心定制
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
                          <label className="text-xs text-gray-500 mb-1 block">页数{user?.plan_type && user.plan_type !== 'free' ? '' : ' · 免费最多8页'}</label>
                          <select
                            value={Math.min(pages, getPlan(user?.plan_type || 'free').maxPages)}
                            onChange={e => setPages(Number(e.target.value))}
                            className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm bg-white"
                          >
                            {[5,6,7,8,9,10,12,15,20,25,30]
                              .filter(n => n <= getPlan(user?.plan_type || 'free').maxPages)
                              .map(n => (
                              <option key={n} value={n}>{n} 页</option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label className="text-xs text-gray-500 mb-1 block">配图风格</label>
                          <select
                            value={directImgMode}
                            onChange={e => setDirectImgMode(e.target.value)}
                            className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm bg-white"
                          >
                            <option value="none">纯净无图</option>
                            <option value="emphasis">精选套图</option>
                            <option value="web">定制网图</option>
                            <option value="ai">定制AI图</option>
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

            {phase === 'outline' && outlineResult && (
              <>
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h2 className="text-lg font-bold text-gray-900">{outlineResult.title}</h2>
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
                        <div className="flex-shrink-0 flex items-center gap-1 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
                          <button onClick={() => moveSlide(idx, -1)} className="w-7 h-7 rounded-lg text-gray-300 hover:text-gray-600 hover:bg-gray-100 flex items-center justify-center transition-colors" title="上移">
                            <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 15l-6-6-6 6"/></svg>
                          </button>
                          <button onClick={() => moveSlide(idx, 1)} className="w-7 h-7 rounded-lg text-gray-300 hover:text-gray-600 hover:bg-gray-100 flex items-center justify-center transition-colors" title="下移">
                            <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 9l6 6 6-6"/></svg>
                          </button>
                          <button onClick={() => removeSlide(idx)} className="w-7 h-7 rounded-lg text-gray-300 hover:text-red-500 hover:bg-red-50 flex items-center justify-center transition-colors" title="删除此页">
                            <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg>
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                  <button onClick={addSlide} className="w-full py-2.5 border border-dashed border-gray-200 rounded-xl text-xs text-gray-400 hover:text-[#5B4FE9] hover:border-[#5B4FE9] transition-colors">+ 添加幻灯片</button>

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
          {/* 滚动信息栏 */}
          <div className="mt-6">
            <ScrollingBanner variant="hero" />
          </div>
        </div>
      )}

      {/* ===== STREAMING OUTLINE ===== */}
      {phase === 'streaming' && (
        <div className="flex-1">
          <div className="max-w-3xl mx-auto px-4 md:px-6 pt-8 pb-24">
            <button onClick={() => { setPhase('input'); setLoading(false); }} className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-gray-600 mb-6 transition-colors">← 取消</button>

            <div className="mb-4">
              <h2 className="text-lg font-bold text-gray-900">AI 正在生成大纲...</h2>
              <p className="text-xs text-gray-400 mt-0.5">请稍候，大纲会逐条显示</p>
            </div>

            {streamingSlides.length > 0 ? (
              <StreamingOutline slides={streamingSlides} />
            ) : (
              <div className="space-y-2">
                <SkeletonCard lines={2} />
                <SkeletonCard lines={3} />
                <SkeletonCard lines={2} />
              </div>
            )}
          </div>
        </div>
      )}

      {/* ===== DIRECT GENERATING PROGRESS ===== */}
      {phase === 'direct-generating' && (
        <>
          <ScrollingBanner variant="wait" />
          <GenerationProgress
            currentStep={genStep}
            progress={genProgress}
            subtext={stepText}
          />
        </>
      )}

      {/* ===== GENERATING PROGRESS ===== */}
      {phase === 'generating' && loading && (
        <>
          <ScrollingBanner variant="wait" />
          <GenerationProgress currentStep={genStep} progress={genProgress} subtext={stepText} />
        </>
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
                  <button onClick={() => {
                    if (result.dlUrl.startsWith('data:')) {
                      const link = document.createElement('a');
                      link.href = result.dlUrl;
                      link.download = result.title ? `省心PPT_${result.title.substring(0, 20)}.pptx` : '省心PPT.pptx';
                      document.body.appendChild(link);
                      link.click();
                      document.body.removeChild(link);
                    } else if (result.dlUrl.includes('assets.api')) {
                      const filename = result.title ? `省心PPT_${result.title.substring(0, 20)}.pptx` : '省心PPT.pptx';
                      const proxyUrl = `/api/export?url=${encodeURIComponent(result.dlUrl)}&name=${encodeURIComponent(filename)}`;
                      const link = document.createElement('a');
                      link.href = proxyUrl;
                      link.download = filename;
                      document.body.appendChild(link);
                      link.click();
                      document.body.removeChild(link);
                    } else {
                      window.open(result.dlUrl, '_blank');
                    }
                  }} className="w-full sm:w-auto px-8 py-3.5 bg-gradient-to-r from-green-500 to-emerald-600 text-white rounded-xl text-sm font-semibold hover:shadow-lg hover:shadow-green-200/50 transition-all">
                    📥 下载 PPTX
                  </button>
                )}
                {result.gammaUrl && (
                  <a href={result.gammaUrl} target="_blank" rel="noopener noreferrer"
                    className="w-full sm:w-auto px-8 py-3.5 text-purple-600 hover:text-purple-700 text-sm font-medium border border-purple-200 hover:border-purple-300 rounded-xl transition-all">
                    🔗 在线编辑查看
                  </a>
                )}
                <button onClick={reset} className="w-full sm:w-auto px-8 py-3.5 text-gray-500 hover:text-gray-700 text-sm font-medium hover:bg-gray-50 rounded-xl transition-all">
                  继续创建
                </button>
              </div>

              {/* 图标兼容性提示 */}
              <p className="text-[10px] text-gray-300 mt-4 text-center">
                💡 提示：下载的 PPTX 中部分图标可能无法显示，建议点击「在线编辑查看」查看完整效果
              </p>
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
    </div>
  );
}
// Build: 20260411-120402
