'use client';

import React, { useState, useCallback } from 'react';
import { useAuth } from '@/lib/auth-context';

const HOT_SCENES = [
  { label: '📊 工作汇报', text: '帮我做一份本周工作汇报，包含本周完成的任务、遇到的问题和下周计划' },
  { label: '💼 商业方案', text: '帮我写一份咖啡品牌的市场推广方案PPT' },
  { label: '🎓 教学课件', text: '帮我制作一份初中数学《勾股定理》的教学课件' },
  { label: '📑 毕业答辩', text: '帮我做一份计算机专业毕业论文答辩PPT，题目是《基于深度学习的图像识别研究》' },
  { label: '📋 年终总结', text: '帮我做一份2025年度工作总结PPT，包含主要成绩、数据亮点和明年规划' },
  { label: '🎉 活动策划', text: '帮我策划一份公司年会活动方案PPT' },
];

interface HeroSectionProps {
  onSelectMode: (mode: 'direct' | 'smart') => void;
}

export default function HeroSection({ onSelectMode }: HeroSectionProps) {
  const { user, openLogin } = useAuth();

  const handleModeSelect = (mode: 'direct' | 'smart') => {
    if (!user) {
      openLogin();
      return;
    }
    onSelectMode(mode);
  };

  const handleSceneClick = (text: string) => {
    if (!user) {
      openLogin();
      return;
    }
    // 选中热门场景后直接进入专业模式（快速生成）
    onSelectMode('direct');
  };

  return (
    <section className="relative pt-16 pb-12 md:pt-20 md:pb-16 overflow-hidden">
      {/* Background decoration */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-96 h-96 bg-[#5B4FE9]/5 rounded-full blur-3xl" />
        <div className="absolute -bottom-40 -left-40 w-96 h-96 bg-[#8B5CF6]/5 rounded-full blur-3xl" />
      </div>

      <div className="relative max-w-3xl mx-auto px-4 md:px-6 text-center">
        {/* Main heading */}
        <h1 className="text-3xl sm:text-4xl md:text-5xl font-extrabold text-gray-900 mb-4 tracking-tight leading-tight">
          省心PPT，AI帮你搞定
          <span className="bg-gradient-to-r from-[#5B4FE9] to-[#8B5CF6] bg-clip-text text-transparent"> 每一份演示</span>
        </h1>
        <p className="text-base md:text-lg text-gray-500 mb-8 max-w-xl mx-auto leading-relaxed">
          描述你的需求，AI自动生成大纲、填充内容、精美排版。<br className="hidden sm:block" />
          从工作汇报到毕业答辩，30秒出稿。
        </p>

        {/* ===== 双轨制入口 ===== */}
        <div className="max-w-2xl mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
            {/* 专业模式 */}
            <button
              onClick={() => handleModeSelect('direct')}
              className="bg-white rounded-2xl border-2 border-gray-100 p-6 text-left hover:border-[#5B4FE9] hover:shadow-md transition-all group"
            >
              <div className="flex items-center gap-2 mb-3">
                <span className="text-3xl">🛠️</span>
                <h3 className="text-lg font-bold text-gray-900 group-hover:text-[#4338CA]">专业模式</h3>
              </div>
              <p className="text-sm text-gray-500 mb-4">快速生成，选主题/配图/页数，直接提交渲染</p>
              <div className="flex flex-wrap gap-2">
                <span className="px-2.5 py-1 bg-blue-50 text-blue-600 rounded-full text-xs font-medium">主题色系</span>
                <span className="px-2.5 py-1 bg-purple-50 text-purple-600 rounded-full text-xs font-medium">自选配图</span>
                <span className="px-2.5 py-1 bg-green-50 text-green-600 rounded-full text-xs font-medium">页数控制</span>
              </div>
            </button>

            {/* 省心定制 */}
            <button
              onClick={() => handleModeSelect('smart')}
              className="bg-gradient-to-br from-[#F5F3FF] to-white rounded-2xl border-2 border-[#EDE9FE] p-6 text-left hover:border-[#5B4FE9] hover:shadow-md transition-all group relative"
            >
              <div className="flex items-center gap-2 mb-3">
                <span className="text-3xl">✨</span>
                <h3 className="text-lg font-bold text-gray-900 group-hover:text-[#4338CA]">省心定制</h3>
                <span className="px-2 py-1 bg-[#5B4FE9] text-white rounded-full text-xs font-medium">会员</span>
              </div>
              <p className="text-sm text-gray-500 mb-4">AI深度优化，专业级PPT忠实呈现</p>
              <div className="flex flex-wrap gap-2">
                <span className="px-2.5 py-1 bg-purple-50 text-purple-600 rounded-full text-xs font-medium">AI预处理</span>
                <span className="px-2.5 py-1 bg-amber-50 text-amber-600 rounded-full text-xs font-medium">preserve</span>
                <span className="px-2.5 py-1 bg-rose-50 text-rose-600 rounded-full text-xs font-medium">深度定制</span>
              </div>
            </button>
          </div>
        </div>

        {/* Hot scenes - 快捷入口 */}
        <div className="mt-6 flex flex-wrap items-center justify-center gap-2">
          <span className="text-xs text-gray-400 mr-1">热门场景：</span>
          {HOT_SCENES.map((s, i) => (
            <button
              key={i}
              onClick={() => handleSceneClick(s.text)}
              className="px-3 py-1.5 bg-white border border-gray-100 rounded-full text-xs text-gray-500 hover:text-[#5B4FE9] hover:border-[#C4B5FD] hover:bg-[#F5F3FF]/50 transition-all"
            >
              {s.label}
            </button>
          ))}
        </div>
      </div>
    </section>
  );
}