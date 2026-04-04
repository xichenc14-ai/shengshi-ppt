'use client';

import React from 'react';
import Link from 'next/link';
import { useAuth } from '@/lib/auth-context';

export default function Navbar() {
  const { user, logout, openLogin } = useAuth();
  const [menuOpen, setMenuOpen] = React.useState(false);

  return (
    <nav className="h-16 bg-white/90 backdrop-blur-xl border-b border-gray-100/60 px-4 md:px-8 flex items-center justify-between sticky top-0 z-50">
      {/* Logo */}
      <Link href="/" className="flex items-center gap-2.5 group">
        <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-[#5B4FE9] to-[#8B5CF6] flex items-center justify-center shadow-lg shadow-purple-200/50 group-hover:shadow-purple-300/60 transition-shadow">
          <span className="text-white text-sm font-bold">P</span>
        </div>
        <span className="text-base font-bold text-gray-900 tracking-tight">省心PPT</span>
      </Link>

      {/* Desktop Nav Links */}
      <div className="hidden md:flex items-center gap-6">
        <Link href="/#features" className="text-sm text-gray-500 hover:text-[#5B4FE9] transition-colors">功能特性</Link>
        <Link href="/pricing" className="text-sm text-gray-500 hover:text-[#5B4FE9] transition-colors">定价</Link>
        <Link href="/account" className="text-sm text-gray-500 hover:text-[#5B4FE9] transition-colors">用户中心</Link>
      </div>

      {/* Right Side */}
      <div className="flex items-center gap-3">
        {user ? (
          <div className="relative">
            <button
              onClick={() => setMenuOpen(!menuOpen)}
              className="flex items-center gap-2 px-3 py-1.5 rounded-xl hover:bg-gray-50 transition-colors"
            >
              <div className="w-7 h-7 rounded-full bg-gradient-to-br from-[#5B4FE9] to-[#8B5CF6] flex items-center justify-center text-white text-xs font-bold">
                {user.nickname?.charAt(0) || 'U'}
              </div>
              <span className="hidden sm:inline text-sm font-medium text-gray-700">{user.nickname}</span>
              <span className="text-xs text-gray-400">▾</span>
            </button>

            {menuOpen && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setMenuOpen(false)} />
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
                    <Link href="/account" onClick={() => setMenuOpen(false)} className="block px-4 py-2 text-sm text-gray-600 hover:bg-gray-50 hover:text-[#5B4FE9] transition-colors">
                      ⚙️ 用户中心
                    </Link>
                    <Link href="/pricing" onClick={() => setMenuOpen(false)} className="block px-4 py-2 text-sm text-gray-600 hover:bg-gray-50 hover:text-[#5B4FE9] transition-colors">
                      💎 升级套餐
                    </Link>
                    <button onClick={() => { logout(); setMenuOpen(false); }} className="w-full text-left px-4 py-2 text-sm text-red-500 hover:bg-red-50 transition-colors">
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
        <button className="md:hidden text-gray-500" onClick={() => setMenuOpen(!menuOpen)}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 12h18M3 6h18M3 18h18"/></svg>
        </button>
      </div>
    </nav>
  );
}
