'use client';
import React, { useState } from 'react';
import { THEME_DATABASE, COLOR_CATEGORIES, getThemesByCategory, getThemeById, ThemeData } from '@/lib/theme-database';

interface ThemeSelectorProps {
  value: string;
  onChange: (themeId: string) => void;
}

export default function ThemeSelector({ value, onChange }: ThemeSelectorProps) {
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const themes = selectedCategory ? getThemesByCategory(selectedCategory) : [];
  const selectedTheme = getThemeById(value);

  // 色系说明标签
  const colorLabels = ['背景', '强调', '字体'];

  return (
    <div>
      {/* Selected theme color info */}
      {selectedTheme && (
        <div className="flex items-center gap-3 px-1 py-2">
          <span className="text-xs text-gray-400 flex-shrink-0">色系说明</span>
          <div className="flex items-center gap-2">
            {selectedTheme.colors.map((color, i) => (
              <span key={i} className="flex items-center gap-1">
                <span className="text-[11px] text-gray-500">{colorLabels[i]}</span>
                <span className="w-3 h-3 rounded-full border border-gray-200 shadow-sm" style={{ backgroundColor: color }} />
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Color category swatches — horizontal scroll on mobile */}
      <div className="flex items-center gap-2 overflow-x-auto pb-2 -mx-1 px-1 scrollbar-hide">
        {COLOR_CATEGORIES.map(cat => (
          <button
            key={cat.id}
            onClick={() => setSelectedCategory(cat.id === selectedCategory ? null : cat.id)}
            className={`flex-shrink-0 flex flex-col items-center p-2 rounded-xl border-2 transition-all duration-200 ${
              selectedCategory === cat.id
                ? 'border-[#5B4FE9] bg-[#F5F3FF] scale-105 shadow-sm'
                : 'border-gray-100 hover:border-gray-200 bg-white hover:shadow-sm'
            }`}
            title={cat.name}
          >
            <div className="flex gap-1 mb-1">
              {cat.colors.slice(0, 3).map((c, i) => (
                <div key={i} className="w-4 h-4 rounded-full shadow-sm" style={{ backgroundColor: c }} />
              ))}
            </div>
            <span className="text-[10px] font-medium text-gray-600 whitespace-nowrap">{cat.name}</span>
          </button>
        ))}
      </div>

      {/* Sub-themes grid */}
      {selectedCategory && (
        <div className="bg-[#FAFBFE] rounded-xl p-4 mb-4 animate-fade-in">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <div className="flex gap-1">
                {(COLOR_CATEGORIES.find(c => c.id === selectedCategory)?.colors || []).slice(0, 3).map((c, i) => (
                  <div key={i} className="w-3 h-3 rounded-full" style={{ backgroundColor: c }} />
                ))}
              </div>
              <span className="text-sm font-medium text-gray-600">
                {COLOR_CATEGORIES.find(c => c.id === selectedCategory)?.name}
              </span>
              <span className="text-xs text-gray-400">· {themes.length} 个主题</span>
            </div>
            <button 
              onClick={() => setSelectedCategory(null)} 
              className="text-xs text-gray-400 hover:text-gray-600 flex items-center gap-1 transition-colors"
            >
              收起
              <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 15l-6-6-6 6"/></svg>
            </button>
          </div>
          <div className="grid grid-cols-4 gap-2">
            {themes.map(theme => (
              <button
                key={theme.id}
                onClick={() => onChange(theme.id)}
                className={`relative flex flex-col items-center p-2 rounded-xl border-2 transition-all duration-150 ${
                  value === theme.id
                    ? 'border-[#5B4FE9] bg-white shadow-sm'
                    : 'border-gray-100 hover:border-gray-200 bg-white hover:shadow-sm'
                }`}
              >
                {value === theme.id && (
                  <span className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-[#5B4FE9] rounded-full flex items-center justify-center shadow">
                    <svg className="w-2.5 h-2.5 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><polyline points="20,6 9,17 4,12"/></svg>
                  </span>
                )}
                <div className="flex gap-0.5 mb-1">
                  {theme.colors.slice(0, 3).map((c, i) => (
                    <div key={i} className="w-3 h-3 rounded-full shadow-sm" style={{ backgroundColor: c }} />
                  ))}
                </div>
                <span className="text-[10px] font-medium text-gray-700 text-center leading-tight">{theme.nameZh}</span>
              </button>
            ))}
          </div>
        </div>
      )}


    </div>
  );
}
