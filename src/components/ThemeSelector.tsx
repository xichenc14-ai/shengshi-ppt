'use client';

import React, { useMemo, useRef, useState } from 'react';
import { COLOR_CATEGORIES, getRecommendedThemes, getThemesByCategory, type ThemeData } from '@/lib/theme-database';

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
const MAX_THEMES_PER_PANEL = 8;
const CATEGORY_NECKLACE_ORDER = [
  'recommended',
  'yellowCream',
  'blue',
  'green',
  'purple',
  'pink',
  'neutral',
] as const;
const RECOMMENDED_NECKLACE_COLORS = ['#FFFFFF', '#F5B7C7', '#2C6EBC', '#D8A94A'];
const CATEGORY_GRADIENTS: Record<string, string> = {
  recommended: 'linear-gradient(115deg, #F8FAFC 0%, #9CC8FF 28%, #A78BFA 55%, #F5B7C7 78%, #D8A94A 100%)',
  yellowCream: 'linear-gradient(115deg, #F9F6F0 0%, #E8C77B 48%, #8A5A2B 100%)',
  blue: 'linear-gradient(115deg, #D7E8FF 0%, #3B82F6 48%, #0F2D5C 100%)',
  green: 'linear-gradient(115deg, #DFF7EC 0%, #22C55E 48%, #0B4F3A 100%)',
  purple: 'linear-gradient(115deg, #EDE9FE 0%, #8B5CF6 48%, #2E1065 100%)',
  pink: 'linear-gradient(115deg, #FCE7F3 0%, #EC4899 48%, #7F1D1D 100%)',
  neutral: 'linear-gradient(115deg, #FFFFFF 0%, #9CA3AF 50%, #111827 100%)',
};
const CONTINUOUS_SPECTRUM_GRADIENT = `linear-gradient(90deg,
  #F8FAFC 0%,
  #9CC8FF 8%,
  #A78BFA 15%,
  #F5B7C7 22%,
  #D8A94A 28%,
  #F9F6F0 34%,
  #E8C77B 42%,
  #0F2D5C 50%,
  #3B82F6 58%,
  #DFF7EC 65%,
  #22C55E 72%,
  #8B5CF6 80%,
  #EC4899 88%,
  #9CA3AF 94%,
  #111827 100%
)`;
const CATEGORY_DISPLAY_NAMES: Record<string, string> = {
  recommended: '推荐',
  yellowCream: '米黄',
  blue: '蓝色',
  green: '绿色',
  purple: '紫色',
  pink: '粉红',
  neutral: '黑白灰',
};

function getThemeCard(theme: ThemeData, active: boolean, onChange: (themeId: string) => void) {
  return (
    <button
      key={theme.id}
      onClick={() => onChange(theme.id)}
      className={`relative w-[calc((100%_-_16px)/3)] min-w-[calc((100%_-_16px)/3)] snap-start rounded-xl border-2 p-0.5 text-left transition-all sm:w-auto sm:min-w-0 sm:p-1 ${
        active
          ? 'border-[#5B4FE9] bg-[#F5F3FF] shadow-sm'
          : 'border-slate-200 bg-white hover:border-indigo-200'
      }`}
      title={`${theme.nameZh} · ${theme.style}`}
    >
      <div
        className="relative h-[54px] overflow-hidden rounded-lg border border-black/5 bg-slate-100 sm:h-[68px]"
      >
        {theme.previewImage ? (
          <img
            src={theme.previewImage}
            alt={theme.nameZh}
            className="h-full w-full object-cover"
            draggable={false}
          />
        ) : (
          <div
            className="h-full w-full"
            style={{ background: `linear-gradient(135deg, ${theme.colors[0]}, ${theme.colors[1]})` }}
          />
        )}
        <div className="absolute inset-x-0 bottom-0 flex items-center justify-between gap-1 bg-gradient-to-t from-black/72 via-black/34 to-transparent px-2 pb-1.5 pt-5">
          <span className="min-w-0 truncate text-[11px] font-semibold leading-[1.15] text-white sm:text-xs">{theme.nameZh}</span>
          {theme.isRecommended && (
            <span className="shrink-0 rounded bg-white/90 px-1 text-[8px] font-bold leading-3 text-[#5B4FE9]">荐</span>
          )}
        </div>
      </div>
    </button>
  );
}

export default function ThemeSelector({ value, onChange }: ThemeSelectorProps) {
  const [selectedCategory, setSelectedCategory] = useState<CategoryId>('recommended');
  const spectrumRef = useRef<HTMLDivElement>(null);
  const activePointerRef = useRef<number | null>(null);
  const pointerStartIndexRef = useRef<number | null>(null);
  const suppressClickRef = useRef(false);
  const themesRailRef = useRef<HTMLDivElement>(null);
  const themeDragRef = useRef({
    active: false,
    startX: 0,
    startScrollLeft: 0,
    moved: false,
  });

  const recommendedThemeList = useMemo(() => {
    return getRecommendedThemes();
  }, []);

  const recommendedSwatch = RECOMMENDED_NECKLACE_COLORS;

  const categoryOptions = useMemo(() => {
    const optionsById = new Map<string, ThemeCategoryOption>();
    optionsById.set('recommended', {
      id: 'recommended',
      name: '推荐',
      colors: recommendedSwatch,
      count: recommendedThemeList.length,
      themes: recommendedThemeList,
    });

    for (const cat of COLOR_CATEGORIES) {
      const catThemes = getThemesByCategory(cat.id).slice(0, MAX_THEMES_PER_PANEL);
      if (!catThemes.length) continue;
      const previewColors = catThemes.slice(0, 3).map((t) => t.colors[0]).filter(Boolean);
      optionsById.set(cat.id, {
        id: cat.id,
        name: CATEGORY_DISPLAY_NAMES[cat.id] || cat.name.replace(/系$/, ''),
        colors: previewColors.length === 3 ? previewColors : cat.colors.slice(0, 3),
        count: catThemes.length,
        themes: catThemes,
      });
    }

    return CATEGORY_NECKLACE_ORDER
      .map((id) => optionsById.get(id))
      .filter((item): item is ThemeCategoryOption => Boolean(item));
  }, [recommendedSwatch, recommendedThemeList]);

  const themes = useMemo(() => {
    return categoryOptions.find((item) => item.id === selectedCategory)?.themes || recommendedThemeList;
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
    return { id: 'recommended', name: '推荐', colors: recommendedSwatch, count: recommendedThemeList.length };
  }, [selectedCategory, categoryOptions, recommendedSwatch, recommendedThemeList.length]);

  const getCategoryIndexAt = (clientX: number) => {
    const spectrum = spectrumRef.current;
    if (!spectrum || categoryOptions.length === 0) return 0;
    const rect = spectrum.getBoundingClientRect();
    const innerInset = 6;
    const innerWidth = Math.max(1, rect.width - innerInset * 2);
    const relativeX = Math.max(0, Math.min(innerWidth - 1, clientX - rect.left - innerInset));
    return Math.min(categoryOptions.length - 1, Math.floor(relativeX / (innerWidth / categoryOptions.length)));
  };

  const selectCategoryAt = (clientX: number) => {
    const category = categoryOptions[getCategoryIndexAt(clientX)];
    if (category) setSelectedCategory(category.id);
  };

  const handlePointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    const index = getCategoryIndexAt(event.clientX);
    activePointerRef.current = event.pointerId;
    pointerStartIndexRef.current = index;
    suppressClickRef.current = false;
    event.currentTarget.setPointerCapture(event.pointerId);
    selectCategoryAt(event.clientX);
  };

  const handlePointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    if (activePointerRef.current !== event.pointerId) return;
    const index = getCategoryIndexAt(event.clientX);
    if (pointerStartIndexRef.current !== null && index !== pointerStartIndexRef.current) {
      suppressClickRef.current = true;
    }
    selectCategoryAt(event.clientX);
  };

  const finishPointerSelection = (event: React.PointerEvent<HTMLDivElement>) => {
    if (activePointerRef.current !== event.pointerId) return;
    selectCategoryAt(event.clientX);
    activePointerRef.current = null;
    pointerStartIndexRef.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    window.setTimeout(() => {
      suppressClickRef.current = false;
    }, 0);
  };

  const cancelPointerSelection = (event: React.PointerEvent<HTMLDivElement>) => {
    if (activePointerRef.current !== event.pointerId) return;
    activePointerRef.current = null;
    pointerStartIndexRef.current = null;
    suppressClickRef.current = false;
  };

  const handleThemeMouseDown = (event: React.MouseEvent<HTMLDivElement>) => {
    if (event.button !== 0 || !themesRailRef.current) return;
    themeDragRef.current = {
      active: true,
      startX: event.clientX,
      startScrollLeft: themesRailRef.current.scrollLeft,
      moved: false,
    };
  };

  const handleThemeMouseMove = (event: React.MouseEvent<HTMLDivElement>) => {
    const rail = themesRailRef.current;
    const drag = themeDragRef.current;
    if (!rail || !drag.active) return;
    const deltaX = event.clientX - drag.startX;
    if (Math.abs(deltaX) > 4) {
      drag.moved = true;
      event.preventDefault();
    }
    rail.scrollLeft = drag.startScrollLeft - deltaX;
  };

  const finishThemeDrag = () => {
    const moved = themeDragRef.current.moved;
    themeDragRef.current.active = false;
    window.setTimeout(() => {
      themeDragRef.current.moved = false;
    }, moved ? 0 : 0);
  };

  const suppressThemeClickAfterDrag = (event: React.MouseEvent<HTMLDivElement>) => {
    if (!themeDragRef.current.moved) return;
    event.preventDefault();
    event.stopPropagation();
  };

  return (
    <div>
      <div className="mb-1.5 flex items-baseline gap-1.5">
        <h3 className="text-[15px] font-bold tracking-tight text-slate-800">主题色系</h3>
        <span className="text-xs font-semibold text-violet-600">· {selectedMeta.name}</span>
        <span className="text-[11px] text-slate-400">· 拖动彩条、色块·选定主题</span>
      </div>

      <div className="min-w-0 rounded-2xl border border-violet-100/75 bg-white/42 p-1.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.86)] backdrop-blur">
        <div
          ref={spectrumRef}
          className="relative -my-2 mx-auto h-8 w-[88%] max-w-[680px] touch-pan-y select-none sm:w-[76%]"
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={finishPointerSelection}
          onPointerCancel={cancelPointerSelection}
          aria-label="主题色系连续选择器，可点击或左右拖动选择"
        >
          <div className="pointer-events-none absolute inset-x-0 top-1/2 h-4 -translate-y-1/2 rounded-full border border-violet-200/65 bg-white/60 shadow-[inset_0_1px_0_rgba(255,255,255,0.96),0_2px_7px_rgba(99,102,241,0.06)]" />
          <div
            className="pointer-events-none absolute inset-x-1 top-1/2 h-1 -translate-y-1/2 rounded-full border border-white/85 shadow-[inset_0_1px_1px_rgba(255,255,255,0.45),0_1px_3px_rgba(15,23,42,0.10)]"
            style={{ background: CONTINUOUS_SPECTRUM_GRADIENT }}
          >
            <span className="absolute inset-x-1 top-[1px] h-[35%] rounded-full bg-white/20 blur-[1px]" />
          </div>

          <div className="absolute inset-x-1 top-1/2 grid h-3.5 -translate-y-1/2 grid-cols-7 gap-[3px]">
            {categoryOptions.map((cat) => {
              const active = selectedCategory === cat.id;
              return (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => {
                    if (suppressClickRef.current) return;
                    setSelectedCategory(cat.id);
                  }}
                  className={`relative mx-[8%] rounded-full border transition-[border-color,box-shadow,background,transform] duration-150 ${
                    active
                      ? 'z-10 scale-[1.04] border-white/95 shadow-[0_0_0_1.5px_rgba(109,83,235,0.72),0_2px_7px_rgba(76,61,184,0.22),inset_0_1px_1px_rgba(255,255,255,0.4)]'
                      : 'border-transparent bg-transparent'
                  }`}
                  style={active ? { background: CATEGORY_GRADIENTS[cat.id] || CATEGORY_GRADIENTS.recommended } : undefined}
                  aria-label={`${cat.name}，${cat.count}个主题`}
                  aria-pressed={active}
                  title={`${cat.name} · ${cat.count}个主题`}
                />
              );
            })}
          </div>
        </div>

        <div className="relative mt-1.5 min-w-0 animate-fade-in border-t border-violet-100/60 pt-1.5">
          <div
            ref={themesRailRef}
            className="flex min-w-0 snap-x snap-mandatory gap-2 overflow-x-auto px-1 pb-0.5 scrollbar-hide sm:grid sm:grid-cols-4 sm:gap-2.5 sm:overflow-visible sm:px-0 sm:pb-0"
            onMouseDown={handleThemeMouseDown}
            onMouseMove={handleThemeMouseMove}
            onMouseUp={finishThemeDrag}
            onMouseLeave={finishThemeDrag}
            onClickCapture={suppressThemeClickAfterDrag}
            aria-label={`当前${selectedMeta.name}色系主题，电脑端四列展示，移动端可左右滑动，共 ${themes.length} 个`}
          >
            {themes.map((theme) => getThemeCard(theme, value === theme.id, onChange))}
          </div>
        </div>
      </div>
    </div>
  );
}
