'use client';

import React from 'react';
import Link from 'next/link';
import Navbar from '@/components/Navbar';
import { APP_VERSION } from '@/lib/version';

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

type Tab = 'users' | 'payments' | 'usage';

function fmtDate(v?: string | null): string {
  if (!v) return '-';
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return '-';
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

export default function AdminPage() {
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState('');
  const [notice, setNotice] = React.useState('');
  const [summary, setSummary] = React.useState<any>(null);
  const [users, setUsers] = React.useState<AdminUser[]>([]);
  const [payments, setPayments] = React.useState<PaymentRow[]>([]);
  const [usage, setUsage] = React.useState<UsageRow[]>([]);
  const [tab, setTab] = React.useState<Tab>('users');
  const [query, setQuery] = React.useState('');
  const [planFilter, setPlanFilter] = React.useState<'all' | 'free' | 'shengxin' | 'advanced'>('all');

  const [selectedUser, setSelectedUser] = React.useState<AdminUser | null>(null);
  const [actionLoading, setActionLoading] = React.useState(false);
  const [creditDelta, setCreditDelta] = React.useState('100');
  const [creditReason, setCreditReason] = React.useState('');
  const [nextPlan, setNextPlan] = React.useState<'free' | 'shengxin' | 'advanced'>('shengxin');
  const [extendMonths, setExtendMonths] = React.useState('1');
  const [extendReason, setExtendReason] = React.useState('');
  const [setExpireDate, setSetExpireDate] = React.useState('');
  const [grantCredits, setGrantCredits] = React.useState('0');
  const [grantReason, setGrantReason] = React.useState('');

  const loadData = React.useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const qs = new URLSearchParams();
      if (query.trim()) qs.set('q', query.trim());
      if (planFilter !== 'all') qs.set('plan', planFilter);
      const res = await fetch(`/api/admin/overview?${qs.toString()}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || '加载失败');
      setSummary(data.summary || null);
      setUsers(Array.isArray(data.users) ? data.users : []);
      setPayments(Array.isArray(data.recentPayments) ? data.recentPayments : []);
      setUsage(Array.isArray(data.recentUsage) ? data.recentUsage : []);
      if (selectedUser) {
        const fresh = (Array.isArray(data.users) ? data.users : []).find((u: AdminUser) => u.id === selectedUser.id);
        setSelectedUser(fresh || null);
      }
    } catch (e: any) {
      setError(e?.message || '加载失败');
    } finally {
      setLoading(false);
    }
  }, [query, planFilter, selectedUser]);

  React.useEffect(() => {
    loadData();
  }, [loadData]);

  const exportCsvHref = React.useMemo(() => {
    const qs = new URLSearchParams();
    if (query.trim()) qs.set('q', query.trim());
    if (planFilter !== 'all') qs.set('plan', planFilter);
    return `/api/admin/export?${qs.toString()}`;
  }, [query, planFilter]);

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
      setNotice(successText);
      await loadData();
    } catch (e: any) {
      setError(e?.message || '操作失败');
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <div className="min-h-screen sx-shell">
      <Navbar />
      <div className="text-center py-1 text-[11px] text-gray-400">版本 {APP_VERSION}</div>

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

        <section className="grid grid-cols-2 lg:grid-cols-7 gap-3">
          {[
            ['总用户', summary?.total_users ?? 0],
            ['付费用户', summary?.paid_users ?? 0],
            ['有效会员', summary?.active_members ?? 0],
            ['累计营收(元)', summary?.total_revenue_yuan ?? 0],
            ['生成次数', summary?.total_generation ?? 0],
            ['下载次数', summary?.total_download ?? 0],
            ['管理员可用积分(API池)', summary?.admin_gamma_pool_credits ?? 0],
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
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="搜昵称/手机号/用户ID"
                className="w-[210px] px-3 py-2 rounded-xl border border-indigo-200 bg-white text-sm outline-none focus:border-indigo-400"
              />
              <select
                value={planFilter}
                onChange={(e) => setPlanFilter(e.target.value as 'all' | 'free' | 'shengxin' | 'advanced')}
                className="px-3 py-2 rounded-xl border border-indigo-200 bg-white text-sm text-slate-700 outline-none focus:border-indigo-400"
              >
                <option value="all">全部套餐</option>
                <option value="free">免费用户</option>
                <option value="shengxin">省心会员</option>
                <option value="advanced">高级会员</option>
              </select>
              <button onClick={loadData} className="px-4 py-2 rounded-xl sx-primary-btn text-white text-sm font-bold">筛选</button>
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
                              setNextPlan((u.plan_type === 'advanced' ? 'advanced' : u.plan_type === 'shengxin' ? 'shengxin' : 'free'));
                              setSetExpireDate((u.plan_expires_at || '').slice(0, 10));
                              setGrantCredits('0');
                              setCreditReason('');
                              setGrantReason('');
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
                      <p className="text-sm font-bold text-slate-800">手动调账</p>
                      <input
                        value={creditDelta}
                        onChange={(e) => setCreditDelta(e.target.value)}
                        placeholder="输入积分增减，例 +200 或 -100"
                        className="mt-2 w-full px-3 py-2 rounded-lg border border-slate-200 text-sm"
                      />
                      <input
                        value={creditReason}
                        onChange={(e) => setCreditReason(e.target.value)}
                        placeholder="原因（选填）"
                        className="mt-2 w-full px-3 py-2 rounded-lg border border-slate-200 text-sm"
                      />
                      <button
                        disabled={actionLoading}
                        onClick={() => runAdminAction(
                          { action: 'adjust_credits', delta: Number(creditDelta || '0'), reason: creditReason },
                          '积分调整成功'
                        )}
                        className="mt-2 w-full py-2 rounded-lg sx-primary-btn text-white text-sm font-bold disabled:opacity-50"
                      >
                        提交调账
                      </button>
                    </div>

                    <div className="rounded-xl border border-indigo-100 p-3 bg-white">
                      <p className="text-sm font-bold text-slate-800">修改套餐</p>
                      <select
                        value={nextPlan}
                        onChange={(e) => setNextPlan(e.target.value as 'free' | 'shengxin' | 'advanced')}
                        className="mt-2 w-full px-3 py-2 rounded-lg border border-slate-200 text-sm"
                      >
                        <option value="free">免费用户</option>
                        <option value="shengxin">省心会员</option>
                        <option value="advanced">高级会员</option>
                      </select>
                      <button
                        disabled={actionLoading}
                        onClick={() => runAdminAction({ action: 'set_plan', planType: nextPlan }, '套餐修改成功')}
                        className="mt-2 w-full py-2 rounded-lg sx-primary-btn text-white text-sm font-bold disabled:opacity-50"
                      >
                        保存套餐
                      </button>
                    </div>

                    <div className="rounded-xl border border-indigo-100 p-3 bg-white">
                      <p className="text-sm font-bold text-slate-800">手动续期</p>
                      <input
                        value={extendMonths}
                        onChange={(e) => setExtendMonths(e.target.value.replace(/\D/g, '').slice(0, 2) || '1')}
                        placeholder="续期月数"
                        className="mt-2 w-full px-3 py-2 rounded-lg border border-slate-200 text-sm"
                      />
                      <input
                        value={extendReason}
                        onChange={(e) => setExtendReason(e.target.value)}
                        placeholder="续期原因（选填）"
                        className="mt-2 w-full px-3 py-2 rounded-lg border border-slate-200 text-sm"
                      />
                      <button
                        disabled={actionLoading}
                        onClick={() => runAdminAction(
                          { action: 'extend_plan', months: Number(extendMonths || '1'), reason: extendReason, planType: nextPlan },
                          '续期成功'
                        )}
                        className="mt-2 w-full py-2 rounded-lg sx-primary-btn text-white text-sm font-bold disabled:opacity-50"
                      >
                        执行续期
                      </button>
                    </div>
                  </div>

                  <div className="grid lg:grid-cols-2 gap-3 mt-3">
                    <div className="rounded-xl border border-indigo-100 p-3 bg-white">
                      <p className="text-sm font-bold text-slate-800">手动设置会员到期日期</p>
                      <p className="text-xs text-slate-500 mt-1">用于支付回调异常时人工修正</p>
                      <input
                        type="date"
                        value={setExpireDate}
                        onChange={(e) => setSetExpireDate(e.target.value)}
                        className="mt-2 w-full px-3 py-2 rounded-lg border border-slate-200 text-sm"
                      />
                      <input
                        value={grantReason}
                        onChange={(e) => setGrantReason(e.target.value)}
                        placeholder="原因（选填）"
                        className="mt-2 w-full px-3 py-2 rounded-lg border border-slate-200 text-sm"
                      />
                      <button
                        disabled={actionLoading}
                        onClick={() => runAdminAction(
                          { action: 'set_plan_date', planType: nextPlan, expireAt: setExpireDate, reason: grantReason },
                          '会员到期日期已更新'
                        )}
                        className="mt-2 w-full py-2 rounded-lg sx-primary-btn text-white text-sm font-bold disabled:opacity-50"
                      >
                        保存到期日期
                      </button>
                    </div>

                    <div className="rounded-xl border border-indigo-100 p-3 bg-white">
                      <p className="text-sm font-bold text-slate-800">手动授予会员</p>
                      <p className="text-xs text-slate-500 mt-1">可同时指定套餐、到期日期、附赠积分</p>
                      <input
                        value={grantCredits}
                        onChange={(e) => setGrantCredits(e.target.value)}
                        placeholder="附赠积分（可填0）"
                        className="mt-2 w-full px-3 py-2 rounded-lg border border-slate-200 text-sm"
                      />
                      <button
                        disabled={actionLoading}
                        onClick={() => runAdminAction(
                          {
                            action: 'grant_membership',
                            planType: nextPlan,
                            expireAt: setExpireDate,
                            grantCredits: Number(grantCredits || '0'),
                            reason: grantReason,
                          },
                          '已手动授予会员'
                        )}
                        className="mt-2 w-full py-2 rounded-lg sx-primary-btn text-white text-sm font-bold disabled:opacity-50"
                      >
                        立即授予
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}

          {tab === 'payments' && (
            <div className="overflow-x-auto mt-4">
              <table className="w-full min-w-[980px] text-sm">
                <thead>
                  <tr className="text-left text-slate-500 border-b border-indigo-100">
                    <th className="py-3 pr-3">订单号</th>
                    <th className="py-3 pr-3">用户</th>
                    <th className="py-3 pr-3">手机号</th>
                    <th className="py-3 pr-3">商品</th>
                    <th className="py-3 pr-3">类型</th>
                    <th className="py-3 pr-3">支付方式</th>
                    <th className="py-3 pr-3">金额(元)</th>
                    <th className="py-3 pr-3">支付时间</th>
                  </tr>
                </thead>
                <tbody>
                  {payments.map((p) => (
                    <tr key={p.order_no} className="border-b border-indigo-50">
                      <td className="py-3 pr-3 font-mono text-[12px] text-slate-700">{p.order_no}</td>
                      <td className="py-3 pr-3 font-semibold text-slate-800">{p.nickname}</td>
                      <td className="py-3 pr-3 text-slate-600">{p.phone || '-'}</td>
                      <td className="py-3 pr-3 text-slate-700">{p.product_name}</td>
                      <td className="py-3 pr-3 text-slate-600">{p.product_type}</td>
                      <td className="py-3 pr-3 text-slate-600">{p.pay_method || '-'}</td>
                      <td className="py-3 pr-3 text-slate-800 font-bold">{p.amount_yuan.toFixed(2)}</td>
                      <td className="py-3 pr-3">{fmtDate(p.paid_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
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
        </section>
      </div>
    </div>
  );
}
