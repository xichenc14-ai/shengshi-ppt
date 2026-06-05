'use client';

import React from 'react';
import { THEME_DATABASE, getThemeById } from '@/lib/theme-database';

const COLOR_THEMES = THEME_DATABASE.map((theme) => ({
  id: theme.id,
  name: theme.nameZh,
  colors: theme.colors,
}));

const RECOMMENDED_THEME_IDS: Array<{ label: string; id: string }> = [
  { label: '商务蓝', id: 'consultant' },
  { label: '科技紫', id: 'aurora' },
  { label: '简约白', id: 'default-light' },
  { label: '雅致米', id: 'finesse' },
  { label: '清新绿', id: 'elysia' },
  { label: '古风灰', id: 'ash' },
  { label: '少女粉', id: 'ashrose' },
];

const TONES = [
  { id: 'professional', name: '专业', icon: '💼' },
  { id: 'casual', name: '轻松', icon: '😊' },
  { id: 'creative', name: '创意', icon: '💡' },
  { id: 'bold', name: '大胆', icon: '🔥' },
  { id: 'traditional', name: '传统', icon: '🏯' },
];

const IMAGE_MODES = [
  { id: 'noImages', name: '极简无图', desc: '免费', color: '#64748B' },
  { id: 'themeAccent', name: '主题套图', desc: '免费', color: '#8B5CF6' },
  { id: 'pexels', name: 'Pexels图库', desc: '免费', color: '#10B981' },
  { id: 'aiGenerated', name: 'AI定制图', desc: '会员✨', color: '#F59E0B' },
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
  const currentThemeFromDb = getThemeById(currentThemeId);
  const currentTheme = (currentThemeFromDb
    ? { id: currentThemeFromDb.id, name: currentThemeFromDb.nameZh, colors: currentThemeFromDb.colors }
    : COLOR_THEMES[0]);
  const bgColor = currentTheme.colors[0];
  const accentColor = currentTheme.colors[1];
  const fontColor = currentTheme.colors[2];

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 animate-fade-in" onClick={onClose}>
      <div className="bg-white rounded-2xl sm:rounded-3xl shadow-2xl w-[400px] max-w-[96vw] max-h-[88vh] overflow-y-auto animate-modal-in" onClick={(e) => e.stopPropagation()}>
        {/* 顶部渐变装饰条 */}
        <div className="h-1.5 bg-gradient-to-r from-[#5B4FE9] via-[#7C3AED] to-[#8B5CF6]" />

        <div className="p-3 sm:p-5">
          {/* Header */}
          <div className="flex items-center justify-between mb-4 sm:mb-5">
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
          <div className="mb-4 sm:mb-5">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2.5">🎨 主题色系</p>
            <div className="mb-2.5 sm:mb-3 rounded-xl border border-indigo-100 bg-indigo-50/60 p-2 sm:p-3">
              <p className="text-xs font-semibold text-indigo-700 mb-2">当前配色预览 · {currentTheme.name}</p>
              <div className="rounded-lg bg-white border border-indigo-100 p-2">
                <p className="text-[11px] font-bold text-slate-600 mb-1.5">大色块预览（背景/强调/字体）</p>
                <div className="relative h-14 sm:h-24 rounded-lg border border-slate-200 p-1.5 sm:p-3 overflow-hidden" style={{ backgroundColor: bgColor }}>
                  <div className="absolute top-2 right-2 sm:top-2.5 sm:right-2.5 rounded-md px-2 py-0.5 sm:px-2.5 sm:py-1 border border-white/40 shadow-sm" style={{ backgroundColor: accentColor }}>
                    <span className="text-[10px] sm:text-xs font-semibold" style={{ color: fontColor }}>强调色</span>
                  </div>
                  <div className="absolute left-2 bottom-2 sm:left-3 sm:bottom-3">
                    <p className="text-xs sm:text-xl font-black leading-none" style={{ color: fontColor }}>省心PPT</p>
                    <p className="text-[10px] mt-1 opacity-85" style={{ color: fontColor }}>色彩展示更直观</p>
                  </div>
                </div>
                <div className="mt-2 grid grid-cols-3 gap-1 text-[10px] text-slate-400">
                  <span className="truncate">背景 {bgColor}</span>
                  <span className="truncate">强调 {accentColor}</span>
                  <span className="truncate">字体 {fontColor}</span>
                </div>
              </div>
            </div>
            <div className="grid grid-cols-5 sm:grid-cols-3 gap-1 sm:gap-2">
              {COLOR_THEMES.map(t => (
                <button
                  key={t.id}
                  onClick={() => { onThemeChange(t.id); }}
                  className={`flex flex-col items-center justify-center gap-0.5 px-0.5 py-1 sm:flex-row sm:justify-start sm:gap-1.5 sm:px-3 sm:py-2.5 rounded-lg sm:rounded-xl border transition-all sm:border-2 ${
                    currentThemeId === t.id
                      ? 'border-[#5B4FE9] bg-[#F5F3FF] shadow-sm'
                      : 'border-gray-100 hover:border-gray-200'
                  }`}
                >
                  <div className="flex gap-0.5 flex-shrink-0">
                    {t.colors.map((c, i) => (
                    <div key={i} className="w-2 h-2 sm:w-3.5 sm:h-3.5 rounded-full border border-gray-200/50" style={{ backgroundColor: c }} />
                  ))}
                  </div>
                  <span className={`text-[7px] sm:text-xs font-medium truncate max-w-full ${currentThemeId === t.id ? 'text-[#4338CA]' : 'text-gray-600'}`}>{t.name}</span>
                  {currentThemeId === t.id && (
                    <svg className="hidden sm:block w-3.5 h-3.5 text-[#5B4FE9] ml-auto flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M5 13l4 4L19 7"/></svg>
                  )}
                </button>
              ))}
            </div>
            <div className="mt-2 rounded-xl border border-slate-100 bg-slate-50/70 p-2">
              <p className="text-[10px] font-semibold text-slate-500 mb-1.5">推荐色系</p>
              <div className="flex flex-wrap gap-1.5">
                {RECOMMENDED_THEME_IDS.map((item) => (
                  <button
                    key={item.id}
                    onClick={() => onThemeChange(item.id)}
                    className={`px-2 py-1 rounded-lg border text-[10px] font-medium transition-all ${
                      currentThemeId === item.id
                        ? 'border-[#5B4FE9] bg-[#F5F3FF] text-[#4338CA]'
                        : 'border-slate-200 text-slate-600 hover:border-slate-300'
                    }`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
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
