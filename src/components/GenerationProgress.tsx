import React from 'react';

interface GenerationProgressProps {
  currentStep: number; // 0-3
  progress: number; // 0-100
  subtext?: string;
}

const STEPS = [
  { id: 'analyze', label: '分析需求', icon: '🔍' },
  { id: 'outline', label: '生成大纲', icon: '📋' },
  { id: 'render', label: '渲染PPT', icon: '🎨' },
  { id: 'check', label: '最终检查', icon: '✅' },
];

export default function GenerationProgress({ currentStep, progress, subtext }: GenerationProgressProps) {
  return (
    <div className="max-w-md mx-auto px-6 py-12">
      {/* 静态标题 */}
      <div className="text-center mb-6">
        <div className="text-3xl mb-3">{STEPS[currentStep]?.icon || '✨'}</div>
        <h2 className="text-lg font-bold text-gray-900">AI 正在生成中...</h2>
        <p className="text-xs text-gray-400 mt-1">{subtext || '请稍候'}</p>
      </div>

      {/* 进度条 */}
      <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden mb-6">
        <div
          className="h-full bg-gradient-to-r from-[#5B4FE9] to-[#8B5CF6] rounded-full transition-all duration-300"
          style={{ width: `${progress}%` }}
        />
      </div>

      {/* 步骤列表 */}
      <div className="space-y-2">
        {STEPS.map((step, i) => {
          const isDone = i < currentStep;
          const isCurrent = i === currentStep;
          return (
            <div
              key={step.id}
              className={`flex items-center gap-3 px-3 py-2 rounded-lg ${isCurrent ? 'bg-[#F5F3FF]' : ''}`}
            >
              <div className={`w-5 h-5 rounded-full flex items-center justify-center text-xs ${
                isDone ? 'bg-green-500 text-white' : isCurrent ? 'bg-[#5B4FE9] text-white' : 'bg-gray-100 text-gray-400'
              }`}>
                {isDone ? '✓' : i + 1}
              </div>
              <span className={`text-sm ${isCurrent ? 'font-medium text-[#4338CA]' : 'text-gray-500'}`}>{step.label}</span>
              {isDone && <span className="ml-auto text-xs text-green-500">完成</span>}
            </div>
          );
        })}
      </div>
    </div>
  );
}