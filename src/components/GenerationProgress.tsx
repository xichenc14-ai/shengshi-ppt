'use client';

import React from 'react';
import ScrollingBanner from './ScrollingBanner';

interface GenerationProgressProps {
  currentStep: number;
  progress: number;
  subtext?: string;
}

const STEPS = [
  { id: 'analyze', label: '分析需求', icon: '🔍', desc: 'AI 正在理解你的主题...' },
  { id: 'outline', label: '生成大纲', icon: '📋', desc: '构建内容框架...' },
  { id: 'render', label: '渲染PPT', icon: '🎨', desc: '设计精美页面...' },
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

export default function GenerationProgress({ currentStep, progress, subtext }: GenerationProgressProps) {
  const currentStepData = STEPS[currentStep] || STEPS[0];
  const tipIndex = Math.floor(Date.now() / 8000) % FUN_TIPS.length;
  
  return (
    <div className="min-h-screen bg-gradient-to-br from-[#FAFBFE] via-white to-[#F5F3FF] flex flex-col">
      {/* 顶部信息栏 */}
      <ScrollingBanner variant="wait" />

      {/* 主内容 */}
      <div className="flex-1 flex items-center justify-center">
        <div className="max-w-lg mx-auto px-6 py-12 w-full">
          {/* 主图标 */}
          <div className="text-center mb-8">
            <div className="relative inline-block">
              {/* 外层光晕 */}
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="w-28 h-28 rounded-full bg-gradient-to-br from-[#5B4FE9]/15 to-[#8B5CF6]/15 animate-ping" style={{ animationDuration: '2.5s' }} />
              </div>
              {/* 图标容器 */}
              <div className="relative w-24 h-24 rounded-3xl bg-gradient-to-br from-[#5B4FE9] to-[#8B5CF6] shadow-xl shadow-purple-300/40 flex items-center justify-center">
                <span className="text-5xl" style={{ animation: 'gentle-bounce 1.5s ease-in-out infinite' }}>
                  {currentStepData.icon}
                </span>
              </div>
              {/* 装饰粒子 */}
              <span className="absolute -top-3 -right-3 text-lg animate-ping" style={{ animationDuration: '1.2s' }}>✨</span>
              <span className="absolute -bottom-2 -left-4 text-sm animate-ping" style={{ animationDuration: '1.8s' }}>💫</span>
            </div>

            {/* 标题 */}
            <h2 className="text-2xl font-bold text-gray-900 mt-6 mb-1.5">
              <span className="bg-gradient-to-r from-[#5B4FE9] to-[#8B5CF6] bg-clip-text text-transparent">
                {currentStepData.label}
              </span>
            </h2>
            <p className="text-sm text-gray-500">{currentStepData.desc}</p>
            {subtext && <p className="text-xs text-gray-400 mt-1">{subtext}</p>}
          </div>

          {/* 进度条 */}
          <div className="mb-10">
            <div className="relative w-full h-3 bg-gray-100/80 rounded-full overflow-hidden shadow-inner">
              {/* 背景微光 */}
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent animate-shimmer" style={{ animationDuration: '2.5s' }} />
              {/* 进度填充 */}
              <div
                className="absolute h-full bg-gradient-to-r from-[#5B4FE9] via-[#7C3AED] to-[#8B5CF6] rounded-full transition-all duration-700 ease-out"
                style={{ width: `${progress}%` }}
              >
                {/* 发光边缘 */}
                <div className="absolute right-0 top-0 bottom-0 w-6 bg-gradient-to-r from-transparent to-white/30 rounded-full" />
              </div>
            </div>
            <div className="flex justify-between mt-2">
              <span className="text-[10px] text-gray-300">进度</span>
              <span className="text-sm font-bold bg-gradient-to-r from-[#5B4FE9] to-[#8B5CF6] bg-clip-text text-transparent">
                {Math.round(progress)}%
              </span>
            </div>
          </div>

          {/* 步骤时间线 */}
          <div className="relative mb-8">
            {/* 连接线 */}
            <div className="absolute left-[27px] top-2 bottom-2 w-[2px] bg-gray-100 rounded-full" />
            <div
              className="absolute left-[27px] top-2 w-[2px] bg-gradient-to-b from-[#5B4FE9] to-[#8B5CF6] rounded-full transition-all duration-700"
              style={{ height: `${(currentStep / (STEPS.length - 1)) * 100}%` }}
            />

            <div className="space-y-5">
              {STEPS.map((step, i) => {
                const isDone = i < currentStep;
                const isCurrent = i === currentStep;

                return (
                  <div key={step.id} className={`flex items-center gap-4 transition-all duration-300 ${isCurrent ? 'scale-[1.02]' : ''}`}>
                    <div className={`relative w-14 h-14 rounded-xl flex items-center justify-center transition-all duration-300 flex-shrink-0 ${
                      isDone
                        ? 'bg-gradient-to-br from-green-400 to-emerald-500 shadow-md shadow-green-200/50'
                        : isCurrent
                          ? 'bg-gradient-to-br from-[#5B4FE9] to-[#8B5CF6] shadow-lg shadow-purple-300/40 ring-4 ring-purple-100/80'
                          : 'bg-gray-50 border border-gray-100'
                    }`}>
                      {isDone ? (
                        <svg className="w-6 h-6 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M5 13l4 4L19 7"/></svg>
                      ) : (
                        <span className={`text-xl ${isCurrent ? 'text-white' : 'text-gray-300'}`}>
                          {step.icon}
                        </span>
                      )}
                      {isCurrent && (
                        <div className="absolute inset-0 rounded-xl bg-purple-400/20 animate-ping" style={{ animationDuration: '2s' }} />
                      )}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className={`text-sm font-semibold transition-colors duration-300 ${
                        isDone ? 'text-green-600' : isCurrent ? 'text-[#4338CA]' : 'text-gray-300'
                      }`}>
                        {step.label}
                      </div>
                      <div className={`text-xs mt-0.5 ${
                        isDone ? 'text-green-400' : isCurrent ? 'text-gray-500' : 'text-gray-300'
                      }`}>
                        {isDone ? '已完成 ✓' : isCurrent ? '进行中...' : '等待中'}
                      </div>
                    </div>

                    {isDone && (
                      <span className="px-2.5 py-1 bg-green-50 text-green-500 text-[10px] rounded-full font-bold flex-shrink-0">
                        ✓
                      </span>
                    )}
                    {isCurrent && (
                      <span className="px-2.5 py-1 bg-purple-50 text-purple-500 text-[10px] rounded-full font-bold animate-pulse flex-shrink-0">
                        处理中
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* 底部提示 */}
          <div className="text-center">
            <div className="inline-flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-purple-50 to-indigo-50 rounded-full border border-purple-100/30">
              <span className="text-sm">💡</span>
              <span className="text-xs text-gray-500">{FUN_TIPS[tipIndex]}</span>
            </div>
          </div>
        </div>
      </div>

      <style jsx>{`
        @keyframes gentle-bounce {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-6px); }
        }
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
