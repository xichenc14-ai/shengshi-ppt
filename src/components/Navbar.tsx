'use client';

import React from 'react';
import Link from 'next/link';
import { useAuth } from '@/lib/auth-context';

interface NavbarProps {
  onLogoClick?: () => void;
}

export default function Navbar({ onLogoClick }: NavbarProps) {
  const { user, logout, openLogin } = useAuth();
  const [userMenuOpen, setUserMenuOpen] = React.useState(false);
  const [mobileNavOpen, setMobileNavOpen] = React.useState(false);

  const handleLogoClick = (e: React.MouseEvent) => {
    if (onLogoClick) {
      e.preventDefault();
      onLogoClick();
    }
  };

  return (
    <>
      <nav className="h-16 md:h-18 bg-white/80 backdrop-blur-2xl border-b border-purple-100/50 px-4 md:px-8 flex items-center justify-between sticky top-0 z-50">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-3 group" onClick={handleLogoClick}>
          <div className="relative">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-purple-600 to-purple-500 flex items-center justify-center shadow-lg shadow-purple-200/60 group-hover:shadow-purple-300/70 transition-all">
              <span className="text-white text-base font-black">P</span>
            </div>
            <div className="absolute -inset-1 bg-gradient-to-r from-purple-400 to-purple-300 rounded-xl blur opacity-20 group-hover:opacity-30 transition-opacity -z-10" />
          </div>
          <div>
            <span className="text-base font-bold text-gray-900 tracking-tight">省心PPT</span>
            <span className="hidden sm:block text-[10px] text-gray-400 -mt-0.5">AI智能演示生成</span>
          </div>
        </Link>

        {/* Desktop Nav Links */}
        <div className="hidden md:flex items-center gap-1">
          <Link href="/#features" className="px-4 py-2 text-sm text-gray-500 hover:text-purple-600 hover:bg-purple-50/50 rounded-lg transition-all">
            功能特性
          </Link>
          <Link href="/pricing" className="px-4 py-2 text-sm text-gray-500 hover:text-purple-600 hover:bg-purple-50/50 rounded-lg transition-all">
            定价方案
          </Link>
          <Link href="/account" className="px-4 py-2 text-sm text-gray-500 hover:text-purple-600 hover:bg-purple-50/50 rounded-lg transition-all">
            用户中心
          </Link>
        </div>

        {/* Right Side */}
        <div className="flex items-center gap-2 md:gap-3">
          {user ? (
            <div className="relative">
              <button
                onClick={() => setUserMenuOpen(!userMenuOpen)}
                className="flex items-center gap-2 px-3 py-1.5 md:px-4 md:py-2 rounded-xl hover:bg-purple-50/50 transition-all border border-transparent hover:border-purple-100"
              >
                <div className="w-7 h-7 md:w-8 md:h-8 rounded-full bg-gradient-to-br from-purple-600 to-purple-400 flex items-center justify-center text-white text-xs md:text-sm font-bold shadow-sm">
                  {user.nickname?.charAt(0) || 'U'}
                </div>
                <div className="hidden sm:block text-left">
                  <p className="text-sm font-medium text-gray-800 leading-tight">{user.nickname}</p>
                  <p className="text-[10px] text-amber-600">🪙 {user.credits} 积分</p>
                </div>
                <svg className={`w-3 h-3 text-gray-400 transition-transform ${userMenuOpen ? 'rotate-180' : ''}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <path d="M6 9l6 6 6-6"/>
                </svg>
              </button>

              {userMenuOpen && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setUserMenuOpen(false)} />
                  <div className="absolute right-0 top-full mt-2 w-64 bg-white rounded-2xl shadow-xl border border-gray-100/80 py-2 z-50 animate-fade-in-scale">
                    {/* User Info Header */}
                    <div className="px-4 py-3 border-b border-gray-50">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-600 to-purple-400 flex items-center justify-center text-white text-sm font-bold">
                          {user.nickname?.charAt(0) || 'U'}
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-gray-900">{user.nickname}</p>
                          <p className="text-xs text-gray-400">{user.phone}</p>
                        </div>
                      </div>
                    </div>
                    
                    {/* Credits */}
                    <div className="px-4 py-2.5 flex items-center justify-between bg-amber-50/50 mx-2 mt-2 rounded-xl">
                      <div className="flex items-center gap-2">
                        <span className="text-lg">🪙</span>
                        <div>
                          <p className="text-xs text-gray-500">可用积分</p>
                          <p className="text-sm font-bold text-amber-600">{user.credits}</p>
                        </div>
                      </div>
                      <Link href="/pricing" onClick={() => setUserMenuOpen(false)} className="text-xs text-purple-600 hover:underline font-medium">
                        充值 →
                      </Link>
                    </div>
                    
                    {/* Menu Items */}
                    <div className="mt-2">
                      <Link href="/account" onClick={() => setUserMenuOpen(false)} className="flex items-center gap-3 px-4 py-2.5 mx-2 text-sm text-gray-600 hover:bg-purple-50/50 hover:text-purple-600 rounded-xl transition-all">
                        <div className="w-8 h-8 rounded-lg bg-purple-50 flex items-center justify-center">
                          <svg className="w-4 h-4 text-purple-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                        </div>
                        用户中心
                      </Link>
                      <Link href="/pricing" onClick={() => setUserMenuOpen(false)} className="flex items-center gap-3 px-4 py-2.5 mx-2 text-sm text-gray-600 hover:bg-purple-50/50 hover:text-purple-600 rounded-xl transition-all">
                        <div className="w-8 h-8 rounded-lg bg-purple-50 flex items-center justify-center">
                          <svg className="w-4 h-4 text-purple-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/></svg>
                        </div>
                        升级套餐
                      </Link>
                      <div className="border-t border-gray-100 mt-2 pt-2">
                        <button onClick={() => { logout(); setUserMenuOpen(false); }} className="flex items-center gap-3 px-4 py-2.5 mx-2 text-sm text-red-500 hover:bg-red-50 rounded-xl transition-all">
                          <div className="w-8 h-8 rounded-lg bg-red-50 flex items-center justify-center">
                            <svg className="w-4 h-4 text-red-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16,17 21,12 16,7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
                          </div>
                          退出登录
                        </button>
                      </div>
                    </div>
                  </div>
                </>
              )}
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <button onClick={openLogin} className="px-3 py-2 text-sm font-medium text-gray-600 hover:text-purple-600 hover:bg-purple-50/50 rounded-lg transition-all">
                登录
              </button>
              <button onClick={openLogin} className="px-4 py-2 text-sm font-semibold text-white rounded-xl transition-all shadow-lg shadow-purple-200/50 hover:shadow-purple-300/60"
                style={{ background: 'linear-gradient(135deg, #7c3aed 0%, #8b5cf6 100%)' }}>
                免费体验
              </button>
            </div>
          )}

          {/* Mobile menu toggle */}
          <button 
            className="md:hidden w-9 h-9 rounded-xl flex items-center justify-center text-gray-500 hover:bg-purple-50/50 transition-colors" 
            onClick={() => setMobileNavOpen(!mobileNavOpen)}
            aria-label="菜单"
          >
            {mobileNavOpen ? (
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12"/></svg>
            ) : (
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 12h18M3 6h18M3 18h18"/></svg>
            )}
          </button>
        </div>
      </nav>

      {/* Mobile Nav Dropdown */}
      {mobileNavOpen && (
        <div className="md:hidden fixed top-16 left-0 right-0 bottom-0 bg-white/95 backdrop-blur-xl z-40 animate-fade-in">
          <div className="px-4 py-4 space-y-2">
            <Link href="/#features" onClick={() => setMobileNavOpen(false)} className="flex items-center gap-3 px-4 py-3.5 rounded-xl text-sm text-gray-700 hover:bg-purple-50/50 hover:text-purple-600 transition-colors font-medium">
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22,4 12,14.01 9,11.01"/></svg>
              功能特性
            </Link>
            <Link href="/pricing" onClick={() => setMobileNavOpen(false)} className="flex items-center gap-3 px-4 py-3.5 rounded-xl text-sm text-gray-700 hover:bg-purple-50/50 hover:text-purple-600 transition-colors font-medium">
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
              定价方案
            </Link>
            <Link href="/account" onClick={() => setMobileNavOpen(false)} className="flex items-center gap-3 px-4 py-3.5 rounded-xl text-sm text-gray-700 hover:bg-purple-50/50 hover:text-purple-600 transition-colors font-medium">
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
              用户中心
            </Link>
          </div>
        </div>
      )}
    </>
  );
}
