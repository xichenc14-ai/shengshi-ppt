'use client';

import React, { useMemo, useState } from 'react';
import { COLOR_CATEGORIES, getRecommendedThemes, getThemeById, getThemesByCategory, type ThemeData } from '@/lib/theme-database';

interface ThemeSelectorProps {
  value: string;
  onChange: (themeId: string) => void;
}

type CategoryId = string | 'recommended';
type ThemeCategoryOption = {
  id: string;
  name: string;
  colors: string[];
  count: number;
  themes: ThemeData[];
};
const MAX_THEMES_PER_PANEL = 12;

function getThemeCard(theme: ThemeData, active: boolean, onChange: (themeId: string) => void) {
  const [bg, accent, font] = theme.colors;
  const textColor = font || '#1F2937';

  return (
    <button
      key={theme.id}
      onClick={() => onChange(theme.id)}
      className={`relative rounded-full border-2 px-1 py-1 md:px-1.5 md:py-1.5 text-left transition-all ${
        active
          ? 'border-[#5B4FE9] bg-[#F5F3FF] shadow-sm'
          : 'border-slate-200 bg-white hover:border-indigo-200'
      }`}
    >
      <div
        className="relative h-[46px] md:h-[58px] rounded-full border border-black/5 overflow-hidden p-1"
        style={{ backgroundColor: bg }}
      >
        <span
          className="absolute top-1 right-1 h-3.5 px-1 rounded-md border border-white/40 text-[8px] font-semibold leading-[12px] shadow-sm md:h-4 md:text-[8px] md:leading-[14px]"
          style={{ backgroundColor: accent, color: textColor }}
        >
          强调
        </span>
        <div className="absolute left-2.5 md:left-3 bottom-1.5 right-2">
          <div className="flex items-center gap-1.5">
            <span className="text-[9px] md:text-[10px] font-medium tracking-[0.01em] truncate leading-[1.15]" style={{ color: textColor }}>{theme.nameZh}</span>
            <div className="hidden md:flex items-center gap-1">
              <span className="w-2 h-2 rounded-full border border-white/60" style={{ backgroundColor: bg }} title={`背景色 ${bg}`} />
              <span className="w-2 h-2 rounded-full border border-white/60" style={{ backgroundColor: accent }} title={`强调色 ${accent}`} />
              <span className="w-2 h-2 rounded-full border border-white/60" style={{ backgroundColor: textColor }} title={`字体色 ${textColor}`} />
            </div>
          </div>
        </div>
      </div>
    </button>
  );
}

export default function ThemeSelector({ value, onChange }: ThemeSelectorProps) {
  const [selectedCategory, setSelectedCategory] = useState<CategoryId>('recommended');
  const selectedTheme = getThemeById(value);

  const recommendedThemeList = useMemo(() => {
    return getRecommendedThemes();
  }, []);

  const recommendedSwatch = useMemo(() => {
    const fallback = ['#5B4FE9', '#22C55E', '#EC4899'];
    const colors = recommendedThemeList.slice(0, 3).map((t) => t.colors[0]).filter(Boolean);
    return colors.length === 3 ? colors : fallback;
  }, [recommendedThemeList]);

  const categoryOptions = useMemo(() => {
    const options: ThemeCategoryOption[] = [
      {
        id: 'recommended',
        name: '推荐色系',
        colors: recommendedSwatch,
        count: recommendedThemeList.length,
        themes: recommendedThemeList.slice(0, MAX_THEMES_PER_PANEL),
      },
    ];

    for (const cat of COLOR_CATEGORIES) {
      const catThemes = getThemesByCategory(cat.id).slice(0, MAX_THEMES_PER_PANEL);
      if (!catThemes.length) continue;
      const previewColors = catThemes.slice(0, 3).map((t) => t.colors[0]).filter(Boolean);
      options.push({
        id: cat.id,
        name: cat.name,
        colors: previewColors.length === 3 ? previewColors : cat.colors.slice(0, 3),
        count: catThemes.length,
        themes: catThemes,
      });
    }
    return options;
  }, [recommendedSwatch, recommendedThemeList]);

  const themes = useMemo(() => {
    return categoryOptions.find((item) => item.id === selectedCategory)?.themes || recommendedThemeList.slice(0, MAX_THEMES_PER_PANEL);
  }, [categoryOptions, selectedCategory, recommendedThemeList]);

  const selectedMeta = useMemo(() => {
    const selected = categoryOptions.find((item) => item.id === selectedCategory);
    if (selected) {
      return {
        id: selected.id,
        name: selected.name,
        colors: selected.colors.slice(0, 3),
        count: selected.count,
      };
    }
    return { id: 'recommended', name: '推荐色系', colors: recommendedSwatch, count: recommendedThemeList.length };
  }, [selectedCategory, categoryOptions, recommendedSwatch, recommendedThemeList.length]);

  return (
    <div>
      {/* 分类行：推荐色系在第一位，和其他色系同栏同逻辑 */}
      <div className="flex items-center gap-2.5 overflow-x-auto pb-2 -mx-1 px-1 scrollbar-hide whitespace-nowrap">
        {categoryOptions.map((cat) => (
          <button
            key={cat.id}
            onClick={() => setSelectedCategory(cat.id)}
            className={`flex-shrink-0 flex flex-col items-center h-14 px-3 justify-center rounded-full border-2 transition-all duration-200 ${
              selectedCategory === cat.id
                ? 'border-[#5B4FE9] bg-[#F5F3FF] scale-[1.03] shadow-sm'
                : 'border-gray-100 hover:border-gray-200 bg-white hover:shadow-sm'
            }`}
            title={cat.id === 'recommended' ? '推荐色系（按场景）' : cat.name}
          >
            <div className="flex gap-1 mb-1">
              {cat.colors.slice(0, 3).map((c, i) => (
                <span key={`${cat.id}-${i}`} className="w-3.5 h-3.5 md:w-4 md:h-4 rounded-full shadow-sm border border-white/60" style={{ backgroundColor: c }} />
              ))}
            </div>
            <span className="text-[11px] font-medium text-gray-600 whitespace-nowrap">{cat.name}</span>
          </button>
        ))}
      </div>

      <div className="bg-[#FAFBFE] rounded-2xl p-3 md:p-4 mt-2 animate-fade-in border border-slate-100">
        <div className="flex items-center justify-between gap-2 mb-3">
          <div className="flex items-center gap-2 min-w-0">
            <div className="flex gap-1">
              {selectedMeta.colors.slice(0, 3).map((c, i) => (
                <span key={`${selectedMeta.id}-${i}`} className="w-3 h-3 rounded-full border border-slate-200" style={{ backgroundColor: c }} />
              ))}
            </div>
            <span className="text-[15px] font-semibold text-gray-700 truncate">{selectedMeta.name}</span>
            <span className="text-xs text-gray-400 shrink-0">· {selectedMeta.count} 个主题</span>
          </div>
          {selectedTheme && (
            <div className="hidden md:flex items-center gap-2 text-[11px] text-slate-500">
              <span>当前</span>
              <span className="font-semibold text-slate-700">{selectedTheme.nameZh}</span>
              <span className="w-2.5 h-2.5 rounded-full border border-slate-200" style={{ backgroundColor: selectedTheme.colors[0] }} title={`背景色 ${selectedTheme.colors[0]}`} />
              <span className="w-2.5 h-2.5 rounded-full border border-slate-200" style={{ backgroundColor: selectedTheme.colors[1] }} title={`强调色 ${selectedTheme.colors[1]}`} />
              <span className="w-2.5 h-2.5 rounded-full border border-slate-200" style={{ backgroundColor: selectedTheme.colors[2] }} title={`字体色 ${selectedTheme.colors[2]}`} />
            </div>
          )}
        </div>

        <div className="grid grid-cols-5 !grid-cols-3 md:!grid-cols-5 gap-2 md:gap-3">
          {themes.map((theme) => getThemeCard(theme, value === theme.id, onChange))}
        </div>
      </div>
    </div>
  );
}
