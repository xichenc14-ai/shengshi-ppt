'use client';

import React, { useState } from 'react';
import { useAuth } from '@/lib/auth-context';

const HOT_SCENES = [
  { label: '📊 工作汇报', text: '本周工作汇报，包含完成任务、问题分析、下周计划' },
  { label: '💼 商业方案', text: '咖啡品牌市场推广方案PPT' },
  { label: '🎓 教学课件', text: '初中数学《勾股定理》教学课件' },
  { label: '📑 毕业答辩', text: '计算机专业毕业论文答辩，题目是《基于深度学习的图像识别研究》' },
  { label: '📋 年终总结', text: '2025年度工作总结，包含主要成绩、数据亮点和明年规划' },
  { label: '🎉 活动策划', text: '公司年会活动方案PPT' },
];

interface HeroSectionProps {
  onSelectMode: (mode: 'direct' | 'smart', prefillText?: string) => void;
}

export default function HeroSection({ onSelectMode }: HeroSectionProps) {
  const { user, openLogin } = useAuth();
  const [selectedScene, setSelectedScene] = useState<string | null>(null);

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
    setSelectedScene(text);
    onSelectMode('direct', text);
  };

  return (
    <section className="relative pt-12 pb-16 md:pt-16 md:pb-24 overflow-hidden">
      {/* Background decorations */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {/* Gradient orbs */}
        <div className="absolute -top-40 -right-40 w-[500px] h-[500px] bg-gradient-to-br from-purple-200/40 to-purple-100/20 rounded-full blur-3xl" />
        <div className="absolute -bottom-40 -left-40 w-[400px] h-[400px] bg-gradient-to-tr from-amber-100/30 to-orange-100/20 rounded-full blur-3xl" />
        {/* Grid pattern */}
        <div className="absolute inset-0 opacity-[0.015]" style={{
          backgroundImage: `linear-gradient(#7c3aed 1px, transparent 1px), linear-gradient(90deg, #7c3aed 1px, transparent 1px)`,
          backgroundSize: '48px 48px'
        }} />
      </div>

      <div className="relative max-w-4xl mx-auto px-4 md:px-6">
        {/* Badge */}
        <div className="flex justify-center mb-6 md:mb-8 animate-fade-in-up">
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-white/80 backdrop-blur-sm rounded-full shadow-sm border border-purple-100/50">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-purple-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-purple-500"></span>
            </span>
            <span className="text-xs font-medium text-purple-700">AI驱动的PPT生成平台 · 已有10万+用户使用</span>
          </div>
        </div>

        {/* Main headline */}
        <div className="text-center mb-8 md:mb-10 animate-fade-in-up" style={{ animationDelay: '100ms' }}>
          <h1 className="text-4xl md:text-5xl lg:text-6xl font-black text-gray-900 leading-tight tracking-tight mb-4">
            <span className="block">输入主题，</span>
            <span className="block bg-gradient-to-r from-purple-600 via-purple-500 to-amber-500 bg-clip-text text-transparent">
              AI一键生成专业PPT
            </span>
          </h1>
          <p className="text-base md:text-lg text-gray-500 max-w-xl mx-auto leading-relaxed">
            告别繁琐的排版设计，输入你想要的内容，AI自动生成精美排版的演示文稿
          </p>
        </div>

        {/* Mode selection cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-5 mb-8 animate-fade-in-up" style={{ animationDelay: '200ms' }}>
          {/* Gamma Direct Card */}
          <button
            onClick={() => handleModeSelect('direct')}
            className="group relative p-6 md:p-7 bg-white rounded-2xl border-2 border-gray-100 hover:border-purple-200 transition-all duration-300 text-left overflow-hidden"
          >
            {/* Background glow on hover */}
            <div className="absolute inset-0 bg-gradient-to-br from-purple-50/0 via-purple-50/50 to-purple-100/0 opacity-0 group-hover:opacity-100 transition-opacity" />
            
            <div className="relative">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-purple-500 to-purple-400 flex items-center justify-center shadow-lg shadow-purple-200/50">
                  <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-.5a5.5 5.5 0 00-5.5-5.5H14a3 3 0 01-3 3h-1a3 3 0 01-3-3V5" />
                    <circle cx="11" cy="8" r="1" fill="currentColor" />
                    <circle cx="15" cy="8" r="1" fill="currentColor" />
                    <circle cx="13" cy="11" r="1" fill="currentColor" />
                  </svg>
                </div>
                <div>
                  <h3 className="text-lg font-bold text-gray-900 group-hover:text-purple-700 transition-colors">🚀 专业模式</h3>
                  <p className="text-xs text-gray-400">快速生成</p>
                </div>
                <div className="ml-auto">
                  <span className="px-2.5 py-1 bg-green-50 text-green-600 rounded-full text-xs font-medium">免费</span>
                </div>
              </div>
              
              <p className="text-sm text-gray-500 mb-4 leading-relaxed">
                输入内容直接生成，AI智能排版优化，适合快速制作场景
              </p>
              
              <div className="flex flex-wrap gap-2">
                <span className="px-2.5 py-1 bg-gray-50 text-gray-600 rounded-lg text-xs">即时生成</span>
                <span className="px-2.5 py-1 bg-gray-50 text-gray-600 rounded-lg text-xs">智能排版</span>
                <span className="px-2.5 py-1 bg-gray-50 text-gray-600 rounded-lg text-xs">4种图片模式</span>
              </div>
            </div>
          </button>

          {/* Smart Mode Card */}
          <button
            onClick={() => handleModeSelect('smart')}
            className="group relative p-6 md:p-7 bg-white rounded-2xl border-2 border-gray-100 hover:border-amber-200 transition-all duration-300 text-left overflow-hidden"
          >
            {/* Background glow on hover */}
            <div className="absolute inset-0 bg-gradient-to-br from-amber-50/0 via-amber-50/50 to-amber-100/0 opacity-0 group-hover:opacity-100 transition-opacity" />
            
            <div className="relative">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-amber-500 to-orange-500 flex items-center justify-center shadow-lg shadow-amber-200/50">
                  <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                  </svg>
                </div>
                <div>
                  <h3 className="text-lg font-bold text-gray-900 group-hover:text-amber-700 transition-colors">✨ 省心定制</h3>
                  <p className="text-xs text-gray-400">深度优化</p>
                </div>
                <div className="ml-auto">
                  <span className="px-2.5 py-1 bg-amber-50 text-amber-600 rounded-full text-xs font-medium">会员专属</span>
                </div>
              </div>
              
              <p className="text-sm text-gray-500 mb-4 leading-relaxed">
                AI深度预处理，专业级PPT忠实呈现，适合高质量需求
              </p>
              
              <div className="flex flex-wrap gap-2">
                <span className="px-2.5 py-1 bg-gray-50 text-gray-600 rounded-lg text-xs">AI预处理</span>
                <span className="px-2.5 py-1 bg-gray-50 text-gray-600 rounded-lg text-xs">preserve模式</span>
                <span className="px-2.5 py-1 bg-gray-50 text-gray-600 rounded-lg text-xs">深度定制</span>
              </div>
            </div>
          </button>
        </div>

        {/* Hot scenes - 快捷入口 */}
        <div className="animate-fade-in-up" style={{ animationDelay: '300ms' }}>
          <div className="flex items-center justify-center gap-2 mb-4">
            <div className="h-px flex-1 bg-gradient-to-r from-transparent to-gray-200" />
            <p className="text-xs text-gray-400 font-medium">或选择热门场景</p>
            <div className="h-px flex-1 bg-gradient-to-l from-transparent to-gray-200" />
          </div>
          
          <div className="flex flex-wrap items-center justify-center gap-2">
            {HOT_SCENES.map((s, i) => (
              <button
                key={i}
                onClick={() => handleSceneClick(s.text)}
                className="px-3.5 py-2 bg-white border border-gray-200 rounded-full text-xs text-gray-600 hover:text-purple-600 hover:border-purple-200 hover:bg-purple-50/50 transition-all hover:shadow-sm"
              >
                {s.label}
              </button>
            ))}
          </div>
        </div>

        {/* Social proof */}
        <div className="mt-10 md:mt-12 flex flex-col sm:flex-row items-center justify-center gap-4 sm:gap-8 animate-fade-in-up" style={{ animationDelay: '400ms' }}>
          <div className="flex items-center gap-2">
            <div className="flex -space-x-2">
              {['👨', '👩', '👨', '👩', '👨'].map((emoji, i) => (
                <div key={i} className="w-8 h-8 rounded-full bg-gray-100 border-2 border-white flex items-center justify-center text-sm">
                  {emoji}
                </div>
              ))}
            </div>
            <span className="text-xs text-gray-500">10万+用户正在使用</span>
          </div>
          <div className="flex items-center gap-3 text-xs text-gray-400">
            <span className="flex items-center gap-1">
              <span className="text-amber-400">★★★★★</span>
              4.9/5
            </span>
            <span className="w-1 h-1 rounded-full bg-gray-300" />
            <span>已生成100万+份PPT</span>
          </div>
        </div>
      </div>
    </section>
  );
}
