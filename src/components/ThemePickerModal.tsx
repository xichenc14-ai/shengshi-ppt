'use client';

import React from 'react';
import { THEME_DATABASE, getRecommendedThemes, getThemeById } from '@/lib/theme-database';

const COLOR_THEMES = THEME_DATABASE.map((theme) => ({
  id: theme.id,
  name: theme.nameZh,
  colors: theme.colors,
  previewImage: theme.previewImage,
  style: theme.style,
  recommended: theme.isRecommended,
}));

const RECOMMENDED_THEMES = getRecommendedThemes().map((theme) => ({
  id: theme.id,
  label: theme.nameZh,
}));

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
  { id: 'aiGenerated', name: 'AI定制图', desc: '省心会员💎', color: '#F59E0B' },
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
    ? {
        id: currentThemeFromDb.id,
        name: currentThemeFromDb.nameZh,
        colors: currentThemeFromDb.colors,
        previewImage: currentThemeFromDb.previewImage,
        style: currentThemeFromDb.style,
        recommended: currentThemeFromDb.isRecommended,
      }
    : COLOR_THEMES[0]);

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
              <p className="text-xs font-semibold text-indigo-700 mb-2">当前主题预览 · {currentTheme.name}</p>
              <div className="rounded-lg bg-white border border-indigo-100 p-2">
                <div className="relative h-20 overflow-hidden rounded-lg border border-slate-200 bg-slate-100 sm:h-28">
                  {currentTheme.previewImage ? (
                    <img
                      src={currentTheme.previewImage}
                      alt={currentTheme.name}
                      className="h-full w-full object-cover"
                      draggable={false}
                    />
                  ) : (
                    <div
                      className="h-full w-full"
                      style={{ background: `linear-gradient(135deg, ${currentTheme.colors[0]}, ${currentTheme.colors[1]})` }}
                    />
                  )}
                  <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/72 via-black/30 to-transparent px-3 pb-2 pt-8">
                    <p className="text-sm font-black leading-none text-white sm:text-lg">{currentTheme.name}</p>
                    <p className="mt-1 truncate text-[10px] text-white/78">{currentTheme.style}</p>
                  </div>
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
                  title={`${t.name} · ${t.style}`}
                >
                  <div className="relative h-7 w-9 flex-shrink-0 overflow-hidden rounded border border-gray-200/70 sm:h-8 sm:w-12">
                    {t.previewImage ? (
                      <img src={t.previewImage} alt="" className="h-full w-full object-cover" draggable={false} />
                    ) : (
                      <div className="h-full w-full" style={{ background: `linear-gradient(135deg, ${t.colors[0]}, ${t.colors[1]})` }} />
                    )}
                  </div>
                  <span className={`text-[7px] sm:text-xs font-medium truncate max-w-full ${currentThemeId === t.id ? 'text-[#4338CA]' : 'text-gray-600'}`}>{t.name}</span>
                  {t.recommended && (
                    <span className="hidden rounded bg-indigo-50 px-1 text-[9px] font-bold text-indigo-600 sm:inline">荐</span>
                  )}
                  {currentThemeId === t.id && (
                    <svg className="hidden sm:block w-3.5 h-3.5 text-[#5B4FE9] ml-auto flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M5 13l4 4L19 7"/></svg>
                  )}
                </button>
              ))}
            </div>
            <div className="mt-2 rounded-xl border border-slate-100 bg-slate-50/70 p-2">
              <p className="text-[10px] font-semibold text-slate-500 mb-1.5">推荐色系</p>
              <div className="flex flex-wrap gap-1.5">
                {RECOMMENDED_THEMES.map((item) => (
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
