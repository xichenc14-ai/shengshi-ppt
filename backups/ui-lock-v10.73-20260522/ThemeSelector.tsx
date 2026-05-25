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

function getThemeCard(theme: ThemeData, active: boolean, onChange: (themeId: string) => void) {
  const [bg, accent, font] = theme.colors;
  const textColor = font || '#1F2937';

  return (
    <button
      key={theme.id}
      onClick={() => onChange(theme.id)}
      className={`relative rounded-2xl border-2 px-3 py-3 text-left transition-all ${
        active
          ? 'border-[#5B4FE9] bg-white shadow-md shadow-indigo-100/50'
          : 'border-slate-100 bg-white hover:border-indigo-200 hover:shadow-sm'
      }`}
    >
      {active && (
        <span className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-[#5B4FE9] flex items-center justify-center shadow">
          <svg className="w-2.5 h-2.5 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
            <polyline points="20,6 9,17 4,12" />
          </svg>
        </span>
      )}
      <div className="rounded-xl border border-slate-200 bg-white p-2.5">
        <div className="flex items-center gap-2.5">
          <div
            className="relative w-[23%] min-w-[78px] h-12 rounded-lg border border-black/5 overflow-hidden shrink-0"
            style={{ backgroundColor: bg }}
          >
            <span
              className="absolute top-1 right-1 h-3.5 px-1 rounded-md border border-white/50 text-[8px] font-semibold leading-[14px]"
              style={{ backgroundColor: accent, color: textColor }}
            >
              强调
            </span>
            <span
              className="absolute left-1 bottom-1 text-[9px] font-bold leading-none truncate max-w-[60px]"
              style={{ color: textColor }}
            >
              省心PPT
            </span>
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-xs font-semibold text-slate-700 truncate">{theme.nameZh}</div>
            <div className="mt-1.5 flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full border border-slate-200" style={{ backgroundColor: bg }} title={`背景色 ${bg}`} />
              <span className="w-2.5 h-2.5 rounded-full border border-slate-200" style={{ backgroundColor: accent }} title={`强调色 ${accent}`} />
              <span className="w-2.5 h-2.5 rounded-full border border-slate-200" style={{ backgroundColor: textColor }} title={`字体色 ${textColor}`} />
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

  const themes = useMemo(() => {
    if (selectedCategory === 'recommended') return recommendedThemeList;
    return getThemesByCategory(selectedCategory);
  }, [selectedCategory, recommendedThemeList]);

  const selectedMeta = useMemo(() => {
    if (selectedCategory === 'recommended') {
      return { id: 'recommended', name: '推荐色系', colors: recommendedSwatch, count: recommendedThemeList.length };
    }
    const category = COLOR_CATEGORIES.find((c) => c.id === selectedCategory);
    return {
      id: selectedCategory,
      name: category?.name || '色系',
      colors: category?.colors?.slice(0, 3) || recommendedSwatch,
      count: themes.length,
    };
  }, [selectedCategory, recommendedSwatch, recommendedThemeList.length, themes.length]);

  return (
    <div>
      {/* 分类行：推荐色系在第一位，和其他色系同栏同逻辑 */}
      <div className="flex items-center gap-2 overflow-x-auto pb-2 -mx-1 px-1 scrollbar-hide">
        <button
          onClick={() => setSelectedCategory('recommended')}
          className={`flex-shrink-0 flex flex-col items-center p-2 rounded-xl border-2 transition-all duration-200 ${
            selectedCategory === 'recommended'
              ? 'border-[#5B4FE9] bg-[#F5F3FF] scale-[1.03] shadow-sm'
              : 'border-gray-100 hover:border-gray-200 bg-white hover:shadow-sm'
          }`}
          title="推荐色系（按场景）"
        >
          <div className="flex gap-1 mb-1">
            {recommendedSwatch.map((color) => (
              <span key={color} className="w-4 h-4 rounded-full shadow-sm border border-white/60" style={{ backgroundColor: color }} />
            ))}
          </div>
          <span className="text-[10px] font-medium text-gray-600 whitespace-nowrap">推荐色系</span>
        </button>

        {COLOR_CATEGORIES.map((cat) => (
          <button
            key={cat.id}
            onClick={() => setSelectedCategory(cat.id)}
            className={`flex-shrink-0 flex flex-col items-center p-2 rounded-xl border-2 transition-all duration-200 ${
              selectedCategory === cat.id
                ? 'border-[#5B4FE9] bg-[#F5F3FF] scale-[1.03] shadow-sm'
                : 'border-gray-100 hover:border-gray-200 bg-white hover:shadow-sm'
            }`}
            title={cat.name}
          >
            <div className="flex gap-1 mb-1">
              {cat.colors.slice(0, 3).map((c, i) => (
                <span key={`${cat.id}-${i}`} className="w-4 h-4 rounded-full shadow-sm border border-white/60" style={{ backgroundColor: c }} />
              ))}
            </div>
            <span className="text-[10px] font-medium text-gray-600 whitespace-nowrap">{cat.name}</span>
          </button>
        ))}
      </div>

      <div className="bg-[#FAFBFE] rounded-xl p-3 md:p-4 mt-2 animate-fade-in">
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

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2.5">
          {themes.map((theme) => getThemeCard(theme, value === theme.id, onChange))}
        </div>
      </div>
    </div>
  );
}
