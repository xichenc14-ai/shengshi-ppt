'use client';

import React, { useState } from 'react';

const GEN_MODES = [
  { id: 'generate', name: 'AI创作', icon: '🤖', desc: '从零生成' },
  { id: 'condense', name: '智能摘要', icon: '📝', desc: '提炼要点' },
  { id: 'preserve', name: '原文排版', icon: '📄', desc: '美化原文' },
];

const COLOR_THEMES = [
  { id: 'auto', name: '智能', colors: ['#5B4FE9', '#8B5CF6', '#C4B5FD'] },
  { id: 'consultant', name: '商务蓝', colors: ['#1E40AF', '#3B82F6', '#93C5FD'] },
  { id: 'electric', name: '活力橙', colors: ['#EA580C', '#F97316', '#FDBA74'] },
  { id: 'chisel', name: '大地棕', colors: ['#78350F', '#A16207', '#FDE68A'] },
  { id: 'blues', name: '高级金', colors: ['#1E3A5F', '#C9A96E', '#F5E6CC'] },
  { id: 'gleam', name: '科技青', colors: ['#0F766E', '#14B8A6', '#99F6E4'] },
  { id: 'founder', name: '路演紫', colors: ['#5B4FE9', '#8B5CF6', '#C4B5FD'] },
  { id: 'default-light', name: '极简白', colors: ['#F1F5F9', '#CBD5E1', '#64748B'] },
];

const TONES = [
  { id: 'professional', name: '正式', icon: '💼' },
  { id: 'casual', name: '轻松', icon: '😊' },
  { id: 'creative', name: '创意', icon: '💡' },
  { id: 'traditional', name: '古风', icon: '🏯' },
];

const IMAGE_MODES = [
  { id: 'auto', name: '自动', desc: '智能配图' },
  { id: 'none', name: '无图', desc: '纯文字' },
  { id: 'web', name: '精选', desc: '商用图' },
];

interface ProPanelProps {
  open: boolean;
  onClose: () => void;
  genMode: string;
  setGenMode: (v: string) => void;
  theme: string;
  setTheme: (v: string) => void;
  tone: string;
  setTone: (v: string) => void;
  imgMode: string;
  setImgMode: (v: string) => void;
  pages: number;
  setPages: (v: number) => void;
}

export default function ProPanel({ open, onClose, genMode, setGenMode, theme, setTheme, tone, setTone, imgMode, setImgMode, pages, setPages }: ProPanelProps) {
  // ESC key to close
  React.useEffect(() => {
    if (!open) return;
    const handleEsc = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handleEsc);
    return () => document.removeEventListener('keydown', handleEsc);
  }, [open]);

  if (!open) return null;

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/20 backdrop-blur-sm z-40" onClick={onClose} />

      {/* Slide-in panel from right */}
      <div className="fixed right-0 top-0 bottom-0 w-80 md:w-96 bg-white shadow-2xl z-50 overflow-y-auto animate-slide-in-right">
        {/* Header */}
        <div className="sticky top-0 bg-white/90 backdrop-blur-xl border-b border-gray-100 px-5 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-[#EDE9FE] to-[#DDD6FE] flex items-center justify-center">
              <svg className="w-4 h-4 text-[#5B4FE9]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
            </div>
            <div>
              <h3 className="text-sm font-bold text-gray-900">专业模式</h3>
              <p className="text-[10px] text-gray-400 mt-0.5">自定义生成参数</p>
            </div>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-lg hover:bg-gray-100 flex items-center justify-center text-gray-400 hover:text-gray-600 transition-colors">
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12"/></svg>
          </button>
        </div>

        <div className="p-5 space-y-6">
          {/* Generate mode */}
          <div>
            <div className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-2">生成模式</div>
            <div className="grid grid-cols-3 gap-2">
              {GEN_MODES.map(m => (
                <button
                  key={m.id}
                  onClick={() => setGenMode(m.id)}
                  className={`py-3 px-2 rounded-xl border text-center transition-all cursor-pointer ${
                    genMode === m.id ? 'border-[#5B4FE9] bg-[#F5F3FF]/60 shadow-sm shadow-purple-100/50' : 'border-gray-100 hover:border-gray-200'
                  }`}
                >
                  <span className="text-lg">{m.icon}</span>
                  <div className={`text-[11px] font-semibold mt-1 ${genMode === m.id ? 'text-[#4338CA]' : 'text-gray-600'}`}>{m.name}</div>
                  <div className="text-[9px] text-gray-400">{m.desc}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Color themes */}
          <div>
            <div className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-2">主题色系</div>
            <div className="flex flex-wrap gap-2">
              {COLOR_THEMES.map(t => (
                <button
                  key={t.id}
                  onClick={() => setTheme(t.id)}
                  className={`flex items-center gap-1.5 px-3 py-2 rounded-lg border transition-all cursor-pointer ${
                    theme === t.id ? 'border-[#5B4FE9] bg-[#F5F3FF]/60' : 'border-gray-100 hover:border-gray-200'
                  }`}
                >
                  <div className="flex gap-0.5">{t.colors.map((c, i) => <div key={i} className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: c }} />)}</div>
                  <span className={`text-[11px] font-medium ${theme === t.id ? 'text-[#4338CA]' : 'text-gray-500'}`}>{t.name}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Tone */}
          <div>
            <div className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-2">语气风格</div>
            <div className="grid grid-cols-4 gap-2">
              {TONES.map(t => (
                <button
                  key={t.id}
                  onClick={() => setTone(t.id)}
                  className={`py-2 rounded-lg border text-center transition-all cursor-pointer ${
                    tone === t.id ? 'border-[#5B4FE9] bg-[#F5F3FF]/60' : 'border-gray-100 hover:border-gray-200'
                  }`}
                >
                  <span className="text-sm">{t.icon}</span>
                  <div className={`text-[10px] font-medium mt-0.5 ${tone === t.id ? 'text-[#4338CA]' : 'text-gray-500'}`}>{t.name}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Image mode */}
          <div>
            <div className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-2">配图模式</div>
            <div className="grid grid-cols-3 gap-2">
              {IMAGE_MODES.map(m => (
                <button
                  key={m.id}
                  onClick={() => setImgMode(m.id)}
                  className={`py-2.5 rounded-lg border text-center transition-all cursor-pointer ${
                    imgMode === m.id ? 'border-[#5B4FE9] bg-[#F5F3FF]/60' : 'border-gray-100 hover:border-gray-200'
                  }`}
                >
                  <div className={`text-[11px] font-semibold ${imgMode === m.id ? 'text-[#4338CA]' : 'text-gray-600'}`}>{m.name}</div>
                  <div className="text-[9px] text-gray-400">{m.desc}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Pages slider */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <div className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">页数</div>
              <div className="text-sm font-bold text-[#5B4FE9]">{pages} 页</div>
            </div>
            <input
              type="range"
              min={3}
              max={30}
              value={pages}
              onChange={e => setPages(Number(e.target.value))}
              className="w-full"
            />
            <div className="flex justify-between text-[9px] text-gray-300 mt-1"><span>3</span><span>30</span></div>
          </div>
        </div>
      </div>
    </>
  );
}
