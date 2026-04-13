'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';

const SCROLL_ITEMS = [
  '🚀 30秒出稿，AI一键生成专业PPT',
  '🎨 50+精选主题，商务/学术/创意全覆盖',
  '💰 纯净模式0积分配图，性价比拉满',
  '📐 PPT每页50-80字，信息密度刚刚好',
  '🎯 省心定制：AI深度优化，会员专属',
  '📊 4档会员，每月最高200份PPT',
  '🌐 支持文档上传，Word/PDF/Excel均可',
  '⬇️ 生成即下载PPTX，兼容Office',
  '📱 手机电脑均可使用，随时随地',
];

interface ScrollingBannerProps {
  variant?: 'top' | 'wait';
}

export default function ScrollingBanner({ variant = 'top' }: ScrollingBannerProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (isPaused) return;
    timerRef.current = setInterval(() => {
      setCurrentIndex(prev => (prev + 1) % SCROLL_ITEMS.length);
    }, 4000);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [isPaused]);

  const isWait = variant === 'wait';

  return (
    <div
      className={`w-full ${isWait ? 'bg-white/60' : 'bg-[#FAFBFE]/80'} border-b border-gray-100/40`}
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
    >
      <div
        className={`${isWait ? 'max-w-lg' : 'max-w-3xl'} mx-auto px-4 ${isWait ? 'py-1.5' : 'py-2'} flex items-center justify-center`}
      >
        <p
          key={currentIndex}
          className={`text-center ${isWait ? 'text-[11px]' : 'text-xs'} text-gray-400 animate-fade-in`}
        >
          {SCROLL_ITEMS[currentIndex]}
        </p>
      </div>
    </div>
  );
}
