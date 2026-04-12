'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';

// 滚动信息栏数据
const SCROLL_ITEMS = [
  { emoji: '🚀', text: '30秒出稿，AI一键生成专业PPT', type: 'feature' as const, link: '' },
  { emoji: '🎨', text: '50+精选主题，商务/学术/创意全覆盖', type: 'feature' as const, link: '' },
  { emoji: '💰', text: '纯净模式0积分配图，性价比拉满', type: 'feature' as const, link: '/pricing' },
  { emoji: '📐', text: '小技巧：PPT每页控制在50-80字，信息密度刚刚好', type: 'tip' as const, link: '' },
  { emoji: '🎯', text: '省心定制模式：AI深度优化内容，会员专属', type: 'feature' as const, link: '/pricing' },
  { emoji: '📝', text: '小技巧：演讲备注用 > 引用块，Gamma会自动分离', type: 'tip' as const, link: '' },
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
  variant?: 'hero' | 'wait';  // hero=首页大版, wait=等待页顶部版
}

export default function ScrollingBanner({ variant = 'hero' }: ScrollingBannerProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const item = SCROLL_ITEMS[currentIndex];
  const isTip = item.type === 'tip';

  // 自动轮播，暂停时不推进
  useEffect(() => {
    if (isPaused) return;
    timerRef.current = setInterval(() => {
      setCurrentIndex(prev => (prev + 1) % SCROLL_ITEMS.length);
    }, 5000); // 5秒一条，慢下来
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [isPaused]);

  const goNext = useCallback(() => {
    setCurrentIndex(prev => (prev + 1) % SCROLL_ITEMS.length);
  }, []);

  const goPrev = useCallback(() => {
    setCurrentIndex(prev => (prev - 1 + SCROLL_ITEMS.length) % SCROLL_ITEMS.length);
  }, []);

  // Hero 版本：首页输入区底部
  if (variant === 'hero') {
    return (
      <div className="w-full">
        <div className="max-w-4xl mx-auto px-4 py-3">
          <div
            onMouseEnter={() => setIsPaused(true)}
            onMouseLeave={() => setIsPaused(false)}
            className={`relative flex items-center gap-3 px-4 py-2.5 rounded-2xl transition-all duration-500 ${
              isTip
                ? 'bg-gradient-to-r from-amber-50 via-yellow-50 to-orange-50 border border-amber-100/60'
                : 'bg-gradient-to-r from-purple-50 via-indigo-50 to-blue-50 border border-purple-100/60'
            }`}
          >
            {/* 左侧箭头 */}
            <button
              onClick={goPrev}
              className="flex-shrink-0 w-7 h-7 rounded-full bg-white/80 hover:bg-white flex items-center justify-center text-gray-400 hover:text-gray-600 transition-all active:scale-90 shadow-sm"
              title="上一条"
            >
              <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6"/></svg>
            </button>

            {/* 中间内容 */}
            <div className="flex-1 min-w-0 flex items-center gap-2.5">
              <span className="flex-shrink-0 text-lg">{item.emoji}</span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className={`flex-shrink-0 text-[9px] font-bold px-1.5 py-0.5 rounded-full ${
                    isTip ? 'bg-amber-200/60 text-amber-700' : 'bg-purple-200/60 text-purple-700'
                  }`}>
                    {isTip ? '💡 技巧' : '✨ 优势'}
                  </span>
                </div>
                {item.link ? (
                  <a
                    href={item.link}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={e => e.stopPropagation()}
                    className="text-sm text-gray-700 font-medium hover:text-[#5B4FE9] transition-colors truncate block mt-0.5"
                  >
                    {item.text} →
                  </a>
                ) : (
                  <p className="text-sm text-gray-700 font-medium truncate mt-0.5">{item.text}</p>
                )}
              </div>
            </div>

            {/* 右侧箭头 */}
            <button
              onClick={goNext}
              className="flex-shrink-0 w-7 h-7 rounded-full bg-white/80 hover:bg-white flex items-center justify-center text-gray-400 hover:text-gray-600 transition-all active:scale-90 shadow-sm"
              title="下一条"
            >
              <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M9 18l6-6-6-6"/></svg>
            </button>

            {/* 指示器 */}
            <div className="flex-shrink-0 flex items-center gap-1 ml-1">
              {SCROLL_ITEMS.slice(0, 8).map((_, i) => (
                <div
                  key={i}
                  className={`h-1 rounded-full transition-all duration-300 ${
                    i === currentIndex
                      ? 'w-3 bg-[#5B4FE9]'
                      : 'w-1 bg-gray-200'
                  }`}
                />
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Wait 版本：等待页顶部
  return (
    <div className="w-full">
      <div
        onMouseEnter={() => setIsPaused(true)}
        onMouseLeave={() => setIsPaused(false)}
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
          {/* 左右切换 */}
          <button onClick={goPrev} className="flex-shrink-0 text-gray-300 hover:text-gray-500 transition-colors active:scale-90" title="上一条">
            <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M15 18l-6-6 6-6"/></svg>
          </button>
          <button onClick={goNext} className="flex-shrink-0 text-gray-300 hover:text-gray-500 transition-colors active:scale-90" title="下一条">
            <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M9 18l6-6-6-6"/></svg>
          </button>
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
