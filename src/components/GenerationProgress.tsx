'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import ScrollingBanner from './ScrollingBanner';

interface GenerationProgressProps {
  currentStep: number;
  progress: number;
  subtext?: string;
}

const STEPS = [
  { id: 'analyze', label: '分析需求', icon: 'M10 18a8 8 0 1 1 5.7-2.3L21 21M8 10h8M8 13h5', desc: 'AI 正在理解你的主题...' },
  { id: 'outline', label: '生成大纲', icon: 'M7 4h10v16H7zM10 8h4M10 12h4M10 16h3', desc: '构建内容框架...' },
  { id: 'render', label: '渲染PPT', icon: 'M4 5h16v12H4zM8 21h8M12 17v4M8 13l2.5-3 2 2 2.5-4 3 5', desc: '设计精美页面...' },
  // 🚨 精简：移除「最终检查」这个空步骤
];

// 趣味等待提示
const FUN_TIPS = [
  'AI 正在精心设计，请耐心等待...',
  '每一页都在追求完美 🎨',
  '好的PPT值得等待 ✨',
  '正在为你的内容选择最佳布局...',
  'AI 排版大师工作中...',
  '马上就好，再等一下...',
];

export default function GenerationProgress({ currentStep, progress }: GenerationProgressProps) {
  const [displayProgress, setDisplayProgress] = useState(Math.max(0, Math.min(100, progress)));
  const [tipIndex, setTipIndex] = useState(0);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const startedAtRef = useRef<number | null>(null);
  const currentStepData = STEPS[currentStep] || STEPS[0];

  const remainingText = useMemo(() => {
    if (displayProgress >= 97) return '即将完成';
    if (elapsedSeconds < 3 || displayProgress < 8) return '正在估算剩余时间…';
    const estimated = Math.round(
      elapsedSeconds * (100 - displayProgress) / Math.max(displayProgress, 8)
    );
    const bounded = Math.max(3, Math.min(120, estimated));
    return `预计还需约 ${bounded} 秒`;
  }, [displayProgress, elapsedSeconds]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const previous = window.history.scrollRestoration;
    window.history.scrollRestoration = 'manual';
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
    return () => {
      window.history.scrollRestoration = previous;
    };
  }, []);

  useEffect(() => {
    const target = Math.max(0, Math.min(100, progress));
    const timer = window.setInterval(() => {
      setDisplayProgress((prev) => {
        if (prev >= target) return target;
        const distance = target - prev;
        const step = distance > 20 ? 2.4 : distance > 8 ? 1.4 : 0.8;
        return Math.min(target, prev + step);
      });
    }, 90);
    return () => window.clearInterval(timer);
  }, [progress]);

  useEffect(() => {
    startedAtRef.current = Date.now();
    const timer = window.setInterval(() => {
      const startedAt = startedAtRef.current;
      if (!startedAt) return;
      setElapsedSeconds(Math.floor((Date.now() - startedAt) / 1000));
    }, 1000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setTipIndex((prev) => (prev + 1) % FUN_TIPS.length);
    }, 8000);
    return () => window.clearInterval(timer);
  }, []);
  
  return (
    <div className="min-h-[calc(100svh-64px)] sx-shell flex flex-col relative overflow-hidden">
      {/* 顶部信息栏 */}
      <ScrollingBanner variant="wait" />

      <span className="sx-crystal hidden md:block" style={{ '--size': '82px', '--rotate': '18deg', '--opacity': '0.38', left: '10%', top: '38%' } as React.CSSProperties} />
      <span className="sx-crystal hidden md:block" style={{ '--size': '54px', '--rotate': '-24deg', '--opacity': '0.32', right: '13%', top: '24%' } as React.CSSProperties} />
      <div className="sx-orbit hidden lg:block w-[880px] h-[190px] left-1/2 -translate-x-1/2 top-[41%]" />

      <div className="relative flex-1 max-w-5xl mx-auto px-4 md:px-8 py-5 md:py-10 w-full">
        <div className="text-center mb-5 md:mb-7">
          <h1 className="text-3xl md:text-5xl font-black tracking-tight sx-gradient-text">{currentStepData.label}</h1>
        </div>

        <div className="max-w-xl mx-auto mb-5 md:mb-7">
          <div className="flex items-center gap-4">
            <div className="relative flex-1 h-4 rounded-full bg-white/70 border border-indigo-100 overflow-hidden shadow-inner">
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/50 to-transparent animate-shimmer" />
                <div
                  className="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-[#2f86ff] via-[#6c5cff] to-[#8b35ff] transition-all duration-700"
                  style={{ width: `${Math.max(8, Math.min(100, displayProgress))}%` }}
                />
              </div>
              <span className="text-2xl font-black sx-accent-text w-20 text-left">{Math.round(displayProgress)}%</span>
          </div>
          <p className="text-center text-xs text-slate-400 mt-3">{remainingText}</p>
        </div>

        <div className="grid lg:grid-cols-[1fr_340px] gap-5 md:gap-7 items-start">
          <div className="relative hidden md:block min-h-[360px] md:min-h-[430px]">
            <div className="sx-render-canvas !left-1/2 !right-auto !top-8 -translate-x-1/2 !w-[min(640px,92%)]">
              <div className="sx-render-canvas-inner">
                <span className="sx-render-pill sx-render-pill-lg" />
                <span className="sx-render-pill sx-render-pill-md" />
                <span className="sx-render-dot sx-render-dot-a" />
                <span className="sx-render-dot sx-render-dot-b" />
                <span className="sx-render-dot sx-render-dot-c" />
              </div>
            </div>
            <div className="sx-floating-panel hidden md:block left-[9%] top-[105px] w-36 h-28 p-4" style={{ animationDelay: '0.25s' }}>
              <p className="text-[10px] font-bold text-indigo-600 mb-3">市场分析</p>
              <div className="sx-mini-lines"><span /><span style={{ width: '72%' }} /><span style={{ width: '86%' }} /></div>
            </div>
            <div className="sx-floating-panel hidden md:block right-[7%] top-[126px] w-40 h-28 p-4" style={{ animationDelay: '0.7s' }}>
              <p className="text-[10px] font-bold text-indigo-600 mb-3">趋势图表</p>
              <div className="h-12 rounded-xl bg-gradient-to-tr from-indigo-100 via-white to-sky-100" />
            </div>
          </div>

          <div className="sx-glass-strong rounded-[28px] p-5 md:p-6">
            <h3 className="text-base font-black text-slate-900 mb-4">正在制作中…</h3>
            <div className="space-y-3">
              {[
                ['统一风格', '智能匹配品牌色与字体', true],
                ['补充配图', '为页面匹配高质量图片', currentStep >= 1],
                ['优化图表', '智能美化图表与数据可视化', currentStep >= 2],
                ['排版细节', '调整间距、对齐与层级关系', progress > 74],
                ['下载成品', '生成可编辑的 PPT 文件', progress >= 96],
              ].map(([title, desc, done]) => (
                <div key={String(title)} className="flex items-center gap-3 rounded-2xl bg-white/72 border border-indigo-50 p-3">
                  <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${done ? 'bg-gradient-to-br from-[#2f86ff] to-[#7c5cff] text-white' : 'bg-indigo-50 text-indigo-300'}`}>
                    {done ? (
                      <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M5 13l4 4L19 7" /></svg>
                    ) : (
                      <span className="w-3 h-3 rounded-full border-2 border-current border-t-transparent animate-spin" />
                    )}
                  </div>
                  <div>
                    <p className="text-sm font-bold text-slate-800">{title}</p>
                    <p className="text-xs text-slate-400 mt-0.5">{desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <p className="text-center mt-6 text-xs text-slate-400">{FUN_TIPS[tipIndex]}</p>
      </div>

      <style jsx>{`
        @keyframes shimmer {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(100%); }
        }
        .animate-shimmer {
          animation: shimmer 2.5s ease-in-out infinite;
        }
      `}</style>
    </div>
  );
}
