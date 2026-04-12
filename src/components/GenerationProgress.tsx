'use client';

import React from 'react';

interface GenerationProgressProps {
  currentStep: number; // 0-3
  progress: number; // 0-100
  subtext?: string;
}

const STEPS = [
  { id: 'analyze', label: '分析需求', icon: '🔍', desc: '理解你的PPT主题...' },
  { id: 'outline', label: '生成大纲', icon: '📋', desc: '构建内容框架...' },
  { id: 'render', label: '渲染PPT', icon: '🎨', desc: '设计精美页面...' },
  { id: 'check', label: '最终检查', icon: '✅', desc: '确保完美呈现...' },
];

export default function GenerationProgress({ currentStep, progress, subtext }: GenerationProgressProps) {
  const currentStepData = STEPS[currentStep] || STEPS[0];
  
  return (
    <div className="min-h-screen bg-gradient-to-br from-[#FAFBFE] via-white to-[#F5F3FF] flex items-center justify-center">
      <div className="max-w-lg mx-auto px-6 py-12 w-full">
        {/* Animated main icon */}
        <div className="text-center mb-8">
          <div className="relative inline-block">
            {/* Outer glow ring */}
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="w-24 h-24 rounded-full bg-gradient-to-br from-[#5B4FE9]/20 to-[#8B5CF6]/20 animate-ping" style={{ animationDuration: '2s' }} />
            </div>
            {/* Main icon container */}
            <div className="relative w-20 h-20 rounded-2xl bg-gradient-to-br from-[#5B4FE9] to-[#8B5CF6] shadow-lg shadow-purple-300/40 flex items-center justify-center animate-pulse">
              <span className="text-4xl animate-bounce" style={{ animationDuration: '1.5s' }}>
                {currentStepData.icon}
              </span>
            </div>
            {/* Floating sparkles */}
            <span className="absolute -top-2 -right-2 text-lg animate-ping" style={{ animationDuration: '1s' }}>✨</span>
            <span className="absolute -bottom-1 -left-3 text-sm animate-ping" style={{ animationDuration: '1.5s' }}>💫</span>
          </div>
          
          {/* Title with gradient */}
          <h2 className="text-xl font-bold text-gray-900 mt-6 mb-2">
            <span className="bg-gradient-to-r from-[#5B4FE9] to-[#8B5CF6] bg-clip-text text-transparent">
              {currentStepData.label}
            </span>
          </h2>
          <p className="text-sm text-gray-500 animate-pulse">{currentStepData.desc}</p>
          {subtext && <p className="text-xs text-gray-400 mt-2">{subtext}</p>}
        </div>

        {/* Fancy progress bar */}
        <div className="mb-10">
          <div className="relative w-full h-4 bg-gray-100/80 rounded-full overflow-hidden shadow-inner">
            {/* Background shimmer */}
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/40 to-transparent animate-shimmer" style={{ animationDuration: '2s' }} />
            {/* Progress fill with gradient */}
            <div
              className="absolute h-full bg-gradient-to-r from-[#5B4FE9] via-[#7C3AED] to-[#8B5CF6] rounded-full transition-all duration-500 ease-out"
              style={{ width: `${progress}%` }}
            >
              {/* Glowing edge */}
              <div className="absolute right-0 top-0 bottom-0 w-8 bg-gradient-to-r from-transparent to-white/30 rounded-full animate-pulse" />
            </div>
          </div>
          {/* Percentage display */}
          <div className="flex justify-between mt-2">
            <span className="text-xs text-gray-400">进度</span>
            <span className="text-sm font-bold bg-gradient-to-r from-[#5B4FE9] to-[#8B5CF6] bg-clip-text text-transparent">
              {Math.round(progress)}%
            </span>
          </div>
        </div>

        {/* Animated steps timeline */}
        <div className="relative">
          {/* Connecting line */}
          <div className="absolute left-[27px] top-0 bottom-0 w-1 bg-gray-100 rounded-full" />
          <div 
            className="absolute left-[27px] top-0 w-1 bg-gradient-to-b from-[#5B4FE9] to-[#8B5CF6] rounded-full transition-all duration-500"
            style={{ height: `${(currentStep / (STEPS.length - 1)) * 100}%` }}
          />

          {/* Steps */}
          <div className="space-y-4">
            {STEPS.map((step, i) => {
              const isDone = i < currentStep;
              const isCurrent = i === currentStep;
              
              return (
                <div key={step.id} className={`flex items-center gap-4 transition-all duration-300 ${isCurrent ? 'scale-105' : ''}`}>
                  {/* Step indicator */}
                  <div className={`relative w-14 h-14 rounded-xl flex items-center justify-center transition-all duration-300 ${
                    isDone 
                      ? 'bg-gradient-to-br from-green-400 to-emerald-500 shadow-md shadow-green-200/50' 
                      : isCurrent 
                        ? 'bg-gradient-to-br from-[#5B4FE9] to-[#8B5CF6] shadow-lg shadow-purple-300/40 ring-4 ring-purple-100' 
                        : 'bg-gray-50 border-2 border-gray-100'
                  }`}>
                    {isDone ? (
                      <span className="text-xl text-white">✓</span>
                    ) : (
                      <span className={`text-xl ${isCurrent ? 'text-white animate-bounce' : 'text-gray-300'}`} style={{ animationDuration: isCurrent ? '1s' : '0s' }}>
                        {step.icon}
                      </span>
                    )}
                    {/* Active pulse ring — only for current step */}
                    {isCurrent && !isDone && (
                      <div className="absolute inset-0 rounded-xl bg-purple-400/30 animate-ping" style={{ animationDuration: '1.5s' }} />
                    )}
                  </div>
                  
                  {/* Step content */}
                  <div className="flex-1">
                    <div className={`text-sm font-semibold transition-colors duration-300 ${
                      isDone ? 'text-green-600' : isCurrent ? 'text-[#4338CA]' : 'text-gray-400'
                    }`}>
                      {step.label}
                    </div>
                    <div className={`text-xs mt-0.5 transition-colors duration-300 ${
                      isDone ? 'text-green-500/70' : isCurrent ? 'text-gray-500 animate-pulse' : 'text-gray-300'
                    }`}>
                      {isDone ? '已完成' : isCurrent ? '进行中...' : '等待中'}
                    </div>
                  </div>
                  
                  {/* Status badge */}
                  {isDone && (
                    <span className="px-2 py-1 bg-green-100 text-green-600 text-xs rounded-full font-medium">
                      ✓ 完成
                    </span>
                  )}
                  {isCurrent && !isDone && (
                    <span className="px-2 py-1 bg-purple-100 text-purple-600 text-xs rounded-full font-medium animate-pulse">
                      ⏳ 处理中
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Tip */}
        <div className="mt-8 text-center">
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-purple-50 to-indigo-50 rounded-full">
            <span className="text-sm">💡</span>
            <span className="text-xs text-gray-500">AI 正在精心设计，请耐心等待...</span>
          </div>
        </div>
      </div>
    </div>
  );
}