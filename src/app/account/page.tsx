'use client';

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import Navbar from '@/components/Navbar';
import { APP_VERSION } from '@/lib/version';

interface HistoryItem {
  id: string;
  title: string;
  page_count: number;
  created_at: string;
  download_url?: string | null;
}

interface AccountOverview {
  user?: {
    plan_expires_at?: string | null;
    total_credits_used?: number;
    credits?: number;
  };
  metrics?: {
    generation_count?: number;
    download_count?: number;
    paid_amount_yuan?: number;
  };
  admin?: {
    gamma_pool_credits?: number;
  } | null;
}

const PLAN_NAMES: Record<string, { label: string; emoji: string; badgeClass: string }> = {
  free: { label: '免费用户', emoji: '💚', badgeClass: 'bg-slate-100 text-slate-600' },
  shengxin: { label: '省心会员', emoji: '✨', badgeClass: 'bg-indigo-100 text-indigo-700' },
  advanced: { label: '高级会员', emoji: '👑', badgeClass: 'bg-violet-100 text-violet-700' },
  basic: { label: '省心会员', emoji: '✨', badgeClass: 'bg-indigo-100 text-indigo-700' },
  standard: { label: '高级会员', emoji: '👑', badgeClass: 'bg-violet-100 text-violet-700' },
  pro: { label: '高级会员', emoji: '👑', badgeClass: 'bg-violet-100 text-violet-700' },
  vip: { label: '高级会员', emoji: '👑', badgeClass: 'bg-violet-100 text-violet-700' },
  supreme: { label: '高级会员', emoji: '👑', badgeClass: 'bg-violet-100 text-violet-700' },
};

const AVATAR_CHOICES = ['✨', '📘', '🎯', '💡', '🚀', '🌟', '🧠', '🪄'];

type TabKey = 'membership' | 'profile' | 'security' | 'phone' | 'history';

function fmtDate(dateStr?: string | null) {
  if (!dateStr) return '-';
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return '-';
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

function fmtDateTime(dateStr: string) {
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return '-';
  return `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

export default function AccountPage() {
  const { user, logout, updateUser } = useAuth();
  const router = useRouter();

  const [nickname, setNickname] = useState('');
  const [avatar, setAvatar] = useState('✨');
  const [editingProfile, setEditingProfile] = useState(false);
  const [savingProfile, setSavingProfile] = useState(false);

  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [savingPassword, setSavingPassword] = useState(false);

  const [newPhone, setNewPhone] = useState('');
  const [phoneCode, setPhoneCode] = useState('');
  const [sendingCode, setSendingCode] = useState(false);
  const [savingPhone, setSavingPhone] = useState(false);
  const [countdown, setCountdown] = useState(0);

  const [historyLoading, setHistoryLoading] = useState(true);
  const [historyCount, setHistoryCount] = useState(0);
  const [recentHistory, setRecentHistory] = useState<HistoryItem[]>([]);
  const [overview, setOverview] = useState<AccountOverview | null>(null);
  const [activeTab, setActiveTab] = useState<TabKey>('membership');

  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (!user) return;
    setNickname(user.nickname || '');
    setAvatar(user.avatar || '✨');
  }, [user]);

  useEffect(() => {
    if (countdown <= 0) return;
    const timer = setTimeout(() => setCountdown((v) => v - 1), 1000);
    return () => clearTimeout(timer);
  }, [countdown]);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    (async () => {
      setHistoryLoading(true);
      try {
        const [historyRes, overviewRes] = await Promise.all([
          fetch('/api/history?limit=8'),
          fetch('/api/account/overview'),
        ]);

        const historyData = await historyRes.json();
        const overviewData = await overviewRes.json();

        if (!cancelled) {
          const list = Array.isArray(historyData?.history) ? historyData.history : [];
          setRecentHistory(list.slice(0, 4));
          setHistoryCount(typeof historyData?.count === 'number' ? historyData.count : list.length);
          if (overviewRes.ok) {
            setOverview(overviewData);
            const nextExpire = overviewData?.user?.plan_expires_at || null;
            const nextCredits = Number(overviewData?.user?.credits || user.credits || 0);
            const needSync = nextExpire !== (user.plan_expires_at || null) || nextCredits !== Number(user.credits || 0);
            if (needSync) {
              updateUser({
                plan_expires_at: nextExpire,
                credits: nextCredits,
              });
            }
          }
        }
      } catch {
        if (!cancelled) {
          setRecentHistory([]);
          setHistoryCount(0);
          setOverview(null);
        }
      } finally {
        if (!cancelled) setHistoryLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user, updateUser]);

  const plan = useMemo(() => PLAN_NAMES[user?.plan_type || 'free'] || PLAN_NAMES.free, [user?.plan_type]);
  const planExpiresAt = overview?.user?.plan_expires_at || user?.plan_expires_at || null;
  const totalCreditsUsed = overview?.user?.total_credits_used || 0;
  const generationCount = overview?.metrics?.generation_count || 0;
  const downloadCount = overview?.metrics?.download_count || 0;
  const paidAmount = overview?.metrics?.paid_amount_yuan || 0;
  const adminGammaPoolCredits = user?.is_admin ? Number(overview?.admin?.gamma_pool_credits || user.credits || 0) : null;

  const saveProfile = async () => {
    if (!user) return;
    setError('');
    setMessage('');
    const val = nickname.trim();
    if (!val || val.length < 2 || val.length > 20) {
      setError('用户名需要2-20个字符');
      return;
    }
    if (/[<>"'&]/.test(val)) {
      setError('用户名包含非法字符');
      return;
    }
    setSavingProfile(true);
    try {
      const res = await fetch('/api/user', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'update_profile', userId: user.id, nickname: val, avatar }),
      });
      const data = await res.json();
      if (!res.ok || data.error) {
        setError(data.error || '资料保存失败');
        return;
      }
      updateUser({ nickname: val, avatar });
      setEditingProfile(false);
      setMessage('资料已更新');
    } finally {
      setSavingProfile(false);
    }
  };

  const changePassword = async () => {
    if (!user) return;
    setError('');
    setMessage('');
    if (!oldPassword || !newPassword || !confirmPassword) {
      setError('请填写完整密码信息');
      return;
    }
    if (newPassword.length < 8 || !/[A-Za-z]/.test(newPassword) || !/\d/.test(newPassword)) {
      setError('新密码至少8位，且需包含字母和数字');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('两次输入的新密码不一致');
      return;
    }
    setSavingPassword(true);
    try {
      const res = await fetch('/api/user', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'change_password',
          userId: user.id,
          oldPassword,
          newPassword,
        }),
      });
      const data = await res.json();
      if (!res.ok || data.error) {
        setError(data.error || '密码修改失败');
        return;
      }
      setOldPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setMessage('密码修改成功');
    } finally {
      setSavingPassword(false);
    }
  };

  const sendPhoneCode = async () => {
    if (!user) return;
    setError('');
    setMessage('');
    if (!/^1[3-9]\d{9}$/.test(newPhone)) {
      setError('请输入正确的新手机号');
      return;
    }
    setSendingCode(true);
    try {
      const res = await fetch('/api/user', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'send_change_phone_code',
          userId: user.id,
          newPhone,
        }),
      });
      const data = await res.json();
      if (!res.ok || data.error) {
        setError(data.error || '验证码发送失败');
        return;
      }
      setCountdown(60);
      setMessage('验证码已发送到新手机号');
    } finally {
      setSendingCode(false);
    }
  };

  const changePhone = async () => {
    if (!user) return;
    setError('');
    setMessage('');
    if (!/^1[3-9]\d{9}$/.test(newPhone)) {
      setError('请输入正确的新手机号');
      return;
    }
    if (!/^\d{6}$/.test(phoneCode)) {
      setError('请输入6位验证码');
      return;
    }
    setSavingPhone(true);
    try {
      const res = await fetch('/api/user', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'change_phone',
          userId: user.id,
          newPhone,
          code: phoneCode,
        }),
      });
      const data = await res.json();
      if (!res.ok || data.error) {
        setError(data.error || '手机号修改失败');
        return;
      }
      updateUser({ phone: data.user?.phone || newPhone });
      setPhoneCode('');
      setMessage('绑定手机号已更新');
    } finally {
      setSavingPhone(false);
    }
  };

  if (!user) {
    return (
      <div className="min-h-screen sx-shell">
        <Navbar />
        <div className="max-w-xl mx-auto px-4 py-24 text-center">
          <div className="sx-glass rounded-[28px] p-10">
            <p className="text-lg font-black text-slate-900">请先登录查看用户中心</p>
            <Link href="/" className="mt-6 inline-flex items-center justify-center px-6 py-3 rounded-2xl sx-primary-btn text-white font-bold text-sm">
              返回首页
            </Link>
            <div className="pt-6 text-center text-[11px] text-gray-400">版本 {APP_VERSION}</div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen sx-shell">
      <Navbar />

      <div className="max-w-6xl mx-auto px-4 md:px-8 py-6 md:py-10 space-y-5">
        <section className="relative overflow-hidden rounded-[30px] bg-gradient-to-br from-[#5c55ff] via-[#346cff] to-[#33c8ff] p-6 md:p-8 shadow-2xl shadow-indigo-200/50">
          <div className="flex flex-col md:flex-row md:items-center gap-5 text-white">
            <div className="w-20 h-20 rounded-full bg-white/18 border border-white/38 text-white text-3xl font-black flex items-center justify-center backdrop-blur-md">
              {avatar || user.nickname?.charAt(0) || 'U'}
            </div>
            <div className="flex-1 min-w-0">
              <h1 className="text-2xl md:text-3xl font-black truncate">{user.nickname || '用户'}</h1>
              <p className="text-sm text-white/80 mt-1">{user.phone}</p>
            </div>
            <div className="flex flex-col items-start md:items-end gap-2">
              <span className={`inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-xs font-bold ${plan.badgeClass}`}>
                {plan.emoji} {plan.label}
              </span>
              <span className="text-xs text-white/80">到期：{planExpiresAt ? fmtDate(planExpiresAt) : '未设置（按回调补齐）'}</span>
            </div>
          </div>
        </section>

        {(message || error) && (
          <section className={`rounded-2xl px-4 py-3 text-sm font-semibold ${error ? 'bg-red-50 text-red-600 border border-red-200' : 'bg-emerald-50 text-emerald-700 border border-emerald-200'}`}>
            {error || message}
          </section>
        )}

        <section className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="sx-glass rounded-[22px] p-5">
            <p className="text-xs text-slate-500">{user.is_admin ? 'Gamma 总积分池' : '当前积分'}</p>
            <p className="text-3xl font-black text-slate-900 mt-1">{user.credits}</p>
            {user.is_admin && (
              <p className="mt-1 text-[11px] text-slate-400">管理员账户已对齐实时 Gamma 总余额</p>
            )}
          </div>
          <div className="sx-glass rounded-[22px] p-5">
            <p className="text-xs text-slate-500">生成次数</p>
            <p className="text-3xl font-black text-slate-900 mt-1">{generationCount}</p>
          </div>
          <div className="sx-glass rounded-[22px] p-5">
            <p className="text-xs text-slate-500">下载次数</p>
            <p className="text-3xl font-black text-slate-900 mt-1">{downloadCount}</p>
          </div>
          <div className="sx-glass rounded-[22px] p-5">
            <p className="text-xs text-slate-500">累计支付</p>
            <p className="text-3xl font-black text-slate-900 mt-1">¥{paidAmount.toFixed(2)}</p>
          </div>
        </section>

        {user.is_admin && adminGammaPoolCredits !== null && (
          <section className="sx-glass rounded-[22px] p-5">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-xs text-slate-500">管理员实时监控</p>
                <p className="text-lg font-black text-slate-900 mt-1">Gamma 总积分池</p>
                <p className="mt-1 text-sm text-slate-500">该数值直接对齐当前 key 池实时总余额，便于监控外部可用积分。</p>
              </div>
              <div className="text-right">
                <p className="text-4xl font-black text-slate-900">{adminGammaPoolCredits}</p>
                <p className="mt-1 text-xs text-slate-400">实时汇总</p>
              </div>
            </div>
          </section>
        )}

        <section className="grid lg:grid-cols-[240px_1fr] gap-4">
          <aside className="sx-glass rounded-[22px] p-3 h-fit">
            <div className="grid grid-cols-2 lg:grid-cols-1 gap-2">
              {[
                ['membership', '会员与账单'],
                ['profile', '编辑资料'],
                ['security', '密码安全'],
                ['phone', '手机号管理'],
                ['history', '最近生成'],
              ].map(([k, label]) => (
                <button
                  key={k}
                  onClick={() => setActiveTab(k as TabKey)}
                  className={`text-left px-3 py-2.5 rounded-xl text-sm font-bold transition-all ${
                    activeTab === k ? 'sx-primary-btn text-white' : 'bg-white border border-indigo-100 text-slate-700 hover:bg-indigo-50'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </aside>

          <div className="sx-glass rounded-[24px] p-5 md:p-6">
            {activeTab === 'membership' && (
              <div className="space-y-4">
                <h2 className="text-xl font-black text-slate-900">会员与账单</h2>
                <div className="grid md:grid-cols-2 gap-3">
                  <div className="rounded-2xl border border-indigo-100 bg-white/75 p-4">
                    <p className="text-xs text-slate-500">当前套餐</p>
                    <p className="mt-1 text-2xl font-black text-slate-900">{plan.label}</p>
                    <p className="mt-2 text-sm text-slate-500">到期时间：{planExpiresAt ? fmtDate(planExpiresAt) : '待支付回调后写入'}</p>
                  </div>
                  <div className="rounded-2xl border border-indigo-100 bg-white/75 p-4">
                    <p className="text-xs text-slate-500">积分消耗</p>
                    <p className="mt-1 text-2xl font-black text-slate-900">{totalCreditsUsed}</p>
                    <p className="mt-2 text-sm text-slate-500">历史项目：{historyLoading ? '...' : historyCount} 个</p>
                  </div>
                </div>
                <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-2">
                  <Link href="/pricing" className="text-center px-4 py-2.5 rounded-xl sx-primary-btn text-white text-sm font-bold">升级套餐</Link>
                  <Link href="/pricing#credit-topup" className="text-center px-4 py-2.5 rounded-xl bg-white border border-indigo-200 text-indigo-700 text-sm font-bold">单独充值积分</Link>
                  <Link href="/pricing#single-pay" className="text-center px-4 py-2.5 rounded-xl bg-white border border-indigo-200 text-indigo-700 text-sm font-bold">单次按页付费</Link>
                  <Link href="/history" className="text-center px-4 py-2.5 rounded-xl bg-white border border-indigo-200 text-indigo-700 text-sm font-bold">查看完整历史</Link>
                </div>
              </div>
            )}

            {activeTab === 'profile' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h2 className="text-xl font-black text-slate-900">编辑资料</h2>
                  <button
                    onClick={() => {
                      setEditingProfile((v) => !v);
                      setError('');
                      setMessage('');
                    }}
                    className="text-sm font-semibold text-indigo-600 hover:text-indigo-700"
                  >
                    {editingProfile ? '取消编辑' : '开始编辑'}
                  </button>
                </div>
                <div>
                  <p className="text-xs text-slate-500 mb-2">头像</p>
                  <div className="flex flex-wrap gap-2">
                    {AVATAR_CHOICES.map((it) => (
                      <button
                        key={it}
                        type="button"
                        onClick={() => {
                          if (editingProfile) setAvatar(it);
                        }}
                        className={`w-10 h-10 rounded-xl border text-lg transition-all ${
                          avatar === it ? 'border-indigo-500 bg-indigo-50' : 'border-slate-200 bg-white'
                        } ${editingProfile ? 'cursor-pointer' : 'cursor-not-allowed opacity-70'}`}
                      >
                        {it}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <p className="text-xs text-slate-500 mb-2">用户名</p>
                  <input
                    value={nickname}
                    disabled={!editingProfile}
                    onChange={(e) => setNickname(e.target.value)}
                    className="w-full px-3 py-2.5 rounded-xl border border-slate-200 bg-white text-sm outline-none focus:border-indigo-400 disabled:bg-slate-50 disabled:text-slate-400"
                    maxLength={20}
                  />
                </div>
                <button
                  onClick={saveProfile}
                  disabled={!editingProfile || savingProfile}
                  className="w-full py-2.5 rounded-xl sx-primary-btn text-white font-bold disabled:opacity-50"
                >
                  {savingProfile ? '保存中...' : '保存资料'}
                </button>
              </div>
            )}

            {activeTab === 'security' && (
              <div className="space-y-4">
                <h2 className="text-xl font-black text-slate-900">密码安全</h2>
                <input
                  type="password"
                  placeholder="当前密码"
                  value={oldPassword}
                  onChange={(e) => setOldPassword(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl border border-slate-200 bg-white text-sm outline-none focus:border-indigo-400"
                />
                <input
                  type="password"
                  placeholder="新密码（至少8位，含字母+数字）"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl border border-slate-200 bg-white text-sm outline-none focus:border-indigo-400"
                />
                <input
                  type="password"
                  placeholder="确认新密码"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl border border-slate-200 bg-white text-sm outline-none focus:border-indigo-400"
                />
                <button
                  onClick={changePassword}
                  disabled={savingPassword}
                  className="w-full py-2.5 rounded-xl sx-primary-btn text-white font-bold disabled:opacity-50"
                >
                  {savingPassword ? '提交中...' : '更新密码'}
                </button>
              </div>
            )}

            {activeTab === 'phone' && (
              <div className="space-y-4">
                <h2 className="text-xl font-black text-slate-900">手机号管理</h2>
                <p className="text-sm text-slate-500">当前绑定：{user.phone}</p>
                <div className="grid md:grid-cols-[1fr_auto] gap-3">
                  <input
                    type="tel"
                    value={newPhone}
                    onChange={(e) => setNewPhone(e.target.value.replace(/\D/g, '').slice(0, 11))}
                    placeholder="输入新手机号"
                    className="w-full px-3 py-2.5 rounded-xl border border-slate-200 bg-white text-sm outline-none focus:border-indigo-400"
                  />
                  <button
                    onClick={sendPhoneCode}
                    disabled={sendingCode || countdown > 0}
                    className="px-4 py-2.5 rounded-xl border border-indigo-200 text-indigo-700 font-semibold text-sm disabled:opacity-50"
                  >
                    {countdown > 0 ? `${countdown}s后重发` : sendingCode ? '发送中...' : '发送验证码'}
                  </button>
                </div>
                <div className="grid md:grid-cols-[1fr_auto] gap-3">
                  <input
                    value={phoneCode}
                    onChange={(e) => setPhoneCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    placeholder="输入6位验证码"
                    className="w-full px-3 py-2.5 rounded-xl border border-slate-200 bg-white text-sm outline-none focus:border-indigo-400"
                  />
                  <button
                    onClick={changePhone}
                    disabled={savingPhone}
                    className="px-4 py-2.5 rounded-xl sx-primary-btn text-white font-bold text-sm disabled:opacity-50"
                  >
                    {savingPhone ? '更新中...' : '确认更换手机号'}
                  </button>
                </div>
              </div>
            )}

            {activeTab === 'history' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h2 className="text-xl font-black text-slate-900">最近生成</h2>
                  <Link href="/history" className="text-sm font-semibold text-indigo-600 hover:text-indigo-700">查看全部</Link>
                </div>
                {historyLoading ? (
                  <p className="text-sm text-slate-400">加载中...</p>
                ) : recentHistory.length === 0 ? (
                  <p className="text-sm text-slate-400">暂无记录</p>
                ) : (
                  <div className="space-y-2">
                    {recentHistory.map((item) => (
                      <div key={item.id} className="rounded-2xl border border-indigo-100 bg-white/70 px-4 py-3 flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-slate-800 truncate">{item.title}</p>
                          <p className="text-xs text-slate-400 mt-0.5">{item.page_count} 页 · {fmtDateTime(item.created_at)}</p>
                        </div>
                        {item.download_url ? (
                          <a href={item.download_url} target="_blank" rel="noopener noreferrer" className="inline-flex px-3 py-1.5 rounded-xl bg-indigo-50 text-indigo-700 text-xs font-bold hover:bg-indigo-100 transition-colors">下载</a>
                        ) : (
                          <span className="text-xs text-slate-300">无下载链接</span>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </section>

        <section className="grid md:grid-cols-3 gap-4">
          <Link href="/pricing" className="sx-primary-btn rounded-[22px] p-5 text-white font-black text-center">升级套餐</Link>
          <Link href="/pricing#credit-topup" className="sx-glass rounded-[22px] p-5 text-slate-800 font-bold text-center border border-indigo-200">充值积分</Link>
          <button onClick={() => { logout(); router.push('/'); }} className="sx-glass rounded-[22px] p-5 text-red-500 font-bold border border-red-200/70">退出登录</button>
        </section>

        <div className="pt-2 text-center text-[11px] text-gray-400">版本 {APP_VERSION}</div>
      </div>
    </div>
  );
}
