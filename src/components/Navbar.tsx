'use client';

import React from 'react';
import Link from 'next/link';
import {
  CheckCircle2,
  ChevronDown,
  CircleDollarSign,
  Layers3,
  LogOut,
  Menu,
  RefreshCw,
  UserRound,
  X,
} from 'lucide-react';
import { useAuth, type UserInfo } from '@/lib/auth-context';
import BrandLogo from '@/components/BrandLogo';

interface NavbarProps {
  onLogoClick?: () => void;
}

function UserAvatar({ user, compact = false }: { user: UserInfo; compact?: boolean }) {
  return (
    <div className={`flex shrink-0 items-center justify-center bg-gradient-to-br from-[#477eff] via-[#7658f2] to-[#aa4bec] font-black text-white ring-1 ring-violet-200/60 ${
      compact
        ? 'h-10 w-10 rounded-[14px] text-sm shadow-[0_8px_22px_rgba(104,78,235,0.22)]'
        : 'h-11 w-11 rounded-[15px] text-sm shadow-[0_10px_28px_rgba(104,78,235,0.25)]'
    }`}>
      {user.nickname?.charAt(0) || 'U'}
    </div>
  );
}

function AccountMenu({
  user,
  displayCredits,
  onClose,
  logout,
  includeNavigation,
  onFeaturesClick,
  refreshing,
}: {
  user: UserInfo;
  displayCredits: number;
  onClose: () => void;
  logout: () => void;
  includeNavigation?: boolean;
  onFeaturesClick?: (event: React.MouseEvent<HTMLAnchorElement>) => void;
  refreshing?: boolean;
}) {
  const menuClass = 'flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-slate-600 transition hover:bg-purple-50/70 hover:text-purple-600';

  return (
    <div className="overflow-hidden rounded-[24px] border border-white/80 bg-white/92 shadow-[0_24px_70px_rgba(54,48,100,0.20)] backdrop-blur-2xl">
      <div className="flex items-center gap-3 border-b border-slate-100/80 px-4 py-4">
        <UserAvatar user={user} />
        <div className="min-w-0">
          <p className="truncate text-sm font-bold text-slate-900">{user.nickname}</p>
          <p className="truncate text-xs text-slate-400">{user.phone}</p>
        </div>
      </div>

      <div className="mx-3 mt-3 flex items-center justify-between rounded-2xl border border-amber-100/70 bg-gradient-to-r from-amber-50/80 to-violet-50/55 px-3.5 py-3">
        <div className="flex items-center gap-2.5">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/80 text-amber-600 shadow-sm">
            <CircleDollarSign size={19} strokeWidth={2} aria-hidden="true" />
          </span>
          <div>
            <p className="text-[10px] font-medium text-slate-500">{user.is_admin ? '服务额度' : '可用积分'}</p>
            <p className="text-base font-black leading-tight text-amber-600">{displayCredits}</p>
          </div>
        </div>
        <button
          type="button"
          onClick={(event) => {
            event.preventDefault();
            event.stopPropagation();
            window.dispatchEvent(new CustomEvent('sx-refresh-account'));
          }}
          className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-white/75 text-violet-600 shadow-sm transition hover:bg-violet-50"
          aria-label="刷新账户状态"
          title="刷新账户状态"
        >
          <RefreshCw size={13} className={refreshing ? 'animate-spin' : ''} />
        </button>
      </div>

      <div className="space-y-1 px-3 py-3">
        <Link href="/account" onClick={onClose} className={menuClass}>
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-purple-50 text-purple-600">
            <UserRound size={16} strokeWidth={2} aria-hidden="true" />
          </span>
          用户中心
        </Link>
        <Link href="/pricing" onClick={onClose} className={menuClass}>
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-violet-50 text-violet-600">
            <Layers3 size={16} strokeWidth={2} aria-hidden="true" />
          </span>
          升级套餐
        </Link>
        {includeNavigation && (
          <Link href="/#features" onClick={onFeaturesClick || onClose} className={menuClass}>
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600">
              <CheckCircle2 size={16} strokeWidth={2} aria-hidden="true" />
            </span>
            功能特性
          </Link>
        )}
      </div>

      <div className="border-t border-slate-100/90 px-3 py-3">
        <button
          onClick={() => { logout(); onClose(); }}
          className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-rose-500 transition hover:bg-rose-50"
        >
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-rose-50">
            <LogOut size={16} strokeWidth={2} aria-hidden="true" />
          </span>
          退出登录
        </button>
      </div>
    </div>
  );
}

export default function Navbar({ onLogoClick }: NavbarProps) {
  const { user, logout, openLogin, refreshUser } = useAuth();
  const [userMenuOpen, setUserMenuOpen] = React.useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = React.useState(false);
  const [adminServiceCredits, setAdminServiceCredits] = React.useState<number | null>(null);
  const [userRefreshing, setUserRefreshing] = React.useState(false);

  React.useEffect(() => {
    if (!user?.is_admin) {
      setAdminServiceCredits(null);
      return;
    }
    let cancelled = false;
    fetch('/api/gamma-balance', { cache: 'no-store' })
      .then((res) => res.ok ? res.json() : null)
      .then((data) => {
        if (cancelled || !data) return;
        const liveRemaining = Number(data?.liveBalance?.remaining);
        const sharedRemaining = Number(data?.sharedRemaining ?? data?.totalRemaining);
        if (Number.isFinite(liveRemaining)) setAdminServiceCredits(liveRemaining);
        else if (Number.isFinite(sharedRemaining)) setAdminServiceCredits(sharedRemaining);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [user?.is_admin]);

  const displayCredits = user?.is_admin
    ? (adminServiceCredits ?? user.credits)
    : (user?.credits ?? 0);

  const refreshAccountState = React.useCallback(async () => {
    if (!user) return;
    setUserRefreshing(true);
    try {
      await refreshUser({ force: true });
      if (user.is_admin) {
        const res = await fetch('/api/gamma-balance', { cache: 'no-store' });
        const data = res.ok ? await res.json() : null;
        const liveRemaining = Number(data?.liveBalance?.remaining);
        const sharedRemaining = Number(data?.sharedRemaining ?? data?.totalRemaining);
        if (Number.isFinite(liveRemaining)) setAdminServiceCredits(liveRemaining);
        else if (Number.isFinite(sharedRemaining)) setAdminServiceCredits(sharedRemaining);
      }
    } catch {
    } finally {
      setUserRefreshing(false);
    }
  }, [refreshUser, user]);

  React.useEffect(() => {
    const handler = () => {
      void refreshAccountState();
    };
    window.addEventListener('sx-refresh-account', handler);
    return () => window.removeEventListener('sx-refresh-account', handler);
  }, [refreshAccountState]);

  const closeMenus = () => {
    setUserMenuOpen(false);
    setMobileMenuOpen(false);
  };

  const handleLogoClick = (event: React.MouseEvent) => {
    closeMenus();
    if (onLogoClick) {
      event.preventDefault();
      onLogoClick();
    }
  };

  const handleFeaturesClick = (event: React.MouseEvent<HTMLAnchorElement>) => {
    closeMenus();
    if (window.location.pathname !== '/') return;
    const target = document.getElementById('features');
    if (!target) return;
    event.preventDefault();
    window.history.replaceState(null, '', '/#features');
    const navOffset = window.innerWidth >= 768 ? 80 : 68;
    const top = target.getBoundingClientRect().top + window.scrollY - navOffset;
    window.scrollTo({ top: Math.max(0, top), left: 0, behavior: 'smooth' });
  };

  const toggleUserMenu = () => {
    setUserMenuOpen((open) => {
      const nextOpen = !open;
      if (nextOpen) void refreshAccountState();
      return nextOpen;
    });
  };

  return (
    <>
      <nav className="sticky top-0 z-50 flex h-16 items-center justify-between border-b border-slate-200/70 bg-white/82 px-4 backdrop-blur-2xl md:h-[72px] md:px-8">
        <Link href="/" className="group" onClick={handleLogoClick} aria-label="省心PPT 首页">
          <BrandLogo compact />
        </Link>

        <div className="hidden items-center gap-1 md:flex">
          <Link href="/#features" onClick={handleFeaturesClick} className="rounded-lg px-4 py-2 text-sm text-gray-500 transition-all hover:bg-purple-50/50 hover:text-purple-600">功能特性</Link>
          <Link href="/pricing" className="rounded-lg px-4 py-2 text-sm text-gray-500 transition-all hover:bg-purple-50/50 hover:text-purple-600">定价方案</Link>
          <Link href="/account" className="rounded-lg px-4 py-2 text-sm text-gray-500 transition-all hover:bg-purple-50/50 hover:text-purple-600">用户中心</Link>
        </div>

        <div className="flex min-w-0 items-center gap-2">
          {user ? (
            <div className="relative hidden md:block">
              <button
                onClick={toggleUserMenu}
                className="flex items-center gap-2 rounded-2xl border border-transparent p-1 transition-all hover:border-purple-100 hover:bg-purple-50/50 md:px-2"
                aria-expanded={userMenuOpen}
              >
                <UserAvatar user={user} />
                <div className="text-left">
                  <p className="text-sm font-medium leading-tight text-gray-800">{user.nickname}</p>
                  <p className="flex items-center gap-1 text-[10px] text-amber-600">
                    <span>🪙 {displayCredits} {user.is_admin ? '服务额度' : '积分'}</span>
                    {userRefreshing && <RefreshCw size={10} className="animate-spin" />}
                  </p>
                </div>
                <ChevronDown size={13} strokeWidth={2.5} className={`text-gray-400 transition-transform ${userMenuOpen ? 'rotate-180' : ''}`} aria-hidden="true" />
              </button>

              {userMenuOpen && (
                <>
                  <button className="fixed inset-0 z-40 cursor-default" onClick={() => setUserMenuOpen(false)} aria-label="关闭用户菜单" />
                  <div className="absolute right-0 top-full z-50 mt-2 w-72 animate-fade-in-scale">
                    <AccountMenu user={user} displayCredits={displayCredits} logout={logout} onClose={() => setUserMenuOpen(false)} refreshing={userRefreshing} />
                  </div>
                </>
              )}
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <button onClick={openLogin} className="rounded-lg px-3 py-2 text-sm font-medium text-gray-600 transition-all hover:bg-purple-50/50 hover:text-purple-600">登录</button>
              <button
                onClick={openLogin}
                className="hidden rounded-xl px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-sky-200/50 transition-all hover:shadow-sky-300/60 sm:block"
                style={{ background: 'linear-gradient(135deg, #4f46e5 0%, #0ea5e9 100%)' }}
              >
                免费体验
              </button>
            </div>
          )}

          <button
            className="flex h-10 w-10 items-center justify-center rounded-[14px] border border-transparent text-slate-500 transition hover:border-purple-100 hover:bg-purple-50/60 md:hidden"
            onClick={() => {
              setMobileMenuOpen(open => {
                const nextOpen = !open;
                if (nextOpen && user) void refreshAccountState();
                return nextOpen;
              });
            }}
            aria-label={mobileMenuOpen ? '关闭菜单' : '打开菜单'}
            aria-expanded={mobileMenuOpen}
          >
            {mobileMenuOpen ? <X size={21} strokeWidth={2} /> : <Menu size={22} strokeWidth={2} />}
          </button>
        </div>
      </nav>

      {mobileMenuOpen && (
        <>
          <button className="fixed inset-0 top-16 z-40 bg-slate-900/5 backdrop-blur-[2px] md:hidden" onClick={() => setMobileMenuOpen(false)} aria-label="关闭菜单" />
          <div className="fixed left-4 right-4 top-[72px] z-50 md:hidden">
            {user ? (
              <AccountMenu
                user={user}
                displayCredits={displayCredits}
                logout={logout}
                onClose={() => setMobileMenuOpen(false)}
                onFeaturesClick={handleFeaturesClick}
                includeNavigation
                refreshing={userRefreshing}
              />
            ) : (
              <div className="space-y-1 rounded-[22px] border border-white/80 bg-white/94 p-3 shadow-[0_24px_70px_rgba(54,48,100,0.18)] backdrop-blur-2xl">
                <Link href="/#features" onClick={() => setMobileMenuOpen(false)} className="flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium text-slate-700 hover:bg-purple-50">功能特性</Link>
              </div>
            )}
          </div>
        </>
      )}
    </>
  );
}
