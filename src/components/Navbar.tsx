'use client';

import React from 'react';
import Link from 'next/link';
import { useAuth } from '@/lib/auth-context';

export default function Navbar() {
  const { user, logout, openLogin } = useAuth();
  const [userMenuOpen, setUserMenuOpen] = React.useState(false);
  const [mobileNavOpen, setMobileNavOpen] = React.useState(false);

  return (
    <>
      <nav className="h-16 bg-white/90 backdrop-blur-xl border-b border-gray-100/60 px-4 md:px-8 flex items-center justify-between sticky top-0 z-50">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2.5 group">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-[#5B4FE9] to-[#8B5CF6] flex items-center justify-center shadow-lg shadow-purple-200/50 group-hover:shadow-purple-300/60 transition-shadow">
            <span className="text-white text-sm font-bold">P</span>
          </div>
          <span className="text-base font-bold text-gray-900 tracking-tight">省心PPT</span>
        </Link>

        {/* Desktop Nav Links */}
        <div className="hidden md:flex items-center gap-8">
          <Link href="/#features" className="text-sm text-gray-500 hover:text-[#5B4FE9] transition-colors">功能特性</Link>
          <Link href="/pricing" className="text-sm text-gray-500 hover:text-[#5B4FE9] transition-colors">定价</Link>
          <Link href="/account" className="text-sm text-gray-500 hover:text-[#5B4FE9] transition-colors">用户中心</Link>
        </div>

        {/* Right Side */}
        <div className="flex items-center gap-3">
          {user ? (
            <div className="relative">
              <button
                onClick={() => setUserMenuOpen(!userMenuOpen)}
                className="flex items-center gap-2 px-3 py-1.5 rounded-xl hover:bg-gray-50 transition-colors"
              >
                <div className="w-7 h-7 rounded-full bg-gradient-to-br from-[#5B4FE9] to-[#8B5CF6] flex items-center justify-center text-white text-xs font-bold">
                  {user.nickname?.charAt(0) || 'U'}
                </div>
                <span className="hidden sm:inline text-sm font-medium text-gray-700">{user.nickname}</span>
                <svg className={`w-3 h-3 text-gray-400 transition-transform ${userMenuOpen ? 'rotate-180' : ''}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M6 9l6 6 6-6"/>
                </svg>
              </button>

              {userMenuOpen && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setUserMenuOpen(false)} />
                  <div className="absolute right-0 top-full mt-2 w-56 bg-white rounded-xl shadow-xl border border-gray-100 py-2 z-50 animate-fade-in">
                    <div className="px-4 py-2 border-b border-gray-100">
                      <p className="text-sm font-semibold text-gray-900">{user.nickname}</p>
                      <p className="text-xs text-gray-400">{user.phone}</p>
                    </div>
                    <div className="px-4 py-2 flex items-center justify-between">
                      <span className="text-xs text-gray-500">积分余额</span>
                      <span className="text-sm font-bold text-amber-600">🪙 {user.credits}</span>
                    </div>
                    <div className="border-t border-gray-100 mt-1">
                      <Link href="/account" onClick={() => setUserMenuOpen(false)} className="flex items-center gap-2 px-4 py-2.5 text-sm text-gray-600 hover:bg-[#F5F3FF] hover:text-[#5B4FE9] transition-colors">
                        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                        用户中心
                      </Link>
                      <Link href="/pricing" onClick={() => setUserMenuOpen(false)} className="flex items-center gap-2 px-4 py-2.5 text-sm text-gray-600 hover:bg-[#F5F3FF] hover:text-[#5B4FE9] transition-colors">
                        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/></svg>
                        升级套餐
                      </Link>
                      <button onClick={() => { logout(); setUserMenuOpen(false); }} className="flex items-center gap-2 w-full text-left px-4 py-2.5 text-sm text-red-500 hover:bg-red-50 transition-colors">
                        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16,17 21,12 16,7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
                        退出登录
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <button onClick={openLogin} className="text-sm text-gray-600 hover:text-[#5B4FE9] transition-colors">
                登录
              </button>
              <button onClick={openLogin} className="px-4 py-2 text-sm font-medium text-white bg-[#5B4FE9] rounded-xl hover:bg-[#4F46E5] transition-colors shadow-sm shadow-purple-200/50">
                免费体验
              </button>
            </div>
          )}

          {/* Mobile menu toggle */}
          <button 
            className="md:hidden w-9 h-9 rounded-lg flex items-center justify-center text-gray-500 hover:bg-gray-100 transition-colors" 
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
        <div className="md:hidden fixed top-16 left-0 right-0 bg-white/95 backdrop-blur-xl border-b border-gray-100 z-40 animate-fade-in">
          <div className="px-4 py-3 space-y-1">
            <Link href="/#features" onClick={() => setMobileNavOpen(false)} className="flex items-center gap-3 px-4 py-3 rounded-xl text-sm text-gray-600 hover:bg-[#F5F3FF] hover:text-[#5B4FE9] transition-colors">
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22,4 12,14.01 9,11.01"/></svg>
              功能特性
            </Link>
            <Link href="/pricing" onClick={() => setMobileNavOpen(false)} className="flex items-center gap-3 px-4 py-3 rounded-xl text-sm text-gray-600 hover:bg-[#F5F3FF] hover:text-[#5B4FE9] transition-colors">
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
              定价
            </Link>
            <Link href="/account" onClick={() => setMobileNavOpen(false)} className="flex items-center gap-3 px-4 py-3 rounded-xl text-sm text-gray-600 hover:bg-[#F5F3FF] hover:text-[#5B4FE9] transition-colors">
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
              用户中心
            </Link>
          </div>
        </div>
      )}
    </>
  );
}
