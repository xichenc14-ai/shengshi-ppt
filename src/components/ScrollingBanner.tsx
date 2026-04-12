'use client';

import React, { useState, useEffect, useRef } from 'react';

// 滚动信息栏数据
// 类型：tip=实用技巧, feature=平台优势, info=资讯
const SCROLL_ITEMS = [
  { emoji: '🚀', text: '30秒出稿，AI一键生成专业PPT', type: 'feature' as const },
  { emoji: '🎨', text: '50+精选主题，商务/学术/创意全覆盖', type: 'feature' as const },
  { emoji: '💰', text: '纯净模式0积分配图，性价比拉满', type: 'feature' as const },
  { emoji: '📐', text: '小技巧：PPT每页控制在50-80字，信息密度刚刚好', type: 'tip' as const },
  { emoji: '🎯', text: '省心定制模式：AI深度优化内容，会员专属', type: 'feature' as const },
  { emoji: '📝', text: '小技巧：演讲备注用 > 引用块，Gamma会自动分离', type: 'tip' as const },
  { emoji: '📊', text: '4档会员从免费到尊享，每月最高200份PPT', type: 'feature' as const },
  { emoji: '🔑', text: '小技巧：用有序列表 1. 2. 3. 可触发流程时间轴布局', type: 'tip' as const },
  { emoji: '🌐', text: '支持文档上传转PPT，Word/PDF/Excel均可', type: 'feature' as const },
  { emoji: '💡', text: '小技巧：3-4个并列要点可触发三列卡片布局', type: 'tip' as const },
  { emoji: '⬇️', text: '生成即下载PPTX，即下即用，兼容Office', type: 'feature' as const },
  { emoji: '🎭', text: '5种语气风格：专业/轻松/创意/大胆/传统', type: 'feature' as const },
  { emoji: '✨', text: '小技巧：标题用 ### 触发大文本强调效果', type: 'tip' as const },
  { emoji: '📱', text: '手机电脑均可使用，随时随地制作PPT', type: 'feature' as const },
];

interface ScrollingBannerProps {
  variant?: 'hero' | 'wait';  // hero=首页大版, wait=等待页小版
  speed?: number;              // 滚动速度(ms)
}

export default function ScrollingBanner({ variant = 'hero', speed = 30000 }: ScrollingBannerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [currentIndex, setCurrentIndex] = useState(0);

  // 自动轮播
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentIndex(prev => (prev + 1) % SCROLL_ITEMS.length);
    }, speed / SCROLL_ITEMS.length);
    return () => clearInterval(interval);
  }, [speed]);

  const item = SCROLL_ITEMS[currentIndex];
  const isTip = item.type === 'tip';

  // Hero 版本：放在首页底部，大卡片
  if (variant === 'hero') {
    return (
      <div className="w-full overflow-hidden">
        <div className="max-w-4xl mx-auto px-4 py-4">
          <div
            className={`relative flex items-center gap-3 px-5 py-3 rounded-2xl transition-all duration-700 ease-in-out ${
              isTip
                ? 'bg-gradient-to-r from-amber-50 via-yellow-50 to-orange-50 border border-amber-100/60'
                : 'bg-gradient-to-r from-purple-50 via-indigo-50 to-blue-50 border border-purple-100/60'
            }`}
          >
            {/* 左侧 emoji */}
            <div className={`flex-shrink-0 w-10 h-10 rounded-xl flex items-center justify-center text-xl ${
              isTip ? 'bg-amber-100' : 'bg-purple-100'
            }`}>
              {item.emoji}
            </div>

            {/* 中间文字 */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                  isTip ? 'bg-amber-200/60 text-amber-700' : 'bg-purple-200/60 text-purple-700'
                }`}>
                  {isTip ? '💡 实用技巧' : '✨ 平台优势'}
                </span>
              </div>
              <p className="text-sm text-gray-700 mt-1 font-medium truncate">{item.text}</p>
            </div>

            {/* 右侧指示器 */}
            <div className="flex-shrink-0 flex items-center gap-1.5">
              {SCROLL_ITEMS.slice(0, 6).map((_, i) => (
                <div
                  key={i}
                  className={`h-1.5 rounded-full transition-all duration-500 ${
                    i === currentIndex % 6
                      ? 'w-4 bg-[#5B4FE9]'
                      : 'w-1.5 bg-gray-200'
                  }`}
                />
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Wait 版本：放在等待页，紧凑型
  return (
    <div className="mt-8">
      <div className="relative overflow-hidden rounded-xl bg-gradient-to-r from-[#FAFBFE] via-white to-[#F5F3FF] border border-gray-100/80 px-4 py-3">
        {/* 淡入淡出文字 */}
        <div className="flex items-center gap-2.5 min-h-[28px]">
          <span className="flex-shrink-0 text-base">{item.emoji}</span>
          <p className="text-xs text-gray-500 transition-all duration-700 ease-in-out">
            {item.text}
          </p>
        </div>

        {/* 底部进度条 */}
        <div className="mt-2 h-0.5 bg-gray-100 rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-[#5B4FE9] to-[#8B5CF6] rounded-full"
            style={{
              width: `${((currentIndex + 1) / SCROLL_ITEMS.length) * 100}%`,
              transition: 'width 0.7s ease-in-out',
            }}
          />
        </div>
      </div>
    </div>
  );
}
