'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';

interface SlideItem {
  id: string;
  title: string;
  content?: string[];
  notes?: string;
}

interface StreamingOutlineProps {
  slides: SlideItem[];
  onComplete?: () => void;
}

export default function StreamingOutline({ slides, onComplete }: StreamingOutlineProps) {
  const [visibleSlides, setVisibleSlides] = useState(0);
  const [typingIdx, setTypingIdx] = useState(-1);
  const [typingText, setTypingText] = useState('');
  const [done, setDone] = useState(false);
  const currentSlideRef = useRef<HTMLDivElement>(null);

  // Animate slides appearing one by one
  useEffect(() => {
    if (visibleSlides >= slides.length) {
      setDone(true);
      onComplete?.();
      return;
    }

    const timer = setTimeout(() => {
      setTypingIdx(visibleSlides);
      setTypingText('');
    }, 300);
    return () => clearTimeout(timer);
  }, [visibleSlides, slides.length, onComplete]);

  // Typewriter effect for slide title
  useEffect(() => {
    if (typingIdx < 0 || typingIdx >= slides.length) return;

    const slide = slides[typingIdx];
    const fullTitle = slide.title;
    let charIdx = 0;

    const interval = setInterval(() => {
      charIdx++;
      setTypingText(fullTitle.slice(0, charIdx));

      if (charIdx >= fullTitle.length) {
        clearInterval(interval);
        // Show content briefly then move to next
        setTimeout(() => {
          setTypingIdx(-1);
          setVisibleSlides(prev => prev + 1);
        }, 200);
      }
    }, 30);

    return () => clearInterval(interval);
  }, [typingIdx, slides]);

  // Auto scroll
  useEffect(() => {
    currentSlideRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, [visibleSlides, typingIdx]);

  return (
    <div className="space-y-2">
      {slides.slice(0, visibleSlides).map((slide, idx) => (
        <div
          key={slide.id}
          className="bg-white rounded-xl border border-gray-100 p-3 animate-slide-in"
          style={{ animationDelay: `${idx * 50}ms` }}
        >
          <div className="flex items-start gap-2">
            <div className="flex-shrink-0 w-6 h-6 rounded-full bg-[#F5F3FF] text-[#5B4FE9] text-[10px] font-bold flex items-center justify-center">
              {idx + 1}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-semibold text-gray-800">{slide.title}</div>
              {slide.content && slide.content.length > 0 && (
                <div className="mt-1 text-xs text-gray-500">
                  {slide.content.slice(0, 2).map((c, ci) => (
                    <div key={ci} className="truncate">• {c}</div>
                  ))}
                  {slide.content.length > 2 && <div className="text-gray-300">+{slide.content.length - 2} more</div>}
                </div>
              )}
            </div>
          </div>
        </div>
      ))}

      {/* Currently typing slide */}
      {typingIdx >= 0 && typingIdx < slides.length && (
        <div ref={currentSlideRef} className="bg-white rounded-xl border-2 border-[#EDE9FE] p-3 shadow-lg shadow-purple-100/30 animate-fade-in">
          <div className="flex items-start gap-2">
            <div className="flex-shrink-0 w-6 h-6 rounded-full bg-gradient-to-br from-[#5B4FE9] to-[#8B5CF6] text-white text-[10px] font-bold flex items-center justify-center">
              {typingIdx + 1}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-semibold text-gray-800">
                {typingText}
                <span className="inline-block w-0.5 h-4 bg-[#5B4FE9] animate-pulse ml-0.5 align-middle" />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Skeleton for upcoming slides */}
      {!done && typingIdx < 0 && visibleSlides < slides.length && (
        <div className="bg-white rounded-xl border border-gray-100 p-3 animate-pulse">
          <div className="flex items-start gap-2">
            <div className="flex-shrink-0 w-6 h-6 rounded-full bg-gray-200" />
            <div className="flex-1 space-y-2">
              <div className="h-4 bg-gray-200 rounded w-2/3" />
              <div className="h-3 bg-gray-100 rounded w-1/2" />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
