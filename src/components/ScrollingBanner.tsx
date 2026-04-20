'use client';

import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useAuth } from '@/lib/auth-context';

/* ─── Types ──────────────────────────────────────────── */

interface BannerItem {
  text: string;
  highlight?: string;
  cta?: {
    label: string;
    action: 'login' | 'upgrade';
  };
}

interface ScrollingBannerProps {
  variant?: 'top' | 'wait';
}

/* ─── Constants ──────────────────────────────────────── */

const STORAGE_KEY = 'promo_banner_dismissed';
const DISMISS_TTL = 24 * 60 * 60 * 1000; // 24h
const ROTATE_INTERVAL = 4000;

/* ─── Helpers ────────────────────────────────────────── */

function isDismissed(): boolean {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return false;
    const { ts } = JSON.parse(raw) as { ts: number };
    return Date.now() - ts < DISMISS_TTL;
  } catch {
    return false;
  }
}

function setDismissed() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify({ ts: Date.now() }));
}

function fillTemplate(text: string, vars: Record<string, string | number>): string {
  return text.replace(/\{(\w+)\}/g, (_, k) => String(vars[k] ?? ''));
}

/* ─── Content per user segment ──────────────────────── */

const GUEST_ITEMS: BannerItem[] = [
  {
    text: '🎁 注册即送 50 积分，AI 帮你一键生成专业 PPT',
    highlight: '注册即送 50 积分',
    cta: { label: '免费领取', action: 'login' },
  },
  {
    text: '🔥 每日 3 次免费生成，30 秒出稿零门槛',
    highlight: '每日 3 次免费',
    cta: { label: '立即体验', action: 'login' },
  },
  {
    text: '✨ 50+ 精选主题 · 商务 / 学术 / 创意全覆盖',
  },
];

const FREE_ITEMS: BannerItem[] = [
  {
    text: '💎 升级尊享会员：每月 200 次生成，不限主题不限风格',
    highlight: '升级尊享会员',
    cta: { label: '立即升级', action: 'upgrade' },
  },
  {
    text: '⚡ 积分快用完了？会员无限畅用，比单次购买省 80%',
    highlight: '省 80%',
    cta: { label: '了解详情', action: 'upgrade' },
  },
  {
    text: '🎨 全新创意主题上线，解锁更多灵感 →',
  },
];

const MEMBER_ITEMS: BannerItem[] = [
  {
    text: '🎉 尊享会员 · 无限畅用，尽情释放创意',
    highlight: '无限畅用',
  },
  {
    text: '⬇️ 一键导出 PPTX，完美兼容 Office / WPS',
  },
  {
    text: '✨ AI 加持效率翻倍，省心省力出好稿',
    highlight: '效率翻倍',
  },
];

/* ─── Close Icon ─────────────────────────────────────── */

function CloseIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
      <path d="M3 3l8 8M11 3l-8 8" />
    </svg>
  );
}

/* ─── Component ──────────────────────────────────────── */

export default function ScrollingBanner({ variant = 'top' }: ScrollingBannerProps) {
  const { user, openLogin, openPayment, loading } = useAuth();
  const [currentIndex, setCurrentIndex] = useState(0);
  const [visible, setVisible] = useState(true);
  const [isPaused, setIsPaused] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [exiting, setExiting] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const isWait = variant === 'wait';

  /* ── Content set based on auth ── */
  const items: BannerItem[] = useMemo(() => {
    if (!user) return GUEST_ITEMS;
    if (user.plan_type === 'free' || user.plan_type === 'free_v2') return FREE_ITEMS;
    return MEMBER_ITEMS;
  }, [user?.id, user?.plan_type]);

  /* ── Template vars ── */
  const tplVars: Record<string, string | number> = {};
  if (user) {
    tplVars.credits = user.credits ?? 0;
  }

  const current = items[currentIndex];
  const displayText = fillTemplate(current.text, tplVars);

  /* ── Hydration guard ── */
  useEffect(() => { setMounted(true); }, []);

  /* ── Dismiss state from localStorage ── */
  useEffect(() => {
    if (isDismissed()) {
      setExiting(true);
      const t = setTimeout(() => setVisible(false), 300);
      return () => clearTimeout(t);
    }
  }, []);

  /* ── Auto-rotate ── */
  useEffect(() => {
    if (isPaused || !visible || exiting) return;
    timerRef.current = setInterval(() => {
      setCurrentIndex(prev => (prev + 1) % items.length);
    }, ROTATE_INTERVAL);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isPaused, visible, exiting, items.length]);

  /* ── Reset index when items change ── */
  useEffect(() => {
    setCurrentIndex(0);
  }, [user?.id, user?.plan_type]);

  /* ── Handlers ── */
  const handleDismiss = useCallback(() => {
    setExiting(true);
    setTimeout(() => {
      setVisible(false);
      setDismissed();
    }, 300);
  }, []);

  const handleCta = useCallback(
    (action: 'login' | 'upgrade') => {
      if (action === 'login') {
        openLogin();
      } else {
        openPayment({
          id: 'upgrade',
          name: '尊享会员',
          price: '',
          reason: '从广告条点击升级',
        });
      }
    },
    [openLogin, openPayment],
  );

  /* ── Early returns ── */
  if (!mounted || !visible || loading) return null;

  /* ── Render highlighted text ── */
  const renderText = () => {
    if (!current.highlight) return <>{displayText}</>;
    const idx = displayText.indexOf(current.highlight);
    if (idx === -1) return <>{displayText}</>;
    return (
      <>
        {displayText.slice(0, idx)}
        <span className={isWait ? 'font-bold text-purple-600' : 'font-bold text-white drop-shadow-sm'}>
          {current.highlight}
        </span>
        {displayText.slice(idx + current.highlight.length)}
      </>
    );
  };

  return (
    <div
      className={`w-full relative overflow-hidden transition-all duration-300 ease-in-out ${
        exiting ? 'max-h-0 opacity-0 -translate-y-2' : 'max-h-14 opacity-100'
      }`}
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
    >
      {/* Background */}
      {isWait ? (
        <div className="absolute inset-0 bg-white/60" />
      ) : (
        <>
          <div className="absolute inset-0 bg-gradient-to-r from-purple-700 via-violet-600 to-purple-700" />
          {/* Subtle shimmer overlay */}
          <div className="absolute inset-0 overflow-hidden">
            <div
              className="absolute inset-0 opacity-20"
              style={{
                background:
                  'linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.3) 50%, transparent 100%)',
                animation: 'banner-shimmer 3s ease-in-out infinite',
              }}
            />
          </div>
        </>
      )}

      {/* Content */}
      <div className={`relative ${isWait ? 'max-w-lg' : 'max-w-5xl'} mx-auto px-4 py-2.5 flex items-center justify-center gap-2 sm:gap-3`}>
        {/* Animated dot (top only) */}
        {!isWait && (
          <span className="relative flex h-2 w-2 flex-shrink-0">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white/50" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-white/90 shadow-sm shadow-white/50" />
          </span>
        )}

        {/* Text */}
        <p
          key={`${currentIndex}-${user?.id ?? 'guest'}`}
          className={`text-center truncate font-medium ${
            isWait ? 'text-[11px] text-gray-600' : 'text-xs sm:text-sm text-white/90'
          }`}
          style={{ animation: 'banner-fade-in 0.35s ease-out' }}
        >
          {renderText()}
        </p>

        {/* CTA Button */}
        {current.cta && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              handleCta(current.cta!.action);
            }}
            className={`flex-shrink-0 px-3 py-1 rounded-full font-semibold transition-all duration-200 hover:scale-105 active:scale-95 ${
              isWait
                ? 'text-[11px] bg-purple-100 text-purple-700 hover:bg-purple-200'
                : 'text-[11px] sm:text-xs bg-white/95 text-purple-700 hover:bg-white shadow-md shadow-purple-900/20 backdrop-blur-sm'
            }`}
          >
            {current.cta.label}
          </button>
        )}

        {/* Dismiss */}
        <button
          onClick={handleDismiss}
          className={`flex-shrink-0 ml-0.5 w-6 h-6 rounded-full flex items-center justify-center transition-colors duration-200 ${
            isWait
              ? 'text-gray-400 hover:text-gray-700 hover:bg-gray-200'
              : 'text-white/40 hover:text-white/90 hover:bg-white/15'
          }`}
          aria-label="关闭广告"
        >
          <CloseIcon />
        </button>
      </div>

      {/* Inline keyframes (no external deps) */}
      <style>{`
        @keyframes banner-fade-in {
          from { opacity: 0; transform: translateY(6px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes banner-shimmer {
          0%   { transform: translateX(-100%); }
          100% { transform: translateX(100%); }
        }
      `}</style>
    </div>
  );
}
