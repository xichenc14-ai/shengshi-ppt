'use client';

import React from 'react';
import Link from 'next/link';
import Navbar from '@/components/Navbar';
import PaymentModal from '@/components/PaymentModal';
import LoginModal from '@/components/LoginModal';
import { useAuth } from '@/lib/auth-context';
import { APP_VERSION } from '@/lib/version';
import { isPaymentFeatureEnabledClient } from '@/lib/payment-feature';

type Plan = {
  id: 'free' | 'shengxin' | 'advanced';
  name: string;
  price: number;
  credits: number;
  maxPages: number;
  aiModels: string[];
  audience: string;
  featured?: boolean;
  features: string[];
};

type CreditPackage = {
  id: string;
  name: string;
  credits: number;
  price: number; // 分
  price_yuan?: number;
  rate_text?: string;
  price_tier?: 'member' | 'free';
};

type CompareRow = {
  label: string;
  free: { text: string; type: 'ok' | 'off' | 'strike' | 'neutral' };
  shengxin: { text: string; type: 'ok' | 'off' | 'neutral' };
  advanced: { text: string; type: 'ok' | 'off' | 'neutral' };
};

const CREDITS_PER_PAGE = 2;
const PER_PPT10_PAGES_CREDITS = 10 * CREDITS_PER_PAGE;

const PLANS: Plan[] = [
  {
    id: 'free',
    name: '免费用户',
    price: 0,
    credits: 50,
    maxPages: 8,
    aiModels: ['基础模型（自动匹配）'],
    audience: '轻量体验',
    features: ['每月 50 积分', '专业模式', '主题图 / 搜索图', 'PPTX 按页计费下载'],
  },
  {
    id: 'shengxin',
    name: '省心会员',
    price: 19.9,
    credits: 400,
    maxPages: 20,
    aiModels: ['imagen-3-flash', '系统按用途自动路由'],
    audience: '高频日常场景',
    featured: true,
    features: ['每月 400 积分', '省心模式 + 专业模式', '主题图/搜索图/AI图', 'PPTX 无额外下载费'],
  },
  {
    id: 'advanced',
    name: '高级会员',
    price: 39.9,
    credits: 1000,
    maxPages: 40,
    aiModels: ['imagen-3-flash', 'imagen-3-pro', 'flux-1-pro', 'ideogram-v3', 'gemini-2.5-flash-image'],
    audience: '重度创作与团队使用',
    features: ['每月 1000 积分', '多模型智能匹配', '40页大纲与复杂场景', '优先队列与完整记录'],
  },
];

const COMPARE_ROWS: CompareRow[] = [
  {
    label: '专业模式',
    free: { text: '支持', type: 'ok' },
    shengxin: { text: '支持', type: 'ok' },
    advanced: { text: '支持', type: 'ok' },
  },
  {
    label: '省心模式',
    free: { text: '会员专享', type: 'strike' },
    shengxin: { text: '支持', type: 'ok' },
    advanced: { text: '支持', type: 'ok' },
  },
  {
    label: '单次页面能力',
    free: { text: '20页', type: 'strike' },
    shengxin: { text: '20页', type: 'ok' },
    advanced: { text: '40页', type: 'ok' },
  },
  {
    label: '图片能力',
    free: { text: '主题图 + 搜索图', type: 'ok' },
    shengxin: { text: '主题图 + 搜索图 + AI图', type: 'ok' },
    advanced: { text: '全能力支持', type: 'ok' },
  },
  {
    label: '高级AI图片模型',
    free: { text: '高级模型', type: 'strike' },
    shengxin: { text: '标准AI模型', type: 'neutral' },
    advanced: { text: '全模型支持', type: 'ok' },
  },
  {
    label: '历史项目与数据管理',
    free: { text: '基础记录', type: 'neutral' },
    shengxin: { text: '完整历史', type: 'ok' },
    advanced: { text: '完整历史 + 优先支持', type: 'ok' },
  },
];

function statusCell(cell: { text: string; type: 'ok' | 'off' | 'strike' | 'neutral' }) {
  if (cell.type === 'ok') {
    return <span className="inline-flex items-center gap-1 text-emerald-600 font-bold text-xs">✓ {cell.text}</span>;
  }
  if (cell.type === 'strike') {
    return <span className="inline-flex items-center gap-1 text-slate-300 line-through font-bold text-xs">{cell.text}</span>;
  }
  if (cell.type === 'off') {
    return <span className="inline-flex items-center gap-1 text-rose-400 font-bold text-xs">✕ {cell.text}</span>;
  }
  return <span className="inline-flex items-center gap-1 text-slate-500 font-semibold text-xs">{cell.text}</span>;
}

function planMarker(planId: Plan['id']): string {
  if (planId === 'shengxin') return '✨';
  if (planId === 'advanced') return '👑';
  return '';
}

function PlanCard({
  plan,
  selected,
  onSelect,
  onBuy,
}: {
  plan: Plan;
  selected: boolean;
  onSelect: () => void;
  onBuy: () => void;
}) {
  const monthlyPages = plan.credits / CREDITS_PER_PAGE;
  const approxCostPerPage = plan.price > 0 ? (plan.price / Math.max(1, monthlyPages)).toFixed(2) : '0.10';
  const ppt10Count = Math.floor(plan.credits / PER_PPT10_PAGES_CREDITS);

  return (
    <button
      type="button"
      onClick={onSelect}
      className={`text-left sx-glass rounded-[26px] p-6 border transition-all hover:-translate-y-1 ${
        selected ? 'border-indigo-300 shadow-[0_18px_40px_rgba(93,85,255,0.24)]' : 'border-indigo-100/70'
      }`}
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-[11px] text-indigo-500 font-bold uppercase tracking-wide">
            {plan.id === 'free' ? '体验方案' : plan.featured ? '推荐方案' : '进阶方案'}
          </p>
          <h3 className="text-2xl font-black text-slate-900 mt-1 flex items-center gap-2">
            {plan.name}
            {planMarker(plan.id) && (
              <span className="inline-flex items-center rounded-full border border-indigo-200 bg-indigo-50 px-2 py-0.5 text-[11px] font-bold text-indigo-600">
                {planMarker(plan.id)}
              </span>
            )}
          </h3>
          <p className="text-sm text-slate-500 mt-1">{plan.audience}</p>
        </div>
        <div className="text-right">
          <p className="text-3xl font-black sx-accent-text">{plan.price > 0 ? `¥${plan.price}` : '¥0'}</p>
          <p className="text-xs text-slate-400 mt-1">{plan.price > 0 ? '每月' : '按用量'}</p>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2 mt-5">
        <div className="rounded-2xl bg-white/80 border border-indigo-100 p-3">
          <p className="text-[11px] text-slate-400">积分额度</p>
          <p className="text-lg font-black text-slate-900 mt-1">{plan.credits}</p>
          <p className="text-[10px] text-slate-400 mt-1">约可生成 {ppt10Count} 份10页PPT</p>
        </div>
        <div className="rounded-2xl bg-white/80 border border-indigo-100 p-3">
          <p className="text-[11px] text-slate-400">单次页数</p>
          <p className="text-lg font-black text-slate-900 mt-1">{plan.maxPages} 页</p>
        </div>
        <div className="rounded-2xl bg-white/80 border border-indigo-100 p-3">
          <p className="text-[11px] text-slate-400">成本参考</p>
          <p className="text-lg font-black text-slate-900 mt-1">约¥{approxCostPerPage}/页</p>
        </div>
      </div>

      <div className="mt-4 rounded-2xl bg-white/75 border border-indigo-100 px-4 py-3">
        <p className="text-xs text-slate-400">AI 图片模型（按用途自动选）</p>
        <p className="text-sm font-semibold text-slate-700 mt-1">{plan.aiModels.join(' / ')}</p>
      </div>

      <ul className="mt-4 space-y-2">
        {plan.features.map((item) => (
          <li key={item} className="text-sm text-slate-600 flex items-center gap-2">
            <span className="w-5 h-5 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center text-[11px]">✓</span>
            {item}
          </li>
        ))}
      </ul>

      {plan.id !== 'free' ? (
        <div className="mt-5">
          <div
            className={`w-full text-center py-3 rounded-xl text-sm font-black transition-all ${
              selected ? 'sx-primary-btn text-white' : 'bg-white border border-indigo-200 text-indigo-700'
            }`}
            onClick={(event) => {
              event.stopPropagation();
              onBuy();
            }}
          >
            立即开通
          </div>
        </div>
      ) : (
        <div className="mt-5 w-full text-center py-3 rounded-xl text-sm font-black bg-slate-100 text-slate-500">
          当前默认方案
        </div>
      )}
    </button>
  );
}

export default function PricingPage() {
  const { user, openPayment, openLogin, showPayment, closePayment, paymentPlan, showLogin, closeLogin } = useAuth();
  const paymentEnabled = isPaymentFeatureEnabledClient();
  const [selectedPlan, setSelectedPlan] = React.useState<'shengxin' | 'advanced'>('shengxin');
  const [creditPackages, setCreditPackages] = React.useState<CreditPackage[]>([]);
  const [creditTier, setCreditTier] = React.useState<'member' | 'free'>('free');
  const [creditLoading, setCreditLoading] = React.useState(false);
  const [creditMessage, setCreditMessage] = React.useState('');

  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      setCreditLoading(true);
      try {
        const headers: Record<string, string> = {};
        if (user?.id) headers.Authorization = `Bearer ${user.id}`;
        const res = await fetch('/api/credits', { headers });
        const data = await res.json();
        if (!cancelled && Array.isArray(data?.packages)) {
          setCreditPackages(data.packages);
          setCreditTier(data?.priceTier === 'member' ? 'member' : 'free');
        }
      } catch {
      } finally {
        if (!cancelled) setCreditLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user?.id]);

  const buyPlan = (plan: Plan) => {
    if (!user) {
      openLogin();
      return;
    }
    if (!paymentEnabled) {
      setCreditMessage('支付通道申请中，会员开通暂不可用。');
      return;
    }
    openPayment({
      id: plan.id,
      name: plan.name,
      price: `¥${plan.price}/月`,
      billing: 'monthly',
    });
  };

  const createCreditOrder = async (pkg: CreditPackage) => {
    if (!user) {
      openLogin();
      return;
    }
    if (!paymentEnabled) {
      setCreditMessage('支付通道申请中，积分充值暂不可用。');
      return;
    }
    setCreditMessage('');
    try {
      const res = await fetch('/api/credits', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(user?.id ? { Authorization: `Bearer ${user.id}` } : {}),
        },
        body: JSON.stringify({ packageId: pkg.id }),
      });
      const data = await res.json();
      if (!res.ok || data.error) {
        setCreditMessage(data.error || '创建充值订单失败');
        return;
      }
      setCreditMessage(`已创建订单 ${data.order_no}，支付回调接入后将自动到账。`);
    } catch {
      setCreditMessage('创建充值订单失败');
    }
  };

  return (
    <>
      <div className="min-h-screen sx-shell">
        <Navbar />
        <div className="text-center py-1 text-[11px] text-gray-400">版本 {APP_VERSION}</div>

        <div className="max-w-6xl mx-auto px-4 md:px-8 py-6 md:py-10">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
            <Link
              href="/"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-white border border-indigo-200 text-indigo-700 text-sm font-semibold hover:bg-indigo-50 transition-all"
            >
              ← 返回首页
            </Link>
            <p className="text-xs text-slate-500">套餐：免费用户 / 省心会员 / 高级会员</p>
          </div>

          <section className="text-center mb-8">
            <h1 className="text-4xl md:text-5xl font-black tracking-tight sx-gradient-text">会员套餐</h1>
            <p className="mt-3 text-sm md:text-base text-slate-500">突出会员优势，免费用户仅保留基础能力。</p>
            {!paymentEnabled && (
              <p className="mt-3 text-xs font-semibold text-amber-600">支付通道申请中：当前仅开放非支付功能。</p>
            )}
          </section>

          <section className="grid lg:grid-cols-3 gap-5">
            {PLANS.map((plan) => (
              <PlanCard
                key={plan.id}
                plan={plan}
                selected={selectedPlan === plan.id}
                onSelect={() => {
                  if (plan.id !== 'free') setSelectedPlan(plan.id);
                }}
                onBuy={() => buyPlan(plan)}
              />
            ))}
          </section>

          <section className="mt-7 sx-glass rounded-[24px] p-5 md:p-6">
            <h2 className="text-lg font-black text-slate-900">功能对比</h2>
            <div className="overflow-x-auto mt-4">
              <table className="w-full text-sm min-w-[780px]">
                <thead>
                  <tr className="text-left text-slate-500">
                    <th className="py-3 pr-4">项目</th>
                    <th className="py-3 px-3">免费用户</th>
                    <th className="py-3 px-3">✨ 省心会员（推荐）</th>
                    <th className="py-3 px-3">👑 高级会员</th>
                  </tr>
                </thead>
                <tbody>
                  {COMPARE_ROWS.map((row) => (
                    <tr key={row.label} className="border-t border-indigo-100/60">
                      <td className="py-3 pr-4 text-slate-700 font-semibold">{row.label}</td>
                      <td className="py-3 px-3">{statusCell(row.free)}</td>
                      <td className="py-3 px-3">{statusCell(row.shengxin)}</td>
                      <td className="py-3 px-3">{statusCell(row.advanced)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section id="credit-topup" className="mt-7 sx-glass rounded-[24px] p-5 md:p-6">
            <h2 className="text-lg font-black text-slate-900">积分单独充值</h2>
            <p className="text-sm text-slate-500 mt-1">
              {creditTier === 'member'
                ? '会员充值按 1元≈20积分；不影响当前会员等级。'
                : '免费用户充值按 1元≈10积分（会员价两倍），也可直接按页付费下载。'}
            </p>
            {creditMessage && <p className="mt-3 text-sm text-indigo-600 font-semibold">{creditMessage}</p>}
            <div className="grid md:grid-cols-3 gap-3 mt-4">
              {(creditPackages.length > 0 ? creditPackages : [
                { id: 'topup-100', name: '体验包', credits: 100, price: 1000, price_yuan: 10, rate_text: '免费用户价 1元≈10积分', price_tier: 'free' as const },
                { id: 'topup-500', name: '基础包', credits: 500, price: 5000, price_yuan: 50, rate_text: '免费用户价 1元≈10积分', price_tier: 'free' as const },
                { id: 'topup-2000', name: '超值包', credits: 2000, price: 20000, price_yuan: 200, rate_text: '免费用户价 1元≈10积分', price_tier: 'free' as const },
              ]).map((pkg) => (
                <div key={pkg.id} className="rounded-2xl border border-indigo-100 bg-white/80 p-4">
                  <p className="text-sm font-bold text-slate-800">{pkg.name}</p>
                  <p className="mt-2 text-2xl font-black sx-accent-text">{pkg.credits} 积分</p>
                  <p className="text-sm text-slate-500 mt-1">¥{(Number(pkg.price_yuan ?? Number(pkg.price) / 100)).toFixed(2)}</p>
                  <p className="text-[11px] text-slate-400 mt-1">{pkg.rate_text || (creditTier === 'member' ? '会员价 1元≈20积分' : '免费用户价 1元≈10积分')}</p>
                  <button
                    onClick={() => createCreditOrder(pkg)}
                    disabled={creditLoading || !paymentEnabled}
                    className="mt-4 w-full py-2.5 rounded-xl bg-white border border-indigo-200 text-indigo-700 text-sm font-bold hover:bg-indigo-50"
                  >
                    {paymentEnabled ? '创建充值订单' : '支付通道申请中'}
                  </button>
                </div>
              ))}
            </div>
          </section>

          <section id="single-pay" className="mt-7 sx-glass rounded-[24px] p-5 md:p-6">
            <h2 className="text-lg font-black text-slate-900">单次按页付费</h2>
            <p className="text-sm text-slate-500 mt-1">适合低频用户，按页付费下载PPTX；建议高频场景优先开通会员，整体成本更低。</p>
          </section>
        </div>
      </div>

      <PaymentModal open={showPayment} onClose={closePayment} plan={paymentPlan} />
      <LoginModal open={showLogin} onClose={closeLogin} />
    </>
  );
}
