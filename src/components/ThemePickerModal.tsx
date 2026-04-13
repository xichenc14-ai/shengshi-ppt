'use client';

import React, { useState } from 'react';

const COLOR_THEMES = [
  { id: 'consultant', name: '商务蓝', colors: ['#1E40AF', '#3B82F6', '#93C5FD'] },
  { id: 'founder', name: '路演紫', colors: ['#5B4FE9', '#8B5CF6', '#C4B5FD'] },
  { id: 'icebreaker', name: '培训青', colors: ['#0D9488', '#14B8A6', '#5EEAD4'] },
  { id: 'aurora', name: '科技蓝紫', colors: ['#6366F1', '#8B5CF6', '#A78BFA'] },
  { id: 'electric', name: '活力橙', colors: ['#EA580C', '#F97316', '#FDBA74'] },
  { id: 'blues', name: '高级金蓝', colors: ['#1E3A5F', '#C9A96E', '#F5E6CC'] },
  { id: 'chisel', name: '大地棕', colors: ['#78350F', '#A16207', '#FDE68A'] },
  { id: 'ashrose', name: '玫瑰粉', colors: ['#BE185D', '#EC4899', '#F9A8D4'] },
  { id: 'gleam', name: '科技青', colors: ['#0F766E', '#14B8A6', '#99F6E4'] },
  { id: 'default-light', name: '极简白', colors: ['#F1F5F9', '#CBD5E1', '#64748B'] },
];

const TONES = [
  { id: 'professional', name: '专业', icon: '💼' },
  { id: 'casual', name: '轻松', icon: '😊' },
  { id: 'creative', name: '创意', icon: '💡' },
  { id: 'bold', name: '大胆', icon: '🔥' },
  { id: 'traditional', name: '传统', icon: '🏯' },
];

const IMAGE_MODES = [
  { id: 'noImages', name: '纯净无图', desc: '0 credits', color: '#64748B' },
  { id: 'theme-img', name: '主题套图', desc: '0 credits', color: '#8B5CF6' },
  { id: 'pictographic', name: '精选套图', desc: '0 credits', color: '#0EA5E9' },
  { id: 'webFreeToUseCommercially', name: '定制网图', desc: '0 credits', color: '#10B981' },
  { id: 'aiGenerated', name: 'AI定制图', desc: '2/图', color: '#F59E0B' },
];

interface Props {
  open: boolean;
  currentThemeId: string;
  currentTone: string;
  currentImgSrc: string;
  onThemeChange: (themeId: string) => void;
  onToneChange: (tone: string) => void;
  onImgChange: (imgSrc: string) => void;
  onClose: () => void;
}

export default function ThemePickerModal({ open, currentThemeId, currentTone, currentImgSrc, onThemeChange, onToneChange, onImgChange, onClose }: Props) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 animate-fade-in" onClick={onClose}>
      <div className="bg-white rounded-3xl shadow-2xl w-[420px] max-w-[92vw] max-h-[85vh] overflow-y-auto animate-modal-in">
        {/* 顶部渐变装饰条 */}
        <div className="h-1.5 bg-gradient-to-r from-[#5B4FE9] via-[#7C3AED] to-[#8B5CF6]" />

        <div className="p-5">
          {/* Header */}
          <div className="flex items-center justify-between mb-5">
            <div className="flex items-center gap-2">
              <span className="text-lg">🎨</span>
              <h3 className="text-base font-bold text-gray-900">调整生成参数</h3>
            </div>
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center text-gray-500 transition-all active:scale-90"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12"/></svg>
            </button>
          </div>

          {/* 主题选择 */}
          <div className="mb-5">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2.5">🎨 主题风格</p>
            <div className="grid grid-cols-2 gap-2">
              {COLOR_THEMES.map(t => (
                <button
                  key={t.id}
                  onClick={() => { onThemeChange(t.id); }}
                  className={`flex items-center gap-2 px-3 py-2.5 rounded-xl border-2 transition-all ${
                    currentThemeId === t.id
                      ? 'border-[#5B4FE9] bg-[#F5F3FF] shadow-sm'
                      : 'border-gray-100 hover:border-gray-200'
                  }`}
                >
                  <div className="flex gap-0.5 flex-shrink-0">
                    {t.colors.map((c, i) => (
                      <div key={i} className="w-3.5 h-3.5 rounded-full border border-gray-200/50" style={{ backgroundColor: c }} />
                    ))}
                  </div>
                  <span className={`text-xs font-medium ${currentThemeId === t.id ? 'text-[#4338CA]' : 'text-gray-600'}`}>{t.name}</span>
                  {currentThemeId === t.id && (
                    <svg className="w-3.5 h-3.5 text-[#5B4FE9] ml-auto flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M5 13l4 4L19 7"/></svg>
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* 语气选择 */}
          <div className="mb-5">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2.5">🎭 语气风格</p>
            <div className="flex flex-wrap gap-2">
              {TONES.map(t => (
                <button
                  key={t.id}
                  onClick={() => onToneChange(t.id)}
                  className={`px-3 py-2 rounded-xl border-2 text-xs font-medium transition-all flex items-center gap-1.5 ${
                    currentTone === t.id
                      ? 'border-[#5B4FE9] bg-[#F5F3FF] text-[#4338CA]'
                      : 'border-gray-100 hover:border-gray-200 text-gray-500'
                  }`}
                >
                  <span>{t.icon}</span>
                  <span>{t.name}</span>
                </button>
              ))}
            </div>
          </div>

          {/* 配图选择 */}
          <div className="mb-5">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2.5">🖼️ 配图模式</p>
            <div className="grid grid-cols-1 gap-2">
              {IMAGE_MODES.map(m => (
                <button
                  key={m.id}
                  onClick={() => onImgChange(m.id)}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-xl border-2 transition-all ${
                    currentImgSrc === m.id
                      ? 'border-[#5B4FE9] bg-[#F5F3FF]'
                      : 'border-gray-100 hover:border-gray-200'
                  }`}
                >
                  <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: m.color }} />
                  <span className={`text-xs font-medium flex-1 text-left ${currentImgSrc === m.id ? 'text-[#4338CA]' : 'text-gray-600'}`}>{m.name}</span>
                  <span className="text-[10px] text-gray-400">{m.desc}</span>
                  {currentImgSrc === m.id && (
                    <svg className="w-3.5 h-3.5 text-[#5B4FE9] flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M5 13l4 4L19 7"/></svg>
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* 确认按钮 */}
          <button
            onClick={onClose}
            className="w-full py-3.5 bg-gradient-to-r from-[#5B4FE9] to-[#8B5CF6] text-white rounded-2xl text-sm font-bold hover:shadow-lg hover:shadow-purple-300/40 transition-all active:scale-[0.98]"
          >
            确定使用当前参数
          </button>
        </div>
      </div>
    </div>
  );
}
