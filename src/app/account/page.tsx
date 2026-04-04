'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';

export default function AccountPage() {
  const { user, logout, openPayment } = useAuth();
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
        // Update local state
        const updatedUser = { ...user, nickname: nickname.trim() };
        localStorage.setItem('sx_user', JSON.stringify(updatedUser));
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

  const PLAN_NAMES: Record<string, string> = {
    free: '免费体验版',
    basic: '💎 基础版',
    pro: '👑 专业版',
  };

  if (!user) {
    return (
      <div className="min-h-screen bg-[#FAFBFE] flex items-center justify-center">
        <div className="text-center">
          <div className="text-4xl mb-3">🔒</div>
          <h2 className="text-lg font-bold text-gray-900 mb-2">请先登录</h2>
          <p className="text-sm text-gray-400 mb-4">登录后即可查看用户中心</p>
          <Link href="/" className="px-6 py-2.5 bg-[#5B4FE9] text-white rounded-xl text-sm font-semibold">
            返回首页
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#FAFBFE]">
      <div className="max-w-2xl mx-auto px-4 py-8">
        {/* Header */}
        <h1 className="text-xl font-bold text-gray-900 mb-6">用户中心</h1>

        {/* Profile card */}
        <div className="bg-white rounded-2xl border border-gray-100 p-6 mb-4">
          <div className="flex items-center gap-4 mb-4">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-[#5B4FE9] to-[#8B5CF6] flex items-center justify-center text-white text-2xl font-bold shadow-lg shadow-purple-200/50">
              {user.nickname?.charAt(0) || 'U'}
            </div>
            <div className="flex-1">
              {editing ? (
                <div className="flex items-center gap-2">
                  <input
                    value={nickname}
                    onChange={e => setNickname(e.target.value)}
                    className="px-3 py-1.5 rounded-lg border border-gray-200 focus:border-[#5B4FE9] outline-none text-sm"
                    maxLength={20}
                  />
                  <button onClick={handleSaveNickname} disabled={saving} className="px-3 py-1.5 bg-[#5B4FE9] text-white rounded-lg text-xs font-medium disabled:opacity-40">
                    {saving ? '...' : '保存'}
                  </button>
                  <button onClick={() => { setEditing(false); setNickname(user.nickname); }} className="px-3 py-1.5 text-gray-400 text-xs">取消</button>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <h2 className="text-lg font-bold text-gray-900">{user.nickname}</h2>
                  <button onClick={() => setEditing(true)} className="text-gray-300 hover:text-[#5B4FE9] text-xs">✏️</button>
                </div>
              )}
              <p className="text-xs text-gray-400 mt-0.5">{user.phone}</p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="bg-[#FAFBFE] rounded-xl p-4 text-center">
              <p className="text-2xl font-extrabold text-amber-500">🪙 {user.credits}</p>
              <p className="text-[10px] text-gray-400 mt-1">积分余额</p>
            </div>
            <div className="bg-[#FAFBFE] rounded-xl p-4 text-center">
              <p className="text-lg font-bold text-gray-900">{PLAN_NAMES[user.plan_type] || '免费版'}</p>
              <p className="text-[10px] text-gray-400 mt-1">当前套餐</p>
            </div>
          </div>

          <div className="flex gap-2 mt-4">
            <Link href="/pricing" className="flex-1 py-2.5 bg-gradient-to-r from-[#5B4FE9] to-[#8B5CF6] text-white rounded-xl text-xs font-semibold text-center hover:shadow-lg hover:shadow-purple-300/40 transition-all">
              💎 升级套餐
            </Link>
            <button className="flex-1 py-2.5 bg-amber-50 text-amber-600 border border-amber-200 rounded-xl text-xs font-semibold hover:bg-amber-100 transition-colors">
              🪙 充值积分
            </button>
          </div>
        </div>

        {/* History */}
        <div className="bg-white rounded-2xl border border-gray-100 p-6 mb-4">
          <h3 className="text-sm font-bold text-gray-900 mb-4">生成历史</h3>
          <div className="text-center py-8">
            <div className="text-3xl mb-2">📋</div>
            <p className="text-xs text-gray-400">暂无生成记录</p>
            <p className="text-[10px] text-gray-300 mt-1">去首页生成你的第一份PPT吧！</p>
          </div>
        </div>

        {/* Logout */}
        <button
          onClick={handleLogout}
          className="w-full py-3 text-sm text-red-500 hover:bg-red-50 rounded-xl transition-colors"
        >
          退出登录
        </button>
      </div>
    </div>
  );
}
