'use client';

import React, { useState, useEffect } from 'react';

interface Step {
  id: string;
  label: string;
  icon: string;
}

const STEPS: Step[] = [
  { id: 'analyze', label: '分析需求', icon: '🔍' },
  { id: 'outline', label: '生成大纲', icon: '📋' },
  { id: 'render', label: '渲染PPT', icon: '🎨' },
  { id: 'check', label: '最终检查', icon: '✅' },
];

interface GenerationProgressProps {
  currentStep: number; // 0-3
  progress: number; // 0-100
  subtext?: string;
}

export default function GenerationProgress({ currentStep, progress, subtext }: GenerationProgressProps) {
  const [dots, setDots] = useState('');

  useEffect(() => {
    const interval = setInterval(() => {
      setDots(prev => prev.length >= 3 ? '' : prev + '.');
    }, 500);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="fixed inset-0 bg-gradient-to-br from-[#FAFBFE] via-white to-[#F5F3FF] flex items-center justify-center z-50">
      {/* Floating decorations */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-64 h-64 bg-[#5B4FE9]/5 rounded-full blur-3xl animate-float" />
        <div className="absolute bottom-1/4 right-1/4 w-64 h-64 bg-[#8B5CF6]/5 rounded-full blur-3xl animate-float" style={{ animationDelay: '1s' }} />
      </div>

      <div className="relative text-center max-w-sm mx-auto px-6">
        {/* Animated icon */}
        <div className="w-20 h-20 mx-auto mb-6 rounded-2xl bg-gradient-to-br from-[#EDE9FE] to-[#DDD6FE] flex items-center justify-center shadow-xl shadow-purple-200/50">
          <div className="text-3xl animate-bounce-slow">{STEPS[currentStep]?.icon || '✨'}</div>
        </div>

        <h2 className="text-lg font-bold text-gray-900 mb-1">AI 正在为你生成 PPT{dots}</h2>
        <p className="text-xs text-gray-400 mb-8">{subtext || '请稍候，马上就好'}</p>

        {/* Progress bar */}
        <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden mb-8">
          <div
            className="h-full bg-gradient-to-r from-[#5B4FE9] to-[#8B5CF6] rounded-full transition-all duration-500 ease-out"
            style={{ width: `${progress}%` }}
          />
        </div>

        {/* Steps */}
        <div className="space-y-3">
          {STEPS.map((step, i) => {
            const isDone = i < currentStep;
            const isCurrent = i === currentStep;
            const isPending = i > currentStep;

            return (
              <div
                key={step.id}
                className={`flex items-center gap-3 px-4 py-2.5 rounded-xl transition-all duration-500 ${
                  isCurrent ? 'bg-[#F5F3FF] border border-[#EDE9FE] shadow-sm' : 'opacity-50'
                }`}
              >
                <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs ${
                  isDone ? 'bg-[#10B981] text-white' :
                  isCurrent ? 'bg-[#5B4FE9] text-white animate-pulse' :
                  'bg-gray-100 text-gray-300'
                }`}>
                  {isDone ? '✓' : i + 1}
                </div>
                <span className={`text-sm ${isCurrent ? 'font-semibold text-[#4338CA]' : 'text-gray-500'}`}>
                  {step.label}
                </span>
                {isCurrent && (
                  <div className="ml-auto flex gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#5B4FE9] animate-bounce" style={{ animationDelay: '0ms' }} />
                    <span className="w-1.5 h-1.5 rounded-full bg-[#8B5CF6] animate-bounce" style={{ animationDelay: '150ms' }} />
                    <span className="w-1.5 h-1.5 rounded-full bg-[#C4B5FD] animate-bounce" style={{ animationDelay: '300ms' }} />
                  </div>
                )}
                {isDone && <span className="ml-auto text-[10px] text-[#10B981]">完成</span>}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
