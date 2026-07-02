'use client';

import React from 'react';
import Link from 'next/link';
import Navbar from '@/components/Navbar';
import { APP_VERSION } from '@/lib/version';
import { useAuth } from '@/lib/auth-context';

type AdminUser = {
  id: string;
  phone: string;
  nickname: string;
  credits: number;
  plan_type: string;
  total_credits_used: number;
  plan_expires_at: string | null;
  paid_amount_yuan: number;
  generation_count: number;
  download_count: number;
  last_login_at: string | null;
  created_at: string;
};

type PaymentRow = {
  order_no: string;
  nickname: string;
  phone: string;
  product_type: string;
  product_name: string;
  pay_method: string;
  amount_yuan: number;
  status?: string;
  paid_at: string;
};

type UsageRow = {
  id: string;
  user_id: string;
  amount: number;
  type: string;
  description: string;
  created_at: string;
};

type FeedbackRow = {
  id: string;
  user_id: string;
  generation_id: string | null;
  vote: 'up' | 'down';
  rating: number | null;
  comment: string | null;
  topic: string | null;
  ppt_title: string | null;
  page_count: number | null;
  image_mode: string | null;
  created_at: string;
  nickname: string;
  phone: string;
};

type Tab = 'users' | 'payments' | 'usage' | 'feedback' | 'gamma' | 'audit';
type AdminSummary = {
  total_users: number;
  paid_users: number;
  active_members: number;
  total_revenue_yuan: number;
  total_generation: number;
  total_download: number;
  admin_user_credits: number;
  feedback_total: number;
  feedback_positive: number;
  feedback_negative: number;
  feedback_avg_rating: number;
  admin_gamma_quota_groups?: Array<{
    tag: string;
    remaining: number;
    activeKeyCount: number;
    exhaustedKeyCount: number;
    totalKeyCount: number;
  }>;
};

type AdminReadiness = {
  ready: boolean;
  missing?: string[];
  checks?: Record<string, unknown>;
};

function fmtDate(v?: string | null): string {
  if (!v) return '-';
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return '-';
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

export default function AdminPage() {
  const { user, loading: authLoading, openLogin } = useAuth();
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState('');
  const [notice, setNotice] = React.useState('');
  const [summary, setSummary] = React.useState<AdminSummary | null>(null);
  const [readiness, setReadiness] = React.useState<AdminReadiness | null>(null);
  const [users, setUsers] = React.useState<AdminUser[]>([]);
  const [payments, setPayments] = React.useState<PaymentRow[]>([]);
  const [usage, setUsage] = React.useState<UsageRow[]>([]);
  const [feedback, setFeedback] = React.useState<FeedbackRow[]>([]);
  const [tab, setTab] = React.useState<Tab>('users');
  const [queryInput, setQueryInput] = React.useState('');
  const [planFilterInput, setPlanFilterInput] = React.useState<'all' | 'free' | 'plus' | 'pro'>('all');
  const [appliedQuery, setAppliedQuery] = React.useState('');
  const [appliedPlanFilter, setAppliedPlanFilter] = React.useState<'all' | 'free' | 'plus' | 'pro'>('all');

  const [selectedUser, setSelectedUser] = React.useState<AdminUser | null>(null);
  const [actionLoading, setActionLoading] = React.useState(false);
  const [creditTarget, setCreditTarget] = React.useState('0');
  const [nextPlan, setNextPlan] = React.useState<'free' | 'plus' | 'pro'>('plus');
  const [setExpireDate, setSetExpireDate] = React.useState('');
  const [adminReason, setAdminReason] = React.useState('');

  const loadData = React.useCallback(async () => {
    if (authLoading) return;
    if (!user) {
      setLoading(false);
      setError('请先登录');
      return;
    }
    if (!user?.is_admin) {
      setLoading(false);
      setError('无后台权限');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const qs = new URLSearchParams();
      if (appliedQuery.trim()) qs.set('q', appliedQuery.trim());
      if (appliedPlanFilter !== 'all') qs.set('plan', appliedPlanFilter);
      const res = await fetch(`/api/admin/overview?${qs.toString()}`);
      const data = await res.json();
      if (!res.ok) {
        if (res.status === 401) {
          setError('登录已过期，请重新登录');
          return;
        }
        throw new Error(data?.error || '加载失败');
      }
      setSummary(data.summary || null);
      setUsers(Array.isArray(data.users) ? data.users : []);
      setPayments(Array.isArray(data.recentPayments) ? data.recentPayments : []);
      setUsage(Array.isArray(data.recentUsage) ? data.recentUsage : []);
      setFeedback(Array.isArray(data.recentFeedback) ? data.recentFeedback : []);
      const nextUsers = Array.isArray(data.users) ? data.users : [];
      setSelectedUser((prev) => {
        if (!prev) return null;
        const fresh = nextUsers.find((u: AdminUser) => u.id === prev.id);
        return fresh || prev;
      });
      fetch('/api/admin/readiness', { cache: 'no-store' })
        .then((res) => res.ok ? res.json() : null)
        .then((data) => {
          if (data) setReadiness(data);
        })
        .catch(() => {});
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : '加载失败';
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [appliedQuery, appliedPlanFilter, authLoading, user]);

  React.useEffect(() => {
    loadData();
  }, [loadData]);

  const exportCsvHref = React.useMemo(() => {
    const qs = new URLSearchParams();
    if (appliedQuery.trim()) qs.set('q', appliedQuery.trim());
    if (appliedPlanFilter !== 'all') qs.set('plan', appliedPlanFilter);
    return `/api/admin/export?${qs.toString()}`;
  }, [appliedQuery, appliedPlanFilter]);

  const applyUserFilters = () => {
    const nextQuery = queryInput.trim();
    if (nextQuery === appliedQuery && planFilterInput === appliedPlanFilter) {
      void loadData();
      return;
    }
    setAppliedQuery(nextQuery);
    setAppliedPlanFilter(planFilterInput);
  };

  if (authLoading) {
    return (
      <div className="min-h-screen sx-shell">
        <Navbar />
        <div className="max-w-xl mx-auto px-4 py-24 text-center text-slate-500">正在校验登录状态...</div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen sx-shell">
        <Navbar />
        <div className="max-w-xl mx-auto px-4 py-24 text-center">
          <h1 className="text-2xl font-black text-slate-900">管理员登录</h1>
          <p className="mt-3 text-slate-500">请先登录管理员账号后访问后台。</p>
          <button
            onClick={openLogin}
            className="mt-5 px-5 py-2.5 rounded-xl sx-primary-btn text-white text-sm font-bold"
          >
            立即登录
          </button>
        </div>
      </div>
    );
  }

  if (!user.is_admin) {
    return (
      <div className="min-h-screen sx-shell">
        <Navbar />
        <div className="max-w-xl mx-auto px-4 py-24 text-center">
          <h1 className="text-2xl font-black text-slate-900">管理员登录</h1>
          <p className="mt-3 text-slate-500">该模块仅限管理员账号访问。</p>
          <button
            onClick={openLogin}
            className="mt-5 px-5 py-2.5 rounded-xl sx-primary-btn text-white text-sm font-bold"
          >
            立即登录
          </button>
        </div>
      </div>
    );
  }

  const runAdminAction = async (payload: Record<string, unknown>, successText: string) => {
    if (!selectedUser) return;
    setActionLoading(true);
    setError('');
    setNotice('');
    try {
      const res = await fetch('/api/admin/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...payload, targetUserId: selectedUser.id }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || '操作失败');
      if (data?.user) {
        setSelectedUser((prev) => (prev?.id === data.user.id ? { ...prev, ...data.user } : prev));
        setUsers((prev) => prev.map((u) => (u.id === data.user.id ? { ...u, ...data.user } : u)));
      }
      setNotice(successText);
      await loadData();
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : '操作失败';
      setError(message);
    } finally {
      setActionLoading(false);
    }
  };

  const requestRefund = async (orderNo: string) => {
    const reason = window.prompt('请输入退款原因');
    if (!reason?.trim()) return;
    setError('');
    setNotice('');
    const res = await fetch(`/api/admin/orders/${encodeURIComponent(orderNo)}/refund`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reason }),
    });
    const data = await res.json();
    if (!res.ok || data.error) {
      setError(data.error || '退款申请失败');
      return;
    }
    setNotice(data.warning || '退款申请已创建');
    await loadData();
    window.dispatchEvent(new Event('sx-admin-orders-refresh'));
  };

  return (
    <div className="min-h-screen sx-shell">
      <Navbar />

      <div className="max-w-7xl mx-auto px-4 md:px-8 py-6 md:py-10 space-y-5">
        <section className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-2xl md:text-3xl font-black text-slate-900">后台管理</h1>
          <div className="flex items-center gap-2">
            <a href={exportCsvHref} className="inline-flex items-center px-4 py-2 rounded-xl border border-indigo-200 text-indigo-700 bg-white/80 hover:bg-indigo-50 text-sm font-bold">
              导出CSV
            </a>
            <Link href="/account" className="inline-flex items-center px-4 py-2 rounded-xl border border-indigo-200 text-indigo-700 bg-white/70 hover:bg-indigo-50 text-sm font-bold">
              返回用户中心
            </Link>
          </div>
        </section>

        {(error || notice) && (
          <section className={`rounded-2xl px-4 py-3 text-sm font-semibold ${error ? 'border border-rose-200 bg-rose-50 text-rose-600' : 'border border-emerald-200 bg-emerald-50 text-emerald-700'}`}>
            {error || notice}
          </section>
        )}

        {readiness && !readiness.ready && (
          <section className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-800">
            后台上线检查未完成：{(readiness.missing || []).join('、') || '存在未完成项'}
          </section>
        )}

        <section className="grid grid-cols-2 lg:grid-cols-5 xl:grid-cols-10 gap-3">
          {[
            ['总用户', summary?.total_users ?? 0],
            ['付费用户', summary?.paid_users ?? 0],
            ['有效会员', summary?.active_members ?? 0],
            ['累计营收(元)', summary?.total_revenue_yuan ?? 0],
            ['生成次数', summary?.total_generation ?? 0],
            ['下载次数', summary?.total_download ?? 0],
            ['管理员账户积分', summary?.admin_user_credits ?? 0],
            ['反馈总数', summary?.feedback_total ?? 0],
            ['好评/差评', `${summary?.feedback_positive ?? 0}/${summary?.feedback_negative ?? 0}`],
            ['平均评分', summary?.feedback_avg_rating ?? 0],
          ].map(([label, value]) => (
            <div key={String(label)} className="sx-glass rounded-[18px] p-4">
              <p className="text-xs text-slate-500">{label}</p>
              <p className="mt-2 text-2xl font-black text-slate-900">{loading ? '...' : String(value)}</p>
            </div>
          ))}
        </section>

        <section className="sx-glass rounded-[24px] p-4 md:p-5">
          <div className="flex flex-wrap items-center gap-2">
            {[
              ['users', '用户套餐与到期'],
              ['payments', '付费记录'],
              ['usage', '生成/下载记录'],
              ['feedback', '用户反馈'],
              ['gamma', 'Gamma Key'],
              ['audit', '审计日志'],
            ].map(([k, label]) => (
              <button
                key={k}
                onClick={() => setTab(k as Tab)}
                className={`px-4 py-2 rounded-xl text-sm font-bold border transition-all ${
                  tab === k ? 'sx-primary-btn text-white border-transparent' : 'bg-white border-indigo-200 text-indigo-700'
                }`}
              >
                {label}
              </button>
            ))}
            <div className="ml-auto flex flex-wrap items-center gap-2">
              <input
                value={queryInput}
                onChange={(e) => setQueryInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') applyUserFilters();
                }}
                placeholder="搜昵称/手机号/用户ID"
                className="w-[210px] px-3 py-2 rounded-xl border border-indigo-200 bg-white text-sm outline-none focus:border-indigo-400"
              />
              <select
                value={planFilterInput}
                onChange={(e) => setPlanFilterInput(e.target.value as 'all' | 'free' | 'plus' | 'pro')}
                className="px-3 py-2 rounded-xl border border-indigo-200 bg-white text-sm text-slate-700 outline-none focus:border-indigo-400"
              >
                <option value="all">全部套餐</option>
                <option value="free">免费用户</option>
                <option value="plus">省心会员</option>
                <option value="pro">尊享会员</option>
              </select>
              <button onClick={applyUserFilters} className="px-4 py-2 rounded-xl sx-primary-btn text-white text-sm font-bold">筛选</button>
            </div>
          </div>

          {tab === 'users' && (
            <>
              <div className="overflow-x-auto mt-4">
                <table className="w-full min-w-[1240px] text-sm">
                  <thead>
                    <tr className="text-left text-slate-500 border-b border-indigo-100">
                      <th className="py-3 pr-3">用户</th>
                      <th className="py-3 pr-3">手机号</th>
                      <th className="py-3 pr-3">套餐</th>
                      <th className="py-3 pr-3">到期时间</th>
                      <th className="py-3 pr-3">当前积分</th>
                      <th className="py-3 pr-3">累计消耗</th>
                      <th className="py-3 pr-3">生成次数</th>
                      <th className="py-3 pr-3">下载次数</th>
                      <th className="py-3 pr-3">累计支付(元)</th>
                      <th className="py-3 pr-3">最近登录</th>
                      <th className="py-3 pr-3">操作</th>
                    </tr>
                  </thead>
                  <tbody>
                    {users.map((u) => (
                      <tr key={u.id} className="border-b border-indigo-50">
                        <td className="py-3 pr-3 font-semibold text-slate-800">{u.nickname}</td>
                        <td className="py-3 pr-3 text-slate-600">{u.phone || '-'}</td>
                        <td className="py-3 pr-3">{u.plan_type}</td>
                        <td className="py-3 pr-3">{fmtDate(u.plan_expires_at)}</td>
                        <td className="py-3 pr-3">{u.credits}</td>
                        <td className="py-3 pr-3">{u.total_credits_used}</td>
                        <td className="py-3 pr-3">{u.generation_count}</td>
                        <td className="py-3 pr-3">{u.download_count}</td>
                        <td className="py-3 pr-3">{u.paid_amount_yuan.toFixed(2)}</td>
                        <td className="py-3 pr-3">{fmtDate(u.last_login_at)}</td>
                        <td className="py-3 pr-3">
                          <button
                            onClick={() => {
                              setSelectedUser(u);
                              setNextPlan((u.plan_type === 'pro' || u.plan_type === 'advanced' ? 'pro' : u.plan_type === 'plus' || u.plan_type === 'shengxin' ? 'plus' : 'free'));
                              setSetExpireDate((u.plan_expires_at || '').slice(0, 10));
                              setCreditTarget(String(u.credits ?? 0));
                              setAdminReason('');
                            }}
                            className="px-3 py-1.5 rounded-lg border border-indigo-200 text-indigo-700 text-xs font-bold hover:bg-indigo-50"
                          >
                            管理
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {selectedUser && (
                <div className="mt-4 rounded-2xl border border-indigo-100 bg-white/80 p-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-base font-black text-slate-900">用户操作：{selectedUser.nickname}（{selectedUser.phone || selectedUser.id.slice(0, 8)}）</h3>
                    <button className="text-xs text-slate-400 hover:text-slate-600" onClick={() => setSelectedUser(null)}>关闭</button>
                  </div>

                  <div className="grid lg:grid-cols-3 gap-3 mt-3">
                    <div className="rounded-xl border border-indigo-100 p-3 bg-white">
                      <p className="text-sm font-bold text-slate-800">会员</p>
                      <select
                        value={nextPlan}
                        onChange={(e) => setNextPlan(e.target.value as 'free' | 'plus' | 'pro')}
                        className="mt-2 w-full px-3 py-2 rounded-lg border border-slate-200 text-sm"
                      >
                        <option value="free">免费用户</option>
                        <option value="plus">省心会员</option>
                        <option value="pro">尊享会员</option>
                      </select>
                      <button
                        disabled={actionLoading}
                        onClick={() => runAdminAction({ action: 'set_plan', planType: nextPlan, reason: adminReason }, '会员已更新')}
                        className="mt-2 w-full py-2 rounded-lg sx-primary-btn text-white text-sm font-bold disabled:opacity-50"
                      >
                        保存会员
                      </button>
                    </div>

                    <div className="rounded-xl border border-indigo-100 p-3 bg-white">
                      <p className="text-sm font-bold text-slate-800">积分</p>
                      <input
                        value={creditTarget}
                        onChange={(e) => setCreditTarget(e.target.value.replace(/[^\d]/g, ''))}
                        placeholder="设置为指定积分余额"
                        className="mt-2 w-full px-3 py-2 rounded-lg border border-slate-200 text-sm"
                      />
                      <p className="mt-2 text-xs text-slate-500">保存后用户积分将等于该数值，不是增加该数值</p>
                      <button
                        disabled={actionLoading}
                        onClick={() => runAdminAction(
                          { action: 'set_credits', credits: Number(creditTarget || '0'), reason: adminReason },
                          '积分已设置'
                        )}
                        className="mt-2 w-full py-2 rounded-lg sx-primary-btn text-white text-sm font-bold disabled:opacity-50"
                      >
                        保存积分
                      </button>
                    </div>

                    <div className="rounded-xl border border-indigo-100 p-3 bg-white">
                      <p className="text-sm font-bold text-slate-800">日期</p>
                      <input
                        type="date"
                        value={setExpireDate}
                        onChange={(e) => setSetExpireDate(e.target.value)}
                        className="mt-2 w-full px-3 py-2 rounded-lg border border-slate-200 text-sm"
                      />
                      <button
                        disabled={actionLoading}
                        onClick={() => runAdminAction(
                          { action: 'set_plan_date', planType: nextPlan, expireAt: setExpireDate, reason: adminReason },
                          '到期日期已更新'
                        )}
                        className="mt-2 w-full py-2 rounded-lg sx-primary-btn text-white text-sm font-bold disabled:opacity-50"
                      >
                        保存日期
                      </button>
                    </div>
                  </div>

                  <div className="mt-3 rounded-xl border border-indigo-100 p-3 bg-white">
                    <p className="text-sm font-bold text-slate-800">备注</p>
                    <input
                      value={adminReason}
                      onChange={(e) => setAdminReason(e.target.value)}
                      placeholder="原因（选填，写入审计日志）"
                      className="mt-2 w-full px-3 py-2 rounded-lg border border-slate-200 text-sm"
                    />
                  </div>
                </div>
              )}
            </>
          )}

          {tab === 'payments' && (
            <AdminOrdersPanel fallbackOrders={payments} onRefund={requestRefund} />
          )}

          {tab === 'usage' && (
            <div className="overflow-x-auto mt-4">
              <table className="w-full min-w-[980px] text-sm">
                <thead>
                  <tr className="text-left text-slate-500 border-b border-indigo-100">
                    <th className="py-3 pr-3">时间</th>
                    <th className="py-3 pr-3">用户ID</th>
                    <th className="py-3 pr-3">类型</th>
                    <th className="py-3 pr-3">积分变动</th>
                    <th className="py-3 pr-3">说明</th>
                  </tr>
                </thead>
                <tbody>
                  {usage.map((u) => (
                    <tr key={u.id} className="border-b border-indigo-50">
                      <td className="py-3 pr-3">{fmtDate(u.created_at)}</td>
                      <td className="py-3 pr-3 font-mono text-[12px] text-slate-600">{u.user_id}</td>
                      <td className="py-3 pr-3 text-slate-700">{u.type}</td>
                      <td className={`py-3 pr-3 font-bold ${u.amount < 0 ? 'text-rose-500' : 'text-emerald-600'}`}>{u.amount}</td>
                      <td className="py-3 pr-3 text-slate-600">{u.description || '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {tab === 'feedback' && (
            <div className="overflow-x-auto mt-4">
              <table className="w-full min-w-[1200px] text-sm">
                <thead>
                  <tr className="text-left text-slate-500 border-b border-indigo-100">
                    <th className="py-3 pr-3">时间</th>
                    <th className="py-3 pr-3">用户</th>
                    <th className="py-3 pr-3">手机号</th>
                    <th className="py-3 pr-3">投票</th>
                    <th className="py-3 pr-3">评分</th>
                    <th className="py-3 pr-3">主题</th>
                    <th className="py-3 pr-3">文稿</th>
                    <th className="py-3 pr-3">页数</th>
                    <th className="py-3 pr-3">图片模式</th>
                    <th className="py-3 pr-3">反馈内容</th>
                  </tr>
                </thead>
                <tbody>
                  {feedback.map((f) => (
                    <tr key={f.id} className="border-b border-indigo-50 align-top">
                      <td className="py-3 pr-3 whitespace-nowrap">{fmtDate(f.created_at)}</td>
                      <td className="py-3 pr-3 font-semibold text-slate-800">{f.nickname}</td>
                      <td className="py-3 pr-3 text-slate-600">{f.phone || '-'}</td>
                      <td className={`py-3 pr-3 font-bold ${f.vote === 'up' ? 'text-emerald-600' : 'text-rose-500'}`}>{f.vote === 'up' ? '👍 点赞' : '👎 点踩'}</td>
                      <td className="py-3 pr-3">{f.rating ? `${f.rating} / 5` : '-'}</td>
                      <td className="py-3 pr-3 text-slate-700">{f.topic || '-'}</td>
                      <td className="py-3 pr-3 text-slate-700">{f.ppt_title || '-'}</td>
                      <td className="py-3 pr-3 text-slate-700">{f.page_count ?? '-'}</td>
                      <td className="py-3 pr-3 text-slate-700">{f.image_mode || '-'}</td>
                      <td className="py-3 pr-3 text-slate-600 max-w-[420px] whitespace-pre-wrap break-words">{f.comment || '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {tab === 'gamma' && (
            <AdminGammaKeysPanel onNotice={setNotice} onError={setError} />
          )}

          {tab === 'audit' && (
            <AdminAuditPanel />
          )}
        </section>

        <div className="pt-2 text-center text-[11px] text-gray-400">版本 {APP_VERSION}</div>
      </div>
    </div>
  );
}

type GammaKeyRow = {
  id?: string;
  source: 'db' | 'env';
  label: string;
  last4: string;
  remaining: number;
  status: string;
  quotaPoolTag: string;
  countsTowardAdminQuota: boolean;
  successCount: number;
  failCount: number;
  lastUsed?: string;
};

type AdminOrderRow = PaymentRow & {
  user_id?: string;
  provider?: string;
  trade_no?: string;
  created_at?: string;
  refund?: {
    id: string;
    status: string;
    reason?: string;
    provider_refund_id?: string | null;
    completed_at?: string | null;
  } | null;
};

function AdminOrdersPanel({ fallbackOrders, onRefund }: { fallbackOrders: PaymentRow[]; onRefund: (orderNo: string) => void }) {
  const [orders, setOrders] = React.useState<AdminOrderRow[]>(fallbackOrders);
  const [loading, setLoading] = React.useState(false);
  const [qInput, setQInput] = React.useState('');
  const [statusInput, setStatusInput] = React.useState('all');
  const [appliedQ, setAppliedQ] = React.useState('');
  const [appliedStatus, setAppliedStatus] = React.useState('all');
  const [error, setError] = React.useState('');

  const load = React.useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const qs = new URLSearchParams();
      if (appliedQ.trim()) qs.set('q', appliedQ.trim());
      if (appliedStatus !== 'all') qs.set('status', appliedStatus);
      const res = await fetch(`/api/admin/orders?${qs.toString()}`, { cache: 'no-store' });
      const data = await res.json();
      if (!res.ok || data.error) throw new Error(data.error || '订单读取失败');
      setOrders(Array.isArray(data.orders) ? data.orders : []);
    } catch (e) {
      setError(e instanceof Error ? e.message : '订单读取失败');
      setOrders(fallbackOrders);
    } finally {
      setLoading(false);
    }
  }, [fallbackOrders, appliedQ, appliedStatus]);

  React.useEffect(() => {
    load();
  }, [load]);

  React.useEffect(() => {
    const onRefresh = () => void load();
    window.addEventListener('sx-admin-orders-refresh', onRefresh);
    return () => window.removeEventListener('sx-admin-orders-refresh', onRefresh);
  }, [load]);

  const applyOrderFilters = () => {
    const nextQ = qInput.trim();
    if (nextQ === appliedQ && statusInput === appliedStatus) {
      void load();
      return;
    }
    setAppliedQ(nextQ);
    setAppliedStatus(statusInput);
  };

  return (
    <div className="mt-4 space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <input
          value={qInput}
          onChange={(e) => setQInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') applyOrderFilters();
          }}
          placeholder="搜订单号/手机号/商品/流水"
          className="w-[260px] px-3 py-2 rounded-xl border border-indigo-200 bg-white text-sm outline-none focus:border-indigo-400"
        />
        <select value={statusInput} onChange={(e) => setStatusInput(e.target.value)} className="px-3 py-2 rounded-xl border border-indigo-200 bg-white text-sm">
          <option value="all">全部状态</option>
          <option value="pending">待支付</option>
          <option value="completed">已完成</option>
          <option value="paid">已支付</option>
          <option value="refund_pending">退款中</option>
          <option value="refund_failed">退款失败</option>
          <option value="refunded">已退款</option>
        </select>
        <button onClick={applyOrderFilters} className="px-4 py-2 rounded-xl sx-primary-btn text-white text-sm font-bold">筛选订单</button>
        {loading && <span className="text-xs text-slate-400">加载中...</span>}
      </div>
      {error && <div className="rounded-xl border border-rose-100 bg-rose-50 px-3 py-2 text-sm font-semibold text-rose-600">{error}</div>}
      <div className="overflow-x-auto">
        <table className="w-full min-w-[1200px] text-sm">
          <thead>
            <tr className="text-left text-slate-500 border-b border-indigo-100">
              <th className="py-3 pr-3">订单号</th>
              <th className="py-3 pr-3">用户</th>
              <th className="py-3 pr-3">手机号</th>
              <th className="py-3 pr-3">商品</th>
              <th className="py-3 pr-3">渠道</th>
              <th className="py-3 pr-3">金额(元)</th>
              <th className="py-3 pr-3">状态</th>
              <th className="py-3 pr-3">退款</th>
              <th className="py-3 pr-3">支付时间</th>
              <th className="py-3 pr-3">操作</th>
            </tr>
          </thead>
          <tbody>
            {orders.map((p) => (
              <tr key={p.order_no} className="border-b border-indigo-50 align-top">
                <td className="py-3 pr-3 font-mono text-[12px] text-slate-700">{p.order_no}</td>
                <td className="py-3 pr-3 font-semibold text-slate-800">{p.nickname}</td>
                <td className="py-3 pr-3 text-slate-600">{p.phone || '-'}</td>
                <td className="py-3 pr-3 text-slate-700">{p.product_name}</td>
                <td className="py-3 pr-3 text-slate-600">{p.provider || p.pay_method || '-'}</td>
                <td className="py-3 pr-3 text-slate-800 font-bold">{p.amount_yuan.toFixed(2)}</td>
                <td className="py-3 pr-3 text-slate-600">{p.status || '-'}</td>
                <td className="py-3 pr-3 text-slate-600">
                  {p.refund ? `${p.refund.status}${p.refund.provider_refund_id ? ` / ${p.refund.provider_refund_id}` : ''}` : '-'}
                </td>
                <td className="py-3 pr-3">{fmtDate(p.paid_at || p.created_at)}</td>
                <td className="py-3 pr-3">
                  <button
                    disabled={p.status === 'refunded' || p.status === 'refund_pending'}
                    onClick={() => onRefund(p.order_no)}
                    className="px-2 py-1 rounded-lg border border-rose-200 text-rose-600 text-xs font-bold disabled:opacity-40"
                  >
                    申请退款
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function AdminGammaKeysPanel({ onNotice, onError }: { onNotice: (v: string) => void; onError: (v: string) => void }) {
  const [loading, setLoading] = React.useState(false);
  const [keys, setKeys] = React.useState<GammaKeyRow[]>([]);
  const [groups, setGroups] = React.useState<Array<{ tag: string; remaining: number; activeKeyCount: number; exhaustedKeyCount: number; totalKeyCount: number }>>([]);
  const [total, setTotal] = React.useState(0);
  const [label, setLabel] = React.useState('');
  const [apiKey, setApiKey] = React.useState('');
  const [poolTag, setPoolTag] = React.useState('default');
  const [remaining, setRemaining] = React.useState('0');
  const hasEnvKeys = keys.some((key) => key.source === 'env');

  const load = React.useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/gamma-keys', { cache: 'no-store' });
      const data = await res.json();
      if (!res.ok || data.error) throw new Error(data.error || '读取 Gamma Key 失败');
      setKeys(Array.isArray(data.keys) ? data.keys : []);
      setGroups(Array.isArray(data.quotaGroups) ? data.quotaGroups : []);
      setTotal(Number(data.adminTotalRemaining || data.totalRemaining || 0));
    } catch (e) {
      onError(e instanceof Error ? e.message : '读取 Gamma Key 失败');
    } finally {
      setLoading(false);
    }
  }, [onError]);

  React.useEffect(() => {
    load();
  }, [load]);

  const createKey = async () => {
    onError('');
    onNotice('');
    const res = await fetch('/api/admin/gamma-keys', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ label, apiKey, quotaPoolTag: poolTag, remaining: Number(remaining || 0), reason: '后台新增 Gamma Key' }),
    });
    const data = await res.json();
    if (!res.ok || data.error) {
      onError(data.error || '新增失败');
      return;
    }
    setLabel('');
    setApiKey('');
    setRemaining('0');
    onNotice('Gamma Key 已新增');
    await load();
  };

  const importEnvKeys = async () => {
    onError('');
    onNotice('');
    setLoading(true);
    try {
      const res = await fetch('/api/admin/gamma-keys', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'import_env_keys', reason: '后台接管环境变量 Gamma Key' }),
      });
      const data = await res.json();
      if (!res.ok || data.error) {
        onError(data.error || '接管失败');
        return;
      }
      setKeys(Array.isArray(data.keys) ? data.keys : []);
      setGroups(Array.isArray(data.quotaGroups) ? data.quotaGroups : []);
      setTotal(Number(data.adminTotalRemaining || data.totalRemaining || 0));
      onNotice(`已接管 ${data.imported || 0} 个 Key${data.skipped ? `，跳过 ${data.skipped} 个已存在 Key` : ''}`);
    } catch (e) {
      onError(e instanceof Error ? e.message : '接管失败');
    } finally {
      setLoading(false);
    }
  };

  const runKeyAction = async (key: GammaKeyRow, action: string, payload: Record<string, unknown> = {}) => {
    if (!key.id) {
      onError('该 Key 尚未接管到数据库');
      return;
    }
    const res = await fetch(`/api/admin/gamma-keys/${key.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, reason: payload.reason || '后台 Gamma Key 操作', ...payload }),
    });
    const data = await res.json();
    if (!res.ok || data.error) {
      onError(data.error || '操作失败');
      return;
    }
    onNotice('Gamma Key 已更新');
    await load();
  };

  const deleteKey = async (key: GammaKeyRow) => {
    if (!key.id) {
      onError('该 Key 尚未接管到数据库');
      return;
    }
    if (!window.confirm(`确认删除 ${key.label}（****${key.last4}）？`)) return;
    const res = await fetch(`/api/admin/gamma-keys/${key.id}`, { method: 'DELETE' });
    const data = await res.json();
    if (!res.ok || data.error) {
      onError(data.error || '删除失败');
      return;
    }
    onNotice('Gamma Key 已删除');
    await load();
  };

  const editKeyMeta = async (key: GammaKeyRow) => {
    const nextTag = window.prompt('额度标记 quota_pool_tag', key.quotaPoolTag);
    if (nextTag === null) return;
    const nextRemaining = window.prompt('当前余额', String(key.remaining));
    if (nextRemaining === null) return;
    const countFlag = window.confirm('该 Key 是否计入管理员总额度？点击“确定”计入，点击“取消”不计入。');
    await runKeyAction(key, 'update_meta', {
      quotaPoolTag: nextTag,
      remaining: Number(nextRemaining || key.remaining),
      countsTowardAdminQuota: countFlag,
      reason: '后台更新 Gamma Key 额度标记/余额',
    });
  };

  return (
    <div className="mt-4 space-y-4">
      <div className="grid md:grid-cols-4 gap-3">
        <div className="rounded-xl border border-indigo-100 bg-white p-3">
          <p className="text-xs text-slate-500">管理员可用总额度</p>
          <p className="mt-1 text-2xl font-black text-slate-900">{loading ? '...' : total}</p>
        </div>
        {groups.slice(0, 3).map((g) => (
          <div key={g.tag} className="rounded-xl border border-indigo-100 bg-white p-3">
            <p className="text-xs text-slate-500">{g.tag}</p>
            <p className="mt-1 text-xl font-black text-slate-900">{g.remaining}</p>
            <p className="text-[11px] text-slate-400">active {g.activeKeyCount} / exhausted {g.exhaustedKeyCount}</p>
          </div>
        ))}
      </div>

      <div className="rounded-xl border border-indigo-100 bg-white p-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm font-black text-slate-900">新增 Gamma Key</p>
          {hasEnvKeys && (
            <button
              onClick={importEnvKeys}
              disabled={loading}
              className="px-3 py-1.5 rounded-lg border border-emerald-200 text-emerald-700 text-xs font-bold disabled:opacity-50"
            >
              接管当前 Key
            </button>
          )}
        </div>
        <div className="mt-3 grid md:grid-cols-5 gap-2">
          <input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="标签" className="px-3 py-2 rounded-lg border border-slate-200 text-sm" />
          <input value={apiKey} onChange={(e) => setApiKey(e.target.value)} placeholder="sk-gamma..." className="md:col-span-2 px-3 py-2 rounded-lg border border-slate-200 text-sm" />
          <input value={poolTag} onChange={(e) => setPoolTag(e.target.value)} placeholder="额度标记 default/pool_1" className="px-3 py-2 rounded-lg border border-slate-200 text-sm" />
          <input value={remaining} onChange={(e) => setRemaining(e.target.value.replace(/[^\d]/g, ''))} placeholder="当前余额" className="px-3 py-2 rounded-lg border border-slate-200 text-sm" />
        </div>
        <button onClick={createKey} className="mt-2 px-4 py-2 rounded-lg sx-primary-btn text-white text-sm font-bold">保存 Key</button>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[1100px] text-sm">
          <thead>
            <tr className="text-left text-slate-500 border-b border-indigo-100">
              <th className="py-3 pr-3">标签</th>
              <th className="py-3 pr-3">Key</th>
              <th className="py-3 pr-3">来源</th>
              <th className="py-3 pr-3">状态</th>
              <th className="py-3 pr-3">额度标记</th>
              <th className="py-3 pr-3">计入额度</th>
              <th className="py-3 pr-3">余额</th>
              <th className="py-3 pr-3">成功/失败</th>
              <th className="py-3 pr-3">操作</th>
            </tr>
          </thead>
          <tbody>
            {keys.map((k) => (
              <tr key={`${k.source}-${k.id || k.last4}-${k.label}`} className="border-b border-indigo-50">
                <td className="py-3 pr-3 font-semibold text-slate-800">{k.label}</td>
                <td className="py-3 pr-3 font-mono text-xs">****{k.last4}</td>
                <td className="py-3 pr-3">{k.source}</td>
                <td className="py-3 pr-3">{k.status}</td>
                <td className="py-3 pr-3">{k.quotaPoolTag}</td>
                <td className="py-3 pr-3">{k.countsTowardAdminQuota ? '是' : '否'}</td>
                <td className="py-3 pr-3 font-bold">{k.remaining}</td>
                <td className="py-3 pr-3">{k.successCount}/{k.failCount}</td>
                <td className="py-3 pr-3 flex flex-wrap gap-2">
                  {k.id ? (
                    <>
                      <button onClick={() => runKeyAction(k, 'mark_exhausted')} className="px-2 py-1 rounded-lg border border-amber-200 text-amber-700 text-xs font-bold">额度用尽</button>
                      <button onClick={() => runKeyAction(k, 'restore_quota', { remaining: k.remaining })} className="px-2 py-1 rounded-lg border border-emerald-200 text-emerald-700 text-xs font-bold">恢复额度</button>
                      <button onClick={() => runKeyAction(k, k.status === 'disabled' ? 'enable' : 'disable')} className="px-2 py-1 rounded-lg border border-slate-200 text-slate-700 text-xs font-bold">{k.status === 'disabled' ? '启用' : '停用'}</button>
                      <button onClick={() => runKeyAction(k, 'test_key')} className="px-2 py-1 rounded-lg border border-blue-200 text-blue-700 text-xs font-bold">测试</button>
                      <button onClick={() => editKeyMeta(k)} className="px-2 py-1 rounded-lg border border-indigo-200 text-indigo-700 text-xs font-bold">编辑</button>
                      <button onClick={() => deleteKey(k)} className="px-2 py-1 rounded-lg border border-rose-200 text-rose-600 text-xs font-bold">删除</button>
                    </>
                  ) : (
                    <button onClick={importEnvKeys} className="px-2 py-1 rounded-lg border border-emerald-200 text-emerald-700 text-xs font-bold">接管</button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function AdminAuditPanel() {
  const [logs, setLogs] = React.useState<Array<Record<string, any>>>([]);
  React.useEffect(() => {
    fetch('/api/admin/audit-logs?limit=150', { cache: 'no-store' })
      .then((res) => res.json())
      .then((data) => setLogs(Array.isArray(data.logs) ? data.logs : []))
      .catch(() => setLogs([]));
  }, []);
  return (
    <div className="overflow-x-auto mt-4">
      <table className="w-full min-w-[1100px] text-sm">
        <thead>
          <tr className="text-left text-slate-500 border-b border-indigo-100">
            <th className="py-3 pr-3">时间</th>
            <th className="py-3 pr-3">操作</th>
            <th className="py-3 pr-3">操作者</th>
            <th className="py-3 pr-3">目标</th>
            <th className="py-3 pr-3">原因</th>
            <th className="py-3 pr-3">IP</th>
          </tr>
        </thead>
        <tbody>
          {logs.map((log) => (
            <tr key={String(log.id)} className="border-b border-indigo-50">
              <td className="py-3 pr-3 whitespace-nowrap">{fmtDate(String(log.created_at || ''))}</td>
              <td className="py-3 pr-3 font-semibold text-slate-800">{String(log.action || '-')}</td>
              <td className="py-3 pr-3">{String(log.operator_phone || log.operator_user_id || '-')}</td>
              <td className="py-3 pr-3 font-mono text-xs">{String(log.target_type || '-')}/{String(log.target_id || '-')}</td>
              <td className="py-3 pr-3 max-w-[360px] whitespace-pre-wrap break-words">{String(log.reason || '-')}</td>
              <td className="py-3 pr-3">{String(log.ip_address || '-')}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
