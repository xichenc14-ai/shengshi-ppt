'use client';

import React from 'react';

interface ThemeSelectorProps {
  value: string;
  onChange: (value: string) => void;
  tone: string;
  onToneChange: (tone: string) => void;
  imgMode: string;
  onImgModeChange: (mode: string) => void;
  pages: number;
  onPagesChange: (pages: number) => void;
}

// 主题色系配置
const THEME_COLORS = [
  { id: 'blue', emoji: '🟦', name: '蓝色系', themes: ['consultant', 'icebreaker', 'blues', 'ocean', 'sky', 'sapphire', 'navy', 'classic-blue'] },
  { id: 'gray', emoji: '⬛', name: '黑白灰', themes: ['default-light', 'ash', 'gleam', 'minimal', 'chalk', 'paper', 'concrete', 'slate'] },
  { id: 'purple', emoji: '🟪', name: '紫色系', themes: ['aurora', 'electric', 'gamma', 'nebula', 'lavender', 'violet', 'amethyst'] },
  { id: 'earth', emoji: '🟫', name: '棕米大地', themes: ['chisel', 'finesse', 'chocolate', 'sand', 'terra', 'oak', 'clay'] },
  { id: 'pink', emoji: '🩷', name: '粉色系', themes: ['ashrose', 'coral-glow', 'blush', 'rose', 'flamingo', 'peach'] },
  { id: 'warm', emoji: '🟧', name: '暖色活力', themes: ['canaveral', 'founder', 'alien', 'sunset', 'ember', 'tangerine', 'flame'] },
  { id: 'gold', emoji: '🪙', name: '金色奢华', themes: ['aurum', 'gold-leaf', 'creme', 'champagne', 'bronze', 'honey', 'ivory'] },
];

const TONES = [
  { id: 'professional', label: '专业商务', desc: '麦肯锡/BCG风格', color: '#3b82f6' },
  { id: 'casual', label: '简洁友好', desc: 'Notion/Figma风格', color: '#10b981' },
  { id: 'creative', label: '大胆创意', desc: 'Apple/特斯拉风格', color: '#f59e0b' },
  { id: 'bold', label: '高端科技', desc: '高端科技发布会', color: '#8b5cf6' },
  { id: 'traditional', label: '中国传统', desc: '故宫/国潮风格', color: '#ef4444' },
];

const IMG_MODES = [
  { id: 'none', label: '纯净无图', desc: '纯文字+图标', icon: '📝', credits: '0' },
  { id: 'theme', label: '精选套图', desc: 'Gamma内置插图', icon: '🖼️', credits: '0' },
  { id: 'web', label: '定制网图', desc: '商用免费图', icon: '🌐', credits: '0' },
  { id: 'ai', label: 'AI定制图', desc: '人工智能生成', icon: '✨', credits: '2/张' },
];

export default function ThemeSelector({ value, onChange, tone, onToneChange, imgMode, onImgModeChange, pages, onPagesChange }: ThemeSelectorProps) {
  const [showAll, setShowAll] = React.useState(false);

  return (
    <div className="space-y-6">
      {/* 主题色系 */}
      <div>
        <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3 block">
          主题色系
        </label>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          {THEME_COLORS.map((color) => (
            <button
              key={color.id}
              onClick={() => setShowAll(!showAll)}
              className="flex items-center gap-2 p-3 rounded-xl border-2 transition-all hover:border-purple-200"
              style={{
                borderColor: showAll && THEME_COLORS.some(c => c.id === value) ? '#8b5cf6' : '#e4e4e7',
                background: showAll && value === color.id ? '#f5f3ff' : 'white'
              }}
            >
              <span className="text-lg">{color.emoji}</span>
              <span className="text-xs font-medium text-gray-700">{color.name}</span>
            </button>
          ))}
        </div>
        
        {/* 展开的详细主题 */}
        {showAll && (
          <div className="mt-3 p-4 bg-gray-50 rounded-xl border border-gray-100 animate-fade-in">
            <p className="text-xs text-gray-400 mb-3">选择具体主题</p>
            <div className="flex flex-wrap gap-2">
              {THEME_COLORS.find(c => c.id === value)?.themes.map((theme) => (
                <button
                  key={theme}
                  onClick={() => { onChange(theme); setShowAll(false); }}
                  className="px-3 py-1.5 bg-white border border-gray-200 rounded-lg text-xs text-gray-600 hover:border-purple-300 hover:text-purple-600 transition-all capitalize"
                >
                  {theme.replace('-', ' ')}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* 风格选择 */}
      <div>
        <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3 block">
          演示风格
        </label>
        <div className="grid grid-cols-1 md:grid-cols-5 gap-2">
          {TONES.map((t) => (
            <button
              key={t.id}
              onClick={() => onToneChange(t.id)}
              className="p-3 rounded-xl border-2 transition-all text-left"
              style={{
                borderColor: tone === t.id ? t.color : '#e4e4e7',
                background: tone === t.id ? `${t.color}10` : 'white'
              }}
            >
              <p className="text-sm font-semibold" style={{ color: tone === t.id ? t.color : '#374151' }}>
                {t.label}
              </p>
              <p className="text-[10px] text-gray-400 mt-0.5">{t.desc}</p>
            </button>
          ))}
        </div>
      </div>

      {/* 图片模式 */}
      <div>
        <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3 block">
          配图方案
        </label>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          {IMG_MODES.map((img) => (
            <button
              key={img.id}
              onClick={() => onImgModeChange(img.id)}
              className="p-3 rounded-xl border-2 transition-all"
              style={{
                borderColor: imgMode === img.id ? '#8b5cf6' : '#e4e4e7',
                background: imgMode === img.id ? '#f5f3ff' : 'white'
              }}
            >
              <p className="text-xl mb-1">{img.icon}</p>
              <p className="text-sm font-semibold text-gray-800">{img.label}</p>
              <p className="text-[10px] text-gray-400">{img.desc}</p>
              <p className="text-[10px] font-medium mt-1" style={{ color: img.credits === '0' ? '#10b981' : '#f59e0b' }}>
                {img.credits === '0' ? '✓ 免费' : img.credits}
              </p>
            </button>
          ))}
        </div>
      </div>

      {/* 页数控制 */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
            页数控制
          </label>
          <span className="text-sm font-bold text-purple-600">{pages} 页</span>
        </div>
        <div className="px-1">
          <input
            type="range"
            min={4}
            max={30}
            value={pages}
            onChange={(e) => onPagesChange(parseInt(e.target.value))}
            className="w-full"
            style={{ '--range-progress': `${((pages - 4) / 26) * 100}%` } as any}
          />
          <div className="flex justify-between text-[10px] text-gray-400 mt-1">
            <span>4页</span>
            <span>17页</span>
            <span>30页</span>
          </div>
        </div>
      </div>
    </div>
  );
}
