'use client';

import React, { useState } from 'react';

interface TopicInputProps {
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  disabled?: boolean;
}

// 热门场景快捷输入
const HOT_SCENES = [
  { label: '📊 工作汇报', text: '本周工作汇报，包含完成任务、问题分析、下周计划' },
  { label: '💼 商业方案', text: '咖啡品牌市场推广方案PPT' },
  { label: '🎓 教学课件', text: '初中数学《勾股定理》教学课件' },
  { label: '📑 毕业答辩', text: '计算机专业毕业论文答辩，题目是《基于深度学习的图像识别研究》' },
  { label: '📋 年终总结', text: '2025年度工作总结，包含主要成绩、数据亮点和明年规划' },
  { label: '🎉 活动策划', text: '公司年会活动方案PPT' },
];

export default function TopicInput({ value, onChange, onSubmit, disabled }: TopicInputProps) {
  const [focused, setFocused] = useState(false);

  return (
    <div className="space-y-4">
      {/* 主输入框 */}
      <div className={`relative transition-all duration-300 ${focused ? 'transform scale-[1.01]' : ''}`}>
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
              onSubmit();
            }
          }}
          placeholder="描述你的PPT需求...例如：帮我制作一份公司年度总结PPT，包含营收数据、市场拓展、团队建设"
          disabled={disabled}
          className="w-full min-h-[140px] p-4 md:p-5 bg-white border-2 rounded-2xl resize-none text-gray-700 placeholder-gray-400 text-sm leading-relaxed transition-all duration-200 focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed"
          style={{
            borderColor: focused ? '#8b5cf6' : '#e4e4e7',
            boxShadow: focused ? '0 0 0 4px rgba(139, 92, 246, 0.1)' : 'none'
          }}
        />
        
        {/* 字数统计 */}
        <div className="absolute bottom-3 right-3 text-[10px] text-gray-400">
          {value.length}/2000
        </div>
      </div>

      {/* 快捷场景 */}
      <div className="space-y-2">
        <p className="text-xs font-medium text-gray-400">或选择热门场景：</p>
        <div className="flex flex-wrap gap-2">
          {HOT_SCENES.map((scene, i) => (
            <button
              key={i}
              onClick={() => onChange(scene.text)}
              disabled={disabled}
              className="px-3 py-1.5 bg-white border border-gray-200 rounded-full text-xs text-gray-500 hover:text-purple-600 hover:border-purple-200 hover:bg-purple-50/50 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {scene.label}
            </button>
          ))}
        </div>
      </div>

      {/* 提交按钮 */}
      <button
        onClick={onSubmit}
        disabled={disabled || value.trim().length === 0}
        className="w-full py-3.5 bg-gradient-to-r from-purple-600 via-purple-500 to-purple-400 text-white rounded-xl text-sm font-semibold shadow-lg shadow-purple-200/50 hover:shadow-xl hover:shadow-purple-300/50 active:scale-[0.98] transition-all disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:shadow-lg"
        style={{
          background: 'linear-gradient(135deg, #7c3aed 0%, #8b5cf6 50%, #a78bfa 100%)'
        }}
      >
        {disabled ? (
          <span className="flex items-center justify-center gap-2">
            <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>
            提交中...
          </span>
        ) : '✨ 开始生成'}
      </button>

      {/* 快捷键提示 */}
      <p className="text-[10px] text-gray-300 text-center">
        按 ⌘/Ctrl + Enter 快速提交
      </p>
    </div>
  );
}
