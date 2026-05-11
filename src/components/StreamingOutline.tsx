'use client';

import React, { useState, useRef, useEffect } from 'react';

interface SlideItem {
  id: string;
  title: string;
  content?: string[];
  notes?: string;
}

interface StreamingOutlineProps {
  slides: SlideItem[];
  onComplete?: () => void;
}

type Stage = 'analyzing' | 'planning' | 'generating' | 'polishing' | 'complete';

const STAGE_TIPS: Record<Stage, string[]> = {
  analyzing: ['正在分析您的主题...', '理解您的需求中...', '正在提取关键信息...'],
  planning: ['正在规划PPT结构...', '设计故事线中...', '构思页面逻辑...'],
  generating: ['正在生成大纲内容...', '正在组织语言...', '正在完善要点...'],
  polishing: ['正在优化内容...', '调整细节中...', '润色文案...'],
  complete: ['大纲生成完成！', '✨ 准备就绪'],
};

const STAGE_ICONS: Record<Stage, string> = {
  analyzing: '🔍',
  planning: '📋',
  generating: '✍️',
  polishing: '🎨',
  complete: '✅',
};

function getStageFromProgress(current: number, total: number, prevStage: Stage): Stage {
  if (current >= total) return 'complete';
  if (current === 0 && prevStage !== 'complete') return 'analyzing';
  if (current > 0 && current < total * 0.3) return 'planning';
  if (current >= total * 0.3 && current < total * 0.9) return 'generating';
  if (current >= total * 0.9 && current < total) return 'polishing';
  return 'generating';
}

export default function StreamingOutline({ slides, onComplete }: StreamingOutlineProps) {
  const [visibleSlides, setVisibleSlides] = useState(0);
  const [typingIdx, setTypingIdx] = useState(-1);
  const [typingText, setTypingText] = useState('');
  const [done, setDone] = useState(false);
  const [stage, setStage] = useState<Stage>('analyzing');
  const [tipIndex, setTipIndex] = useState(0);
  const currentSlideRef = useRef<HTMLDivElement>(null);
  const tipRef = useRef<NodeJS.Timeout | null>(null);

  // Determine stage from progress
  useEffect(() => {
    const newStage = getStageFromProgress(visibleSlides, slides.length, stage);
    if (newStage !== stage) {
      setStage(newStage);
      setTipIndex(0);
    }
  }, [visibleSlides, slides.length]);

  // Cycle tips for current stage
  useEffect(() => {
    if (done) return;
    tipRef.current = setInterval(() => {
      setTipIndex(prev => (prev + 1) % STAGE_TIPS[stage].length);
    }, 2000);
    return () => {
      if (tipRef.current) clearInterval(tipRef.current);
    };
  }, [stage, done]);

  // Animate slides appearing one by one
  useEffect(() => {
    if (visibleSlides >= slides.length) {
      setDone(true);
      setStage('complete');
      onComplete?.();
      return;
    }

    const timer = setTimeout(() => {
      setTypingIdx(visibleSlides);
      setTypingText('');
    }, 300);
    return () => clearTimeout(timer);
  }, [visibleSlides, slides.length, onComplete]);

  // Typewriter effect for slide title
  useEffect(() => {
    if (typingIdx < 0 || typingIdx >= slides.length) return;

    const slide = slides[typingIdx];
    const fullTitle = slide.title;
    let charIdx = 0;

    const interval = setInterval(() => {
      charIdx++;
      setTypingText(fullTitle.slice(0, charIdx));

      if (charIdx >= fullTitle.length) {
        clearInterval(interval);
        setTimeout(() => {
          setTypingIdx(-1);
          setVisibleSlides(prev => prev + 1);
        }, 200);
      }
    }, 30);

    return () => clearInterval(interval);
  }, [typingIdx, slides]);

  // Auto scroll
  useEffect(() => {
    currentSlideRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, [visibleSlides, typingIdx]);

  const progress = slides.length > 0 ? Math.round((visibleSlides / slides.length) * 100) : 0;
  const currentTip = done ? '生成完成' : STAGE_TIPS[stage][tipIndex];
  const stageIcon = STAGE_ICONS[stage];

  return (
    <div className="space-y-2">
      {/* AI Status Header */}
      {!done && (
        <div className="bg-gradient-to-r from-[#5B4FE9]/5 via-[#8B5CF6]/5 to-[#5B4FE9]/5 rounded-xl border border-[#EDE9FE] p-3 mb-4">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#5B4FE9] to-[#8B5CF6] flex items-center justify-center text-white text-sm shadow-lg shadow-purple-200">
                AI
              </div>
              <div>
                <div className="text-xs font-medium text-[#5B4FE9]">
                  {stageIcon} {stage === 'analyzing' && '分析中'}
                  {stage === 'planning' && '规划中'}
                  {stage === 'generating' && '生成中'}
                  {stage === 'polishing' && '优化中'}
                  {stage === 'complete' && '已完成'}
                </div>
                <div className="text-xs text-gray-400">
                  {slides.length > 0 ? `${visibleSlides} / ${slides.length} 页` : '准备中...'}
                </div>
              </div>
            </div>
            <div className="text-right">
              <div className="text-lg font-bold text-[#5B4FE9]">{progress}%</div>
            </div>
          </div>

          {/* Progress bar */}
          <div className="h-1.5 bg-[#EDE9FE] rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-[#5B4FE9] to-[#8B5CF6] rounded-full transition-all duration-500 ease-out"
              style={{ width: `${progress}%` }}
            />
          </div>

          {/* Animated tip */}
          <div className="mt-2 flex items-center gap-2">
            <div className="flex gap-0.5">
              <span className="w-1.5 h-1.5 bg-[#5B4FE9] rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
              <span className="w-1.5 h-1.5 bg-[#8B5CF6] rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
              <span className="w-1.5 h-1.5 bg-[#A78BFA] rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
            </div>
            <div className="text-xs text-gray-500 transition-all duration-300">
              {currentTip}
            </div>
          </div>
        </div>
      )}

      {/* Done header */}
      {done && (
        <div className="bg-gradient-to-r from-green-50 to-emerald-50 rounded-xl border border-green-200 p-3 mb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-green-400 to-emerald-500 flex items-center justify-center text-white text-lg shadow-lg shadow-green-200">
              ✨
            </div>
            <div>
              <div className="text-sm font-semibold text-green-700">大纲生成完成！</div>
              <div className="text-xs text-green-600">共 {slides.length} 页，内容已准备就绪</div>
            </div>
          </div>
        </div>
      )}

      {/* Visible slides */}
      {slides.slice(0, visibleSlides).map((slide, idx) => (
        <div
          key={slide.id}
          className="bg-white rounded-xl border border-gray-100 p-3 animate-slide-in"
          style={{ animationDelay: `${idx * 50}ms` }}
        >
          <div className="flex items-start gap-2">
            <div className="flex-shrink-0 w-6 h-6 rounded-full bg-[#F5F3FF] text-[#5B4FE9] text-[10px] font-bold flex items-center justify-center">
              {idx + 1}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-semibold text-gray-800">{slide.title}</div>
              {slide.content && slide.content.length > 0 && (
                <div className="mt-1 text-xs text-gray-500">
                  {slide.content.slice(0, 2).map((c, ci) => (
                    <div key={ci} className="truncate">• {c}</div>
                  ))}
                  {slide.content.length > 2 && <div className="text-gray-300">+{slide.content.length - 2} more</div>}
                </div>
              )}
            </div>
          </div>
        </div>
      ))}

      {/* Currently typing slide */}
      {typingIdx >= 0 && typingIdx < slides.length && (
        <div ref={currentSlideRef} className="bg-white rounded-xl border-2 border-[#EDE9FE] p-3 shadow-lg shadow-purple-100/30 animate-fade-in">
          <div className="flex items-start gap-2">
            <div className="flex-shrink-0 w-6 h-6 rounded-full bg-gradient-to-br from-[#5B4FE9] to-[#8B5CF6] text-white text-[10px] font-bold flex items-center justify-center">
              {typingIdx + 1}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-semibold text-gray-800">
                {typingText}
                <span className="inline-block w-0.5 h-4 bg-[#5B4FE9] animate-pulse ml-0.5 align-middle" />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Skeleton for upcoming slides */}
      {!done && typingIdx < 0 && visibleSlides < slides.length && (
        <div className="bg-white rounded-xl border border-gray-100 p-3 animate-pulse">
          <div className="flex items-start gap-2">
            <div className="flex-shrink-0 w-6 h-6 rounded-full bg-gray-200" />
            <div className="flex-1 space-y-2">
              <div className="h-4 bg-gray-200 rounded w-2/3" />
              <div className="h-3 bg-gray-100 rounded w-1/2" />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
