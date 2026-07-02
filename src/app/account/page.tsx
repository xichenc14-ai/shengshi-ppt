'use client';

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import Navbar from '@/components/Navbar';
import PaymentModal from '@/components/PaymentModal';
import { APP_VERSION } from '@/lib/version';
import {
  ArrowRight,
  ClockCounterClockwise,
  Coins,
  DownloadSimple,
  IdentificationCard,
  LockKey,
  PresentationChart,
  SignOut,
  DeviceMobile,
  Sparkle,
} from '@phosphor-icons/react';

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
    plan_type?: string | null;
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
  shengxin: { label: '省心会员', emoji: '💎', badgeClass: 'bg-indigo-100 text-indigo-700' },
  plus: { label: '省心会员', emoji: '💎', badgeClass: 'bg-indigo-100 text-indigo-700' },
  advanced: { label: '尊享会员', emoji: '👑', badgeClass: 'bg-violet-100 text-violet-700' },
  basic: { label: '省心会员', emoji: '💎', badgeClass: 'bg-indigo-100 text-indigo-700' },
  standard: { label: '尊享会员', emoji: '👑', badgeClass: 'bg-violet-100 text-violet-700' },
  pro: { label: '尊享会员', emoji: '👑', badgeClass: 'bg-violet-100 text-violet-700' },
  vip: { label: '尊享会员', emoji: '👑', badgeClass: 'bg-violet-100 text-violet-700' },
  supreme: { label: '尊享会员', emoji: '👑', badgeClass: 'bg-violet-100 text-violet-700' },
};

const PLAN_PURCHASES = {
  plus: { id: 'plus', name: '省心会员（月付）', price: '¥19.9', billing: 'monthly' },
  pro: { id: 'pro', name: '尊享会员（月付）', price: '¥49.9', billing: 'monthly' },
} as const;

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
  const [recentHistory, setRecentHistory] = useState<HistoryItem[]>([]);
  const [overview, setOverview] = useState<AccountOverview | null>(null);
  const [activeTab, setActiveTab] = useState<TabKey>('membership');
  const [paymentPlan, setPaymentPlan] = useState<{
    id: string;
    name: string;
    price: string;
    billing?: string;
    purchaseMode?: 'upgrade' | 'renew';
  } | null>(null);
  const [paymentOpen, setPaymentOpen] = useState(false);

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
          fetch('/api/history?limit=8', { cache: 'no-store' }),
          fetch('/api/account/overview', { cache: 'no-store' }),
        ]);

        const historyData = await historyRes.json();
        const overviewData = await overviewRes.json();

        if (!cancelled) {
          const list = Array.isArray(historyData?.history) ? historyData.history : [];
          setRecentHistory(list.slice(0, 4));
          if (overviewRes.ok) {
            setOverview(overviewData);
            const nextExpire = overviewData?.user?.plan_expires_at || null;
            const nextCredits = Number(overviewData?.user?.credits || user.credits || 0);
            const nextPlanType = overviewData?.user?.plan_type || user.plan_type || 'free';
            const needSync = nextExpire !== (user.plan_expires_at || null)
              || nextCredits !== Number(user.credits || 0)
              || nextPlanType !== user.plan_type;
            if (needSync) {
              updateUser({
                plan_type: nextPlanType,
                plan_expires_at: nextExpire,
                credits: nextCredits,
              });
            }
          }
        }
      } catch {
        if (!cancelled) {
          setRecentHistory([]);
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
  const normalizedPlan = useMemo(() => {
    const raw = String(overview?.user?.plan_type || user?.plan_type || 'free');
    if (['pro', 'advanced', 'standard', 'vip', 'supreme', 'enterprise'].includes(raw)) return 'pro';
    if (['plus', 'shengxin', 'basic'].includes(raw)) return 'plus';
    return 'free';
  }, [overview?.user?.plan_type, user?.plan_type]);
  const planExpiresAt = overview?.user?.plan_expires_at || user?.plan_expires_at || null;
  const totalCreditsUsed = overview?.user?.total_credits_used || 0;
  const generationCount = overview?.metrics?.generation_count || 0;
  const currentCredits = Number(overview?.user?.credits ?? user?.credits ?? 0);
  const isAdmin = Boolean(user?.is_admin || overview?.admin);

  const openPayment = (kind: 'renew' | 'upgrade') => {
    if (kind === 'upgrade') {
      router.push('/pricing');
      return;
    }
    const target = normalizedPlan !== 'free' ? normalizedPlan : 'plus';
    const base = target === 'pro' ? PLAN_PURCHASES.pro : PLAN_PURCHASES.plus;
    setPaymentPlan({
      ...base,
      purchaseMode: kind,
      name: `${kind === 'renew' ? '续费' : '升级'}${base.name.replace(/（月付）$/, '')}（月付）`,
    });
    setPaymentOpen(true);
  };

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
        const retryAfter = Number(data.retryAfter);
        if (Number.isFinite(retryAfter) && retryAfter > 0) {
          setCountdown(Math.ceil(retryAfter));
        }
        return;
      }
      const retryAfter = Number(data.retryAfter);
      setCountdown(Number.isFinite(retryAfter) && retryAfter > 0 ? Math.ceil(retryAfter) : 60);
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

      <main className="mx-auto max-w-5xl space-y-4 px-4 py-5 md:px-8 md:py-9">
        <section className="relative overflow-hidden rounded-[28px] border border-white/50 bg-gradient-to-br from-[#4F75F6] via-[#7458EE] to-[#B842E7] p-5 text-white shadow-[0_20px_55px_rgba(96,72,215,0.24)] md:p-7">
          <div className="pointer-events-none absolute -right-12 -top-16 h-44 w-44 rounded-full bg-cyan-300/30 blur-3xl" />
          <div className="pointer-events-none absolute -bottom-20 left-1/3 h-40 w-40 rounded-full bg-fuchsia-300/20 blur-3xl" />
          <div className="relative flex items-center gap-4">
            <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-[20px] border border-white/35 bg-white/16 text-2xl font-black shadow-inner backdrop-blur-md md:h-20 md:w-20 md:text-3xl">
              {avatar || user.nickname?.charAt(0) || 'U'}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[11px] font-semibold tracking-[0.18em] text-white/65">ACCOUNT CENTER</p>
              <h1 className="mt-1 truncate text-2xl font-black md:text-3xl">{user.nickname || '用户'}</h1>
              <p className="mt-1 text-sm text-white/75">{user.phone}</p>
            </div>
            <div className="shrink-0 text-right">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-white/35 bg-white/90 px-3 py-1.5 text-xs font-bold text-indigo-700 shadow-sm">
                <Sparkle size={14} weight="fill" />
                {plan.label}
              </span>
              <p className="mt-2 text-[11px] text-white/70">
                {planExpiresAt ? `${fmtDate(planExpiresAt)} 到期` : '当前有效'}
              </p>
            </div>
          </div>
        </section>

        {(message || error) && (
          <section className={`rounded-2xl border px-4 py-3 text-sm font-semibold ${error ? 'border-red-200 bg-red-50 text-red-600' : 'border-emerald-200 bg-emerald-50 text-emerald-700'}`}>
            {error || message}
          </section>
        )}

        <section className="grid grid-cols-2 gap-3 md:grid-cols-4">
          {[
            { label: isAdmin ? '管理员额度' : '可用积分', value: currentCredits, icon: Coins, color: 'from-amber-400 to-orange-500' },
            { label: '生成次数', value: generationCount, icon: PresentationChart, color: 'from-blue-500 to-indigo-500' },
            { label: '累计消耗', value: totalCreditsUsed, icon: DownloadSimple, color: 'from-cyan-500 to-blue-500' },
            { label: '会员等级', value: plan.label, icon: Sparkle, color: 'from-violet-500 to-fuchsia-500' },
          ].map(({ label, value, icon: Icon, color }) => (
            <div key={label} className="rounded-[20px] border border-white/80 bg-white/72 p-4 shadow-[0_8px_24px_rgba(88,74,174,0.08)] backdrop-blur-xl">
              <div className={`flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br ${color} text-white shadow-sm`}>
                <Icon size={17} weight="bold" />
              </div>
              <p className="mt-3 text-[11px] font-medium text-slate-400">{label}</p>
              <p className="mt-0.5 text-2xl font-black tracking-tight text-slate-900">{value}</p>
            </div>
          ))}
        </section>

        <section className="rounded-[24px] border border-white/80 bg-white/58 p-2 shadow-[0_14px_40px_rgba(88,74,174,0.09)] backdrop-blur-xl">
          <nav className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-hide">
            {[
              { key: 'membership', label: '会员权益', icon: Sparkle },
              { key: 'profile', label: '个人资料', icon: IdentificationCard },
              { key: 'security', label: '密码安全', icon: LockKey },
              { key: 'phone', label: '手机管理', icon: DeviceMobile },
              { key: 'history', label: '生成记录', icon: ClockCounterClockwise },
            ].map(({ key, label, icon: Icon }) => (
              <button
                key={key}
                onClick={() => {
                  setActiveTab(key as TabKey);
                  setError('');
                  setMessage('');
                }}
                className={`flex h-10 shrink-0 items-center gap-1.5 rounded-full px-3.5 text-xs font-bold transition-all ${
                  activeTab === key
                    ? 'sx-primary-btn text-white shadow-md shadow-indigo-200/60'
                    : 'border border-indigo-100 bg-white/80 text-slate-600 hover:bg-indigo-50'
                }`}
              >
                <Icon size={15} weight={activeTab === key ? 'fill' : 'bold'} />
                {label}
              </button>
            ))}
          </nav>

          <div className="mt-1 rounded-[20px] border border-indigo-100/70 bg-white/82 p-4 md:p-6">
            {activeTab === 'membership' && (
              <div>
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-[11px] font-semibold tracking-wide text-indigo-500">MEMBERSHIP</p>
                    <h2 className="mt-1 text-xl font-black text-slate-900">会员与积分</h2>
                  </div>
                  <span className={`rounded-full px-3 py-1.5 text-xs font-bold ${plan.badgeClass}`}>
                    {plan.emoji} {plan.label}
                  </span>
                </div>
                <div className="mt-4 grid grid-cols-2 gap-3">
                  <div className="rounded-2xl border border-indigo-100 bg-indigo-50/55 p-4">
                    <p className="text-[11px] text-slate-400">会员级别</p>
                    <p className="mt-1 text-base font-black text-slate-900">{plan.label}</p>
                  </div>
                  <div className="rounded-2xl border border-indigo-100 bg-indigo-50/55 p-4">
                    <p className="text-[11px] text-slate-400">套餐有效期</p>
                    <p className="mt-1 text-base font-black text-slate-900">{planExpiresAt ? fmtDate(planExpiresAt) : '当前有效'}</p>
                  </div>
                  <div className="rounded-2xl border border-indigo-100 bg-indigo-50/55 p-4">
                    <p className="text-[11px] text-slate-400">{isAdmin ? '管理员额度' : '可用积分'}</p>
                    <p className="mt-1 text-base font-black text-slate-900">{currentCredits}</p>
                  </div>
                  <div className="rounded-2xl border border-indigo-100 bg-indigo-50/55 p-4">
                    <p className="text-[11px] text-slate-400">累计消耗</p>
                    <p className="mt-1 text-base font-black text-slate-900">{totalCreditsUsed}</p>
                  </div>
                </div>
                {!isAdmin && <div className="mt-4 grid gap-3 md:grid-cols-2">
                  <button
                    type="button"
                    onClick={() => openPayment(normalizedPlan === 'free' ? 'upgrade' : 'renew')}
                    className="flex items-center justify-center gap-1.5 rounded-xl sx-primary-btn px-4 py-3 text-sm font-bold text-white"
                  >
                    {normalizedPlan === 'free' ? '开通会员' : '续费当前套餐'} <ArrowRight size={14} weight="bold" />
                  </button>
                  <button
                    type="button"
                    disabled={normalizedPlan === 'pro'}
                    onClick={() => openPayment('upgrade')}
                    className="flex items-center justify-center gap-1.5 rounded-xl border border-indigo-200 bg-white px-4 py-3 text-sm font-bold text-indigo-700 transition hover:bg-indigo-50 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    升级尊享会员 <ArrowRight size={14} weight="bold" />
                  </button>
                </div>}
                <Link href="/pricing" className="mt-3 inline-flex text-xs font-semibold text-indigo-600 hover:text-indigo-700">
                  查看完整套餐权益
                </Link>
              </div>
            )}

            {activeTab === 'profile' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h2 className="text-xl font-black text-slate-900">个人资料</h2>
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

        <button
          onClick={() => { logout(); router.push('/'); }}
          className="flex w-full items-center justify-center gap-2 rounded-[18px] border border-rose-200/80 bg-white/70 py-3.5 text-sm font-bold text-rose-500 backdrop-blur transition-colors hover:bg-rose-50"
        >
          <SignOut size={18} weight="bold" />
          退出登录
        </button>

        <div className="pb-3 pt-1 text-center text-[11px] text-gray-400">版本 {APP_VERSION}</div>
      </main>
      <PaymentModal
        open={paymentOpen}
        onClose={() => setPaymentOpen(false)}
        plan={paymentPlan}
      />
    </div>
  );
}
