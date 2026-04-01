'use client';

import React, { useState, useCallback } from 'react';
import { Slide, Template } from '@/lib/types';

interface SlideRendererProps {
  slide: Slide;
  template: Template;
  slideIndex: number;
  totalSlides: number;
  isCurrent?: boolean;
  onClick?: () => void;
  className?: string;
}

export default function SlideRenderer({
  slide,
  template,
  slideIndex,
  totalSlides,
  isCurrent = false,
  onClick,
  className = '',
}: SlideRendererProps) {
  const c = template.colors;

  const renderTitleSlide = () => (
    <div
      className="relative w-full h-full flex flex-col items-center justify-center"
      style={{ background: `linear-gradient(135deg, ${c.primary} 0%, ${c.secondary} 100%)` }}
    >
      {/* 装饰圆 */}
      <div
        className="absolute top-8 right-8 w-32 h-32 rounded-full opacity-10"
        style={{ background: 'white' }}
      />
      <div
        className="absolute bottom-8 left-8 w-24 h-24 rounded-full opacity-10"
        style={{ background: 'white' }}
      />

      <h1
        className="text-4xl font-bold text-white text-center px-8 leading-tight"
        style={{ textShadow: '0 2px 4px rgba(0,0,0,0.2)' }}
      >
        {slide.title}
      </h1>
      {slide.subtitle && (
        <>
          <div className="w-16 h-0.5 bg-white/40 my-4" />
          <p className="text-lg text-white/80 text-center px-8">
            {slide.subtitle}
          </p>
        </>
      )}
      <div className="absolute bottom-6 text-white/50 text-sm">
        {slideIndex + 1} / {totalSlides}
      </div>
    </div>
  );

  const renderEndSlide = () => (
    <div
      className="relative w-full h-full flex flex-col items-center justify-center"
      style={{ background: `linear-gradient(135deg, ${c.primary} 0%, ${c.secondary} 100%)` }}
    >
      <h1
        className="text-5xl font-bold text-white text-center"
        style={{ textShadow: '0 2px 4px rgba(0,0,0,0.2)' }}
      >
        {slide.title}
      </h1>
      {slide.subtitle && (
        <>
          <div className="w-16 h-0.5 bg-white/40 my-4" />
          <p className="text-lg text-white/80">{slide.subtitle}</p>
        </>
      )}
      <div className="absolute bottom-6 text-white/50 text-sm">
        {slideIndex + 1} / {totalSlides}
      </div>
    </div>
  );

  const renderContentSlide = () => (
    <div
      className="relative w-full h-full"
      style={{ background: c.background, color: c.text }}
    >
      {/* 顶部色带 */}
      <div
        className="absolute top-0 left-0 right-0 h-14 flex items-center px-6"
        style={{ background: c.primary }}
      >
        <span className="text-white text-sm ml-auto">
          {slideIndex + 1} / {totalSlides}
        </span>
      </div>

      {/* 左侧色条 */}
      <div
        className="absolute top-0 left-0 w-1.5 h-full"
        style={{ background: c.secondary }}
      />

      {/* 标题 */}
      <div className="px-10 pt-16">
        <h2
          className="text-2xl font-bold mb-6 pb-2"
          style={{ color: c.primary, borderBottom: `2px solid ${c.accent}` }}
        >
          {slide.title}
        </h2>

        {/* 内容要点 */}
        <div className="space-y-4">
          {(slide.content || []).map((item, i) => (
            <div key={i} className="flex items-start gap-3">
              <div
                className="w-2 h-2 rounded-full mt-2.5 flex-shrink-0"
                style={{ background: c.secondary }}
              />
              <p className="text-base leading-relaxed" style={{ color: c.text }}>
                {item}
              </p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );

  const renderSlide = () => {
    switch (slide.type) {
      case 'title':
        return renderTitleSlide();
      case 'end':
        return renderEndSlide();
      default:
        return renderContentSlide();
    }
  };

  return (
    <div
      className={`
        relative overflow-hidden rounded-lg shadow-lg
        aspect-video cursor-pointer transition-all duration-200
        ${isCurrent ? 'ring-4 ring-blue-400 scale-[1.02]' : 'hover:scale-[1.01]'}
        ${className}
      `}
      onClick={onClick}
    >
      {renderSlide()}
    </div>
  );
}
