'use client';
import React, { useState } from 'react';
import { THEME_DATABASE, COLOR_CATEGORIES, getThemesByCategory, GammaTheme } from '@/lib/theme-database';

interface ThemeSelectorProps {
  value: string;
  onChange: (themeId: string) => void;
}

export default function ThemeSelector({ value, onChange }: ThemeSelectorProps) {
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const themes = selectedCategory ? getThemesByCategory(selectedCategory) : [];
  const currentTheme = THEME_DATABASE.find(t => t.id === value);

  return (
    <div>
      {/* 第一级：色系选择 */}
      <div className="grid grid-cols-7 gap-2 mb-4">
        {COLOR_CATEGORIES.map(cat => (
          <button
            key={cat.id}
            onClick={() => setSelectedCategory(cat.id === selectedCategory ? null : cat.id)}
            className={`flex flex-col items-center p-2 rounded-xl border-2 transition-all ${
              selectedCategory === cat.id
                ? 'border-[#5B4FE9] bg-[#F5F3FF] scale-105'
                : 'border-gray-100 hover:border-gray-200 bg-white'
            }`}
          >
            <span className="text-xl mb-0.5">{cat.emoji}</span>
            <span className="text-[10px] font-medium text-gray-700">{cat.name}</span>
            <span className="text-[9px] text-gray-400">{cat.count}个</span>
          </button>
        ))}
      </div>

      {/* 第二级：该色系下的主题 */}
      {selectedCategory && (
        <div className="bg-gray-50 rounded-xl p-4 mb-4">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-medium text-gray-600">
              {COLOR_CATEGORIES.find(c => c.id === selectedCategory)?.emoji}{' '}
              {COLOR_CATEGORIES.find(c => c.id === selectedCategory)?.name}
            </span>
            <button onClick={() => setSelectedCategory(null)} className="text-xs text-gray-400 hover:text-gray-600">收起 △</button>
          </div>
          <div className="grid grid-cols-4 gap-2">
            {themes.map(theme => (
              <button
                key={theme.id}
                onClick={() => onChange(theme.id)}
                className={`relative flex flex-col items-center p-2 rounded-xl border-2 transition-all ${
                  value === theme.id
                    ? 'border-[#5B4FE9] bg-white shadow-sm'
                    : 'border-gray-100 hover:border-gray-200 bg-white'
                }`}
              >
                {value === theme.id && (
                  <span className="absolute top-1 right-1 text-[10px] bg-[#5B4FE9] text-white rounded-full w-4 h-4 flex items-center justify-center">✓</span>
                )}
                <div className="flex gap-0.5 mb-1">
                  {theme.colors.slice(0, 3).map((c, i) => (
                    <div key={i} className="w-5 h-5 rounded-sm" style={{ backgroundColor: c }} />
                  ))}
                </div>
                <span className="text-[10px] font-medium text-gray-700">{theme.nameZh}</span>
                <span className="text-[9px] text-gray-400">{theme.style}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* 当前选中预览 */}
      {currentTheme && (
        <div className="flex items-center gap-2 text-xs text-gray-500">
          <span>已选：</span>
          <div className="flex gap-0.5">
            {currentTheme.colors.map((c, i) => (
              <div key={i} className="w-3 h-3 rounded-sm" style={{ backgroundColor: c }} />
            ))}
          </div>
          <span>{currentTheme.nameZh}</span>
          <span className="text-gray-300">|</span>
          <span>{currentTheme.style}</span>
        </div>
      )}
    </div>
  );
}
