'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import Navbar from '@/components/Navbar';

export default function AccountPage() {
  const { user, logout, openPayment, updateUser } = useAuth();
  const router = useRouter();
  const [nickname, setNickname] = useState('');
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (user) setNickname(user.nickname);
  }, [user]);

  const handleSaveNickname = async () => {
    if (!nickname.trim() || !user) return;
    setSaving(true);
    try {
      const res = await fetch('/api/user', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'update_profile', userId: user.id, nickname: nickname.trim() }),
      });
      const data = await res.json();
      if (data.user) {
        updateUser({ nickname: nickname.trim() });
        window.location.reload();
      }
    } catch {}
    setSaving(false);
    setEditing(false);
  };

  const handleLogout = () => {
    logout();
    router.push('/');
  };

  const PLAN_NAMES: Record<string, { label: string; emoji: string; color: string }> = {
    free: { label: '免费体验', emoji: '💚', color: 'text-gray-500' },
    basic: { label: '普通会员', emoji: '💎', color: 'text-blue-600' },
    pro: { label: '高级会员', emoji: '👑', color: 'text-amber-600' },
    vip: { label: '尊享会员', emoji: '🏆', color: 'text-purple-600' },
  };

  if (!user) {
    return (
      <div className="min-h-screen bg-[#FAFBFE]">
        <Navbar />
        <div className="flex items-center justify-center py-32">
          <div className="text-center animate-fade-in">
            <div className="w-20 h-20 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-[#5B4FE9]/10 to-[#8B5CF6]/10 flex items-center justify-center">
              <span className="text-4xl">🔒</span>
            </div>
            <h2 className="text-lg font-bold text-gray-900 mb-2">请先登录</h2>
            <p className="text-sm text-gray-400 mb-6">登录后即可查看用户中心</p>
            <Link href="/" className="inline-flex items-center gap-2 px-6 py-2.5 bg-gradient-to-r from-[#5B4FE9] to-[#8B5CF6] text-white rounded-xl text-sm font-semibold shadow-md shadow-purple-200/50 hover:shadow-lg transition-all">
              ✨ 返回首页
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const plan = PLAN_NAMES[user.plan_type] || PLAN_NAMES.free;

  return (
    <div className="min-h-screen bg-[#FAFBFE]">
      <Navbar />

      {/* Profile Hero Banner */}
      <div className="relative overflow-hidden bg-gradient-to-br from-[#5B4FE9] via-[#7C3AED] to-[#8B5CF6]">
        {/* Decorative circles */}
        <div className="absolute -top-20 -right-20 w-60 h-60 bg-white/5 rounded-full" />
        <div className="absolute -bottom-10 -left-10 w-40 h-40 bg-white/5 rounded-full" />
        
        <div className="relative max-w-2xl mx-auto px-4 py-10">
          <div className="flex items-center gap-4">
            <div className="w-18 h-18 rounded-2xl bg-white/20 backdrop-blur-sm flex items-center justify-center text-white text-3xl font-bold shadow-lg border border-white/20" style={{width:72,height:72}}>
              {user.nickname?.charAt(0) || 'U'}
            </div>
            <div className="flex-1 min-w-0">
              {editing ? (
                <div className="flex items-center gap-2">
                  <input
                    value={nickname}
                    onChange={e => setNickname(e.target.value)}
                    className="px-3 py-1.5 rounded-lg border-0 bg-white/20 text-white placeholder-white/50 focus:bg-white/30 outline-none text-sm backdrop-blur-sm"
                    maxLength={20}
                    autoFocus
                  />
                  <button onClick={handleSaveNickname} disabled={saving} className="px-3 py-1.5 bg-white text-[#5B4FE9] rounded-lg text-xs font-semibold disabled:opacity-40 transition-all">
                    {saving ? '...' : '保存'}
                  </button>
                  <button onClick={() => { setEditing(false); setNickname(user.nickname); }} className="px-3 py-1.5 text-white/70 text-xs hover:text-white transition-colors">取消</button>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <h1 className="text-xl font-bold text-white truncate">{user.nickname}</h1>
                  <button onClick={() => setEditing(true)} className="w-7 h-7 rounded-lg bg-white/10 hover:bg-white/20 flex items-center justify-center text-white/70 hover:text-white transition-all text-xs">✏️</button>
                </div>
              )}
              <p className="text-sm text-white/60 mt-0.5">{user.phone}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 -mt-4 pb-8">
        {/* Stats Cards */}
        <div className="grid grid-cols-2 gap-3 mb-4">
          <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-8 h-8 rounded-xl bg-amber-50 flex items-center justify-center text-lg">🪙</div>
              <span className="text-xs text-gray-400">积分余额</span>
            </div>
            <p className="text-3xl font-extrabold text-gray-900">{user.credits}</p>
          </div>
          <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-8 h-8 rounded-xl bg-[#F5F3FF] flex items-center justify-center text-lg">{plan.emoji}</div>
              <span className="text-xs text-gray-400">当前套餐</span>
            </div>
            <p className={`text-lg font-bold ${plan.color}`}>{plan.label}</p>
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-2 mb-4">
          <Link href="/pricing" className="flex-1 py-3 bg-gradient-to-r from-[#5B4FE9] to-[#8B5CF6] text-white rounded-xl text-sm font-semibold text-center hover:shadow-lg hover:shadow-purple-300/40 transition-all active:scale-[0.98]">
            💎 升级套餐
          </Link>
          <button className="flex-1 py-3 bg-white text-amber-600 border-2 border-amber-200 rounded-xl text-sm font-semibold hover:bg-amber-50 hover:border-amber-300 transition-all active:scale-[0.98]">
            🪙 充值积分
          </button>
        </div>

        {/* Quick Links */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm mb-4 overflow-hidden">
          {[
            { icon: '📋', label: '生成历史', desc: '查看历史PPT记录', href: '#' },
            { icon: '⭐', label: '我的收藏', desc: '收藏喜欢的模板', href: '#' },
            { icon: '🎁', label: '邀请好友', desc: '邀请得积分奖励', href: '#' },
            { icon: '💬', label: '意见反馈', desc: '帮助我们变得更好', href: '#' },
          ].map((item, i) => (
            <button key={i} onClick={() => {}} className={`w-full flex items-center gap-3 px-5 py-4 hover:bg-[#FAFBFE] transition-colors ${i > 0 ? 'border-t border-gray-50' : ''}`}>
              <span className="text-xl">{item.icon}</span>
              <div className="flex-1 text-left">
                <p className="text-sm font-medium text-gray-800">{item.label}</p>
                <p className="text-[11px] text-gray-400">{item.desc}</p>
              </div>
              <svg className="w-4 h-4 text-gray-300" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 18l6-6-6-6"/></svg>
            </button>
          ))}
        </div>

        {/* Logout */}
        <button
          onClick={handleLogout}
          className="w-full py-3 text-sm text-red-400 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all"
        >
          退出登录
        </button>
      </div>
    </div>
  );
}
