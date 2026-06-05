'use client';

import React, { useMemo, useState } from 'react';
import { COLOR_CATEGORIES, getThemeById, getThemesByCategory, type ThemeData } from '@/lib/theme-database';

interface ThemeSelectorProps {
  value: string;
  onChange: (themeId: string) => void;
}

const RECOMMENDED_THEMES: Array<{ label: string; themeId: string }> = [
  { label: '商务蓝 · 商务汇报', themeId: 'consultant' },
  { label: '科技紫 · 科技发布', themeId: 'aurora' },
  { label: '简约白 · 纯净极简', themeId: 'howlite' },
  { label: '雅致米 · 田园风', themeId: 'finesse' },
  { label: '清新绿 · 自然清爽', themeId: 'elysia' },
  { label: '古风灰 · 稳重克制', themeId: 'ash' },
  { label: '少女粉 · 柔和表达', themeId: 'ashrose' },
];

type CategoryId = string | 'recommended';
type ThemeCategoryOption = {
  id: string;
  name: string;
  colors: string[];
  count: number;
  themes: ThemeData[];
};
const MAX_THEMES_PER_PANEL = 10; // 2行 × 5列

function getThemeCard(theme: ThemeData, active: boolean, onChange: (themeId: string) => void) {
  const [bg, accent, font] = theme.colors;
  const textColor = font || '#1F2937';

  return (
    <button
      key={theme.id}
      onClick={() => onChange(theme.id)}
      className={`relative rounded-lg border-2 px-1 py-1 sm:rounded-xl sm:px-1.5 sm:py-1.5 md:px-2 md:py-2 text-left transition-all ${
        active
          ? 'border-[#5B4FE9] bg-white shadow-md shadow-indigo-100/50'
          : 'border-slate-100 bg-white hover:border-indigo-200 hover:shadow-sm'
      }`}
    >
      {active && (
        <span className="absolute -top-1.5 -right-1.5 w-4.5 h-4.5 rounded-full bg-[#5B4FE9] flex items-center justify-center shadow">
          <svg className="w-2.5 h-2.5 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
            <polyline points="20,6 9,17 4,12" />
          </svg>
        </span>
      )}
      <div className="relative h-[48px] rounded-md border border-black/5 overflow-hidden p-1 sm:h-[62px] sm:rounded-lg sm:p-2 md:h-[70px] md:p-2.5" style={{ backgroundColor: bg }}>
        <span
          className="absolute top-1 right-1 h-3.5 px-1 rounded border border-white/40 text-[8px] font-semibold leading-[14px] shadow-sm sm:top-1.5 sm:right-1.5 sm:h-4.5 sm:px-1.5 sm:text-[10px] sm:leading-[18px]"
          style={{ backgroundColor: accent, color: textColor }}
        >
          强调
        </span>
        <div className="absolute left-1 bottom-1 right-1 sm:left-2 sm:bottom-2 sm:right-2">
          <div className="text-[11px] font-black leading-none truncate sm:text-[16px] md:text-[18px]" style={{ color: textColor }}>
            省心PPT
          </div>
          <div className="mt-0.5 flex items-center gap-1 sm:mt-1 sm:gap-1.5">
            <span className="text-[8px] font-bold truncate sm:text-[10px]" style={{ color: textColor }}>{theme.nameZh}</span>
            <div className="hidden sm:flex items-center gap-1">
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
    const ids = new Set<string>();
    return RECOMMENDED_THEMES.map((item) => {
      const theme = getThemeById(item.themeId);
      if (!theme || ids.has(theme.id)) return null;
      ids.add(theme.id);
      return theme;
    }).filter(Boolean) as ThemeData[];
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
      <div className="flex items-center gap-1 overflow-x-auto pb-2 -mx-1 px-1 scrollbar-hide sm:gap-2">
        {categoryOptions.map((cat) => (
          <button
            key={cat.id}
            onClick={() => setSelectedCategory(cat.id)}
            className={`flex-shrink-0 flex flex-col items-center p-1 rounded-lg border-2 transition-all duration-200 sm:p-2 sm:rounded-xl ${
              selectedCategory === cat.id
                ? 'border-[#5B4FE9] bg-[#F5F3FF] scale-[1.03] shadow-sm'
                : 'border-gray-100 hover:border-gray-200 bg-white hover:shadow-sm'
            }`}
            title={cat.id === 'recommended' ? '推荐色系（按场景）' : cat.name}
          >
            <div className="flex gap-0.5 mb-1">
              {cat.colors.slice(0, 3).map((c, i) => (
                <span key={`${cat.id}-${i}`} className="w-3 h-3 rounded-full shadow-sm border border-white/60 sm:w-4 sm:h-4" style={{ backgroundColor: c }} />
              ))}
            </div>
            <span className="text-[9px] font-medium text-gray-600 whitespace-nowrap sm:text-[10px]">{cat.name}</span>
          </button>
        ))}
      </div>

      <div className="bg-[#FAFBFE] rounded-xl p-2.5 sm:p-3 md:p-4 mt-2 animate-fade-in">
        <div className="flex items-center justify-between gap-2 mb-3">
          <div className="flex items-center gap-2 min-w-0">
            <div className="flex gap-1">
              {selectedMeta.colors.slice(0, 3).map((c, i) => (
                <span key={`${selectedMeta.id}-${i}`} className="w-3 h-3 rounded-full border border-slate-200" style={{ backgroundColor: c }} />
              ))}
            </div>
            <span className="text-sm font-semibold text-gray-700 truncate">{selectedMeta.name}</span>
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

        <div className="grid grid-cols-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-1 sm:gap-2">
          {themes.map((theme) => getThemeCard(theme, value === theme.id, onChange))}
        </div>
      </div>
    </div>
  );
}
