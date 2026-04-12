'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';

// 滚动信息栏数据
const SCROLL_ITEMS = [
  { emoji: '🚀', text: '30秒出稿，AI一键生成专业PPT', type: 'feature' as const, link: '' },
  { emoji: '🎨', text: '50+精选主题，商务/学术/创意全覆盖', type: 'feature' as const, link: '' },
  { emoji: '💰', text: '纯净模式0积分配图，性价比拉满', type: 'feature' as const, link: '/pricing' },
  { emoji: '📐', text: '小技巧：PPT每页控制在50-80字，信息密度刚刚好', type: 'tip' as const, link: '' },
  { emoji: '🎯', text: '省心定制模式：AI深度优化内容，会员专属', type: 'feature' as const, link: '/pricing' },
  { emoji: '📝', text: '小技巧：演讲备注用引用块标记，AI会自动分离', type: 'tip' as const, link: '' },
  { emoji: '📊', text: '4档会员从免费到尊享，每月最高200份PPT', type: 'feature' as const, link: '/pricing' },
  { emoji: '🔑', text: '小技巧：用有序列表 1. 2. 3. 可触发流程时间轴布局', type: 'tip' as const, link: '' },
  { emoji: '🌐', text: '支持文档上传转PPT，Word/PDF/Excel均可', type: 'feature' as const, link: '' },
  { emoji: '💡', text: '小技巧：3-4个并列要点可触发三列卡片布局', type: 'tip' as const, link: '' },
  { emoji: '⬇️', text: '生成即下载PPTX，即下即用，兼容Office', type: 'feature' as const, link: '' },
  { emoji: '🎭', text: '5种语气风格：专业/轻松/创意/大胆/传统', type: 'feature' as const, link: '' },
  { emoji: '✨', text: '小技巧：标题用 ### 触发大文本强调效果', type: 'tip' as const, link: '' },
  { emoji: '📱', text: '手机电脑均可使用，随时随地制作PPT', type: 'feature' as const, link: '' },
];

interface ScrollingBannerProps {
  variant?: 'top' | 'wait';  // top=顶部通知条, wait=等待页顶部版
}

export default function ScrollingBanner({ variant = 'top' }: ScrollingBannerProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const touchStartX = useRef<number>(0);
  const touchStartY = useRef<number>(0);

  const item = SCROLL_ITEMS[currentIndex];
  const isTip = item.type === 'tip';

  // 自动轮播 2s 一次
  useEffect(() => {
    if (isPaused) return;
    timerRef.current = setInterval(() => {
      setCurrentIndex(prev => (prev + 1) % SCROLL_ITEMS.length);
    }, 2000);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [isPaused]);

  const goNext = useCallback(() => {
    setCurrentIndex(prev => (prev + 1) % SCROLL_ITEMS.length);
  }, []);

  const goPrev = useCallback(() => {
    setCurrentIndex(prev => (prev - 1 + SCROLL_ITEMS.length) % SCROLL_ITEMS.length);
  }, []);

  // 触摸滑动支持
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
    touchStartY.current = e.touches[0].clientY;
  }, []);

  const handleTouchEnd = useCallback((e: React.TouchEvent) => {
    const dx = e.changedTouches[0].clientX - touchStartX.current;
    const dy = e.changedTouches[0].clientY - touchStartY.current;
    // 只在水平滑动大于垂直滑动时才切换
    if (Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > 30) {
      if (dx < 0) goNext();
      else goPrev();
    }
  }, [goNext, goPrev]);

  // 顶部通知条版本（放到 Navbar 下方）
  if (variant === 'top') {
    return (
      <div className="w-full">
        <div
          onMouseEnter={() => setIsPaused(true)}
          onMouseLeave={() => setIsPaused(false)}
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
          className="relative bg-gradient-to-r from-purple-50/80 via-white to-indigo-50/80 border-b border-gray-100/60 px-4 py-2 cursor-grab active:cursor-grabbing"
        >
          <div className="max-w-3xl mx-auto flex items-center gap-2.5">
            <span className="flex-shrink-0 text-sm">{item.emoji}</span>
            {item.link ? (
              <a
                href={item.link}
                target="_blank"
                rel="noopener noreferrer"
                className="flex-1 text-xs text-gray-500 hover:text-[#5B4FE9] transition-colors truncate"
              >
                {item.text} →
              </a>
            ) : (
              <p className="flex-1 text-xs text-gray-500 truncate transition-all duration-500">{item.text}</p>
            )}
            <span className={`flex-shrink-0 text-[8px] font-bold px-1.5 py-0.5 rounded-full ${
              isTip ? 'bg-amber-100 text-amber-600' : 'bg-purple-100 text-purple-600'
            }`}>
              {isTip ? '技巧' : '优势'}
            </span>
          </div>
          {/* 底部进度条 */}
          <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-gray-50">
            <div
              className="h-full bg-gradient-to-r from-[#5B4FE9] to-[#8B5CF6] transition-all duration-500"
              style={{
                width: `${((currentIndex + 1) / SCROLL_ITEMS.length) * 100}%`,
              }}
            />
          </div>
        </div>
      </div>
    );
  }

  // Wait 版本：等待页顶部（同 top 布局，更紧凑）
  return (
    <div className="w-full">
      <div
        onMouseEnter={() => setIsPaused(true)}
        onMouseLeave={() => setIsPaused(false)}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
        className="relative bg-gradient-to-r from-purple-50/80 via-white to-indigo-50/80 border-b border-gray-100/60 px-4 py-2.5"
      >
        <div className="max-w-lg mx-auto flex items-center gap-2.5">
          <span className="flex-shrink-0 text-sm">{item.emoji}</span>
          {item.link ? (
            <a
              href={item.link}
              target="_blank"
              rel="noopener noreferrer"
              className="flex-1 text-xs text-gray-500 hover:text-[#5B4FE9] transition-colors truncate"
            >
              {item.text} →
            </a>
          ) : (
            <p className="flex-1 text-xs text-gray-500 truncate transition-all duration-500">{item.text}</p>
          )}
          <span className={`flex-shrink-0 text-[8px] font-bold px-1.5 py-0.5 rounded-full ${
            isTip ? 'bg-amber-100 text-amber-600' : 'bg-purple-100 text-purple-600'
          }`}>
            {isTip ? '技巧' : '优势'}
          </span>
        </div>
        {/* 底部进度条 */}
        <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-gray-50">
          <div
            className="h-full bg-gradient-to-r from-[#5B4FE9] to-[#8B5CF6] transition-all duration-500"
            style={{
              width: `${((currentIndex + 1) / SCROLL_ITEMS.length) * 100}%`,
            }}
          />
        </div>
      </div>
    </div>
  );
}
