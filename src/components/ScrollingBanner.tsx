'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';

// 滚动信息栏 - 更精致的设计
const SCROLL_ITEMS = [
  { emoji: '🚀', text: '30秒出稿，AI一键生成专业PPT', type: 'feature' as const },
  { emoji: '🎨', text: '50+精选主题，商务/学术/创意全覆盖', type: 'feature' as const },
  { emoji: '💰', text: '纯净模式0积分配图，性价比拉满', type: 'feature' as const },
  { emoji: '📐', text: 'PPT每页50-80字，信息密度刚刚好', type: 'tip' as const },
  { emoji: '🎯', text: '省心定制：AI深度优化，会员专属', type: 'feature' as const },
  { emoji: '📊', text: '4档会员，每月最高200份PPT', type: 'feature' as const },
  { emoji: '🌐', text: '支持文档上传，Word/PDF/Excel均可', type: 'feature' as const },
  { emoji: '💡', text: '3-4个要点可触发卡片布局', type: 'tip' as const },
  { emoji: '⬇️', text: '生成即下载PPTX，兼容Office', type: 'feature' as const },
  { emoji: '🎭', text: '5种语气：专业/轻松/创意/大胆/传统', type: 'feature' as const },
  { emoji: '📱', text: '手机电脑均可使用，随时随地', type: 'feature' as const },
];

interface ScrollingBannerProps {
  variant?: 'top' | 'wait';
}

export default function ScrollingBanner({ variant = 'top' }: ScrollingBannerProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [fadeState, setFadeState] = useState<'in' | 'out'>('in');
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const touchStartX = useRef<number>(0);

  const item = SCROLL_ITEMS[currentIndex];
  const isTip = item.type === 'tip';

  // 自动轮播 3s
  useEffect(() => {
    if (isPaused) return;
    timerRef.current = setInterval(() => {
      setFadeState('out');
      setTimeout(() => {
        setCurrentIndex(prev => (prev + 1) % SCROLL_ITEMS.length);
        setFadeState('in');
      }, 200);
    }, 3000);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [isPaused]);

  const goNext = useCallback(() => {
    setFadeState('out');
    setTimeout(() => {
      setCurrentIndex(prev => (prev + 1) % SCROLL_ITEMS.length);
      setFadeState('in');
    }, 200);
  }, []);

  const goPrev = useCallback(() => {
    setFadeState('out');
    setTimeout(() => {
      setCurrentIndex(prev => (prev - 1 + SCROLL_ITEMS.length) % SCROLL_ITEMS.length);
      setFadeState('in');
    }, 200);
  }, []);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
    setIsPaused(true);
  }, []);

  const handleTouchEnd = useCallback((e: React.TouchEvent) => {
    const dx = e.changedTouches[0].clientX - touchStartX.current;
    if (Math.abs(dx) > 30) {
      if (dx < 0) goNext(); else goPrev();
    }
    setTimeout(() => setIsPaused(false), 3000);
  }, [goNext, goPrev]);

  const isWait = variant === 'wait';

  return (
    <div
      className="w-full bg-gradient-to-r from-purple-50/60 via-white to-indigo-50/60 border-b border-gray-100/40"
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      <div className={`${isWait ? 'max-w-lg' : 'max-w-3xl'} mx-auto px-4 ${isWait ? 'py-2' : 'py-2.5'}`}>
        <div
          className={`flex items-center gap-2.5 transition-all duration-200 ${
            fadeState === 'in' ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-1'
          }`}
        >
          <span className={`flex-shrink-0 ${isWait ? 'text-sm' : 'text-base'}`}>{item.emoji}</span>
          <p className={`flex-1 truncate font-medium ${isWait ? 'text-xs text-gray-500' : 'text-sm text-gray-700'}`}>
            {item.text}
          </p>
          <span className={`flex-shrink-0 font-bold px-1.5 py-0.5 rounded-full ${
            isTip
              ? 'bg-amber-100/80 text-amber-600'
              : 'bg-indigo-100/80 text-indigo-600'
          } ${isWait ? 'text-[8px]' : 'text-[9px]'}`}>
            {isTip ? '💡 技巧' : '✨ 优势'}
          </span>
        </div>
      </div>
      {/* 进度条 */}
      <div className="h-[2px] bg-gray-100/60">
        <div
          className="h-full bg-gradient-to-r from-[#5B4FE9] to-[#8B5CF6] rounded-full"
          style={{
            animation: isPaused ? 'none' : `banner-progress 3s linear infinite`,
          }}
        />
      </div>
      <style jsx>{`
        @keyframes banner-progress {
          0% { width: 0%; }
          100% { width: 100%; }
        }
      `}</style>
    </div>
  );
}
