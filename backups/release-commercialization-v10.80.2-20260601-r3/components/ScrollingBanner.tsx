'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';

const SCROLL_ITEMS = [
  { text: '🚀 30秒出稿，AI一键生成专业PPT', color: 'text-purple-600' },
  { text: '🎨 50+精选主题，商务/学术/创意全覆盖', color: 'text-blue-600' },
  { text: '💰 纯净模式0积分配图，性价比拉满', color: 'text-emerald-600' },
  { text: '📐 PPT每页50-80字，信息密度刚刚好', color: 'text-amber-600' },
  { text: '🎯 省心定制：AI深度优化，会员专属', color: 'text-purple-600' },
  { text: '📊 4档会员，每月最高200份PPT', color: 'text-blue-600' },
  { text: '🌐 支持文档上传，Word/PDF/Excel均可', color: 'text-emerald-600' },
  { text: '⬇️ 生成即下载PPTX，兼容Office', color: 'text-amber-600' },
  { text: '📱 手机电脑均可使用，随时随地', color: 'text-purple-600' },
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
    }, 3500);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [isPaused]);

  const isWait = variant === 'wait';
  const current = SCROLL_ITEMS[currentIndex];

  return (
    <div
      className={`w-full ${isWait ? 'bg-white/50' : 'bg-gradient-to-r from-purple-50/80 via-white/80 to-purple-50/80'} border-b border-purple-100/30`}
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
    >
      <div
        className={`${isWait ? 'max-w-lg' : 'max-w-3xl'} mx-auto px-4 ${isWait ? 'py-2' : 'py-2.5'} flex items-center justify-center gap-2`}
      >
        {/* Animated dot */}
        <span className="relative flex h-2 w-2 flex-shrink-0">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-purple-400 opacity-75"></span>
          <span className="relative inline-flex rounded-full h-2 w-2 bg-purple-500"></span>
        </span>
        
        <p
          key={currentIndex}
          className={`text-center ${isWait ? 'text-[11px]' : 'text-xs'} ${current.color} font-medium animate-fade-in`}
        >
          {current.text}
        </p>
      </div>
    </div>
  );
}
