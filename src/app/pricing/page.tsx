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
  imageModels: { name: string; available: boolean }[];
  audience: string;
  featured?: boolean;
  features: string[];
  approxCostPerPage: string;
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

const CREDITS_PER_PAGE = 3;

const PLANS: Plan[] = [
  {
    id: 'free',
    name: '免费用户',
    price: 0,
    credits: 40,
    maxPages: 8,
    imageModels: [
      { name: '主题套图', available: true },
      { name: 'Pexels图库', available: true },
      { name: 'AI定制图', available: false },
      { name: 'AI尊享图', available: false },
    ],
    audience: '轻量体验',
    features: ['每月赠送 40 积分', '专业模式', '1 个附件：文档10MB以内', '普通用户也可充值积分'],
    approxCostPerPage: '0.3',
  },
  {
    id: 'shengxin',
    name: '省心会员',
    price: 19.9,
    credits: 500,
    maxPages: 20,
    imageModels: [
      { name: '主题套图', available: true },
      { name: 'Pexels图库', available: true },
      { name: 'AI定制图', available: true },
      { name: 'AI尊享图', available: false },
    ],
    audience: '高频日常场景',
    featured: true,
    features: ['每月 500 积分', '省心模式 + 专业模式', '5 个附件：PDF、PPTX、XLSX、JPG 等', '生成完成自动下载 PPTX'],
    approxCostPerPage: '0.15',
  },
  {
    id: 'advanced',
    name: '尊享会员',
    price: 49.9,
    credits: 1500,
    maxPages: 40,
    imageModels: [
      { name: '主题套图', available: true },
      { name: 'Pexels图库', available: true },
      { name: 'AI定制图', available: true },
      { name: 'AI尊享图', available: true },
    ],
    audience: '重度创作与团队使用',
    features: ['每月 1500 积分', '多模型智能匹配', '5 个附件：PDF、PPTX、XLSX、JPG 等', '优先队列与更高阶图片能力'],
    approxCostPerPage: '0.1',
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
    label: '页数上限',
    free: { text: '8页', type: 'neutral' },
    shengxin: { text: '20页', type: 'ok' },
    advanced: { text: '40页', type: 'ok' },
  },
  {
    label: '图片模型',
    free: { text: '主题套图 + Pexels图库', type: 'neutral' },
    shengxin: { text: '主题套图 + Pexels图库 + AI定制图', type: 'ok' },
    advanced: { text: '主题套图 + Pexels图库 + AI定制图 + AI尊享图', type: 'ok' },
  },
  {
    label: '附件数量',
    free: { text: '最多1个', type: 'neutral' },
    shengxin: { text: '最多5个', type: 'ok' },
    advanced: { text: '最多5个', type: 'ok' },
  },
  {
    label: '附件格式',
    free: { text: 'PPTX、PDF（下载）', type: 'neutral' },
    shengxin: { text: 'PDF、PPTX、XLSX、JPG 等', type: 'ok' },
    advanced: { text: 'PDF、PPTX、XLSX、JPG 等', type: 'ok' },
  },
  {
    label: '附件大小',
    free: { text: '文档10MB / 总计10MB', type: 'neutral' },
    shengxin: { text: '文档30MB / 图片2.5MB / 总计100MB', type: 'ok' },
    advanced: { text: '文档30MB / 图片2.5MB / 总计100MB', type: 'ok' },
  },
  {
    label: 'AI模型',
    free: { text: '不支持', type: 'off' },
    shengxin: { text: '支持标准 AI 模型', type: 'ok' },
    advanced: { text: '支持高阶 AI 模型', type: 'ok' },
  },
  {
    label: '积分结算',
    free: { text: '按生成页数统一扣积分', type: 'neutral' },
    shengxin: { text: '按生成页数统一扣积分', type: 'ok' },
    advanced: { text: '按生成页数统一扣积分', type: 'ok' },
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
  if (planId === 'shengxin') return '💎';
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
  const approxPages = Math.floor(plan.credits / CREDIT_PER_PAGE);

  return (
    <button
      type="button"
      onClick={onSelect}
      className={`min-w-0 w-full max-w-full overflow-hidden text-left sx-glass rounded-[26px] p-6 border transition-all hover:-translate-y-1 ${
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

      <div className="mt-5 grid grid-cols-3 gap-2 md:gap-3">
        <div className="min-w-0 rounded-2xl border border-indigo-100 bg-white/80 px-2 py-3 text-center md:p-3.5 md:text-left">
          <p className="truncate text-[10px] font-semibold tracking-wide text-slate-400 md:text-[11px]">积分额度</p>
          <p className="mt-1 text-lg font-black text-slate-900 md:text-xl">{plan.credits}</p>
          <p className="mt-1 truncate text-[9px] leading-4 text-slate-400 md:text-[11px] md:leading-5">约 {approxPages} 页PPT</p>
        </div>
        <div className="min-w-0 rounded-2xl border border-indigo-100 bg-white/80 px-2 py-3 text-center md:p-3.5 md:text-left">
          <p className="truncate text-[10px] font-semibold tracking-wide text-slate-400 md:text-[11px]">页数上限</p>
          <p className="mt-1 whitespace-nowrap text-lg font-black text-slate-900 md:text-xl">{plan.maxPages} 页</p>
          <p className="mt-1 text-[9px] leading-4 text-slate-400 md:text-[11px] md:leading-5">单次生成</p>
        </div>
        <div className="min-w-0 rounded-2xl border border-indigo-100 bg-white/80 px-2 py-3 text-center md:p-3.5 md:text-left">
          <p className="truncate text-[10px] font-semibold tracking-wide text-slate-400 md:text-[11px]">每页费用</p>
          <p className="mt-1 whitespace-nowrap text-lg font-black text-slate-900 md:text-xl">{plan.approxCostPerPage}元</p>
          <p className="mt-1 text-[9px] leading-4 text-slate-400 md:text-[11px] md:leading-5">约合成本</p>
        </div>
      </div>

      <div className="mt-4 rounded-2xl border border-indigo-100 bg-white/75 px-4 py-3.5">
        <p className="text-[11px] font-semibold tracking-wide text-slate-400">图片模型</p>
        <div className="mt-2 flex flex-wrap gap-2">
          {plan.imageModels.map((model) => (
            <span
              key={model.name}
              className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ${
                model.available
                  ? 'border border-indigo-200 bg-indigo-50 text-indigo-700'
                  : 'border border-slate-200 bg-slate-100 text-slate-400'
              }`}
            >
              {model.name}
            </span>
          ))}
        </div>
      </div>

      <ul className="mt-4 space-y-2">
        {plan.features.map((item) => (
          <li key={item} className="flex items-start gap-2 text-sm leading-6 text-slate-600">
            <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-indigo-100 text-[11px] text-indigo-600">✓</span>
            <span>{item}</span>
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

        <div className="mx-auto w-full min-w-0 max-w-6xl overflow-x-clip px-4 py-6 md:px-8 md:py-10">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
            <Link
              href="/"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-white border border-indigo-200 text-indigo-700 text-sm font-semibold hover:bg-indigo-50 transition-all"
            >
              ← 返回首页
            </Link>
            <p className="min-w-0 text-xs text-slate-500">套餐：免费用户 / 省心会员 / 尊享会员</p>
          </div>

          <section className="text-center mb-8">
            <h1 className="text-4xl md:text-5xl font-black tracking-tight sx-gradient-text">会员套餐</h1>
            <p className="mt-3 text-sm leading-6 md:text-base text-slate-500">按使用频率拆分三档权益，整站统一按积分结算，生成阶段按页扣分，会员方案重点强化积分额度与图片模型能力。</p>
            {!paymentEnabled && (
              <p className="mt-3 text-xs font-semibold text-amber-600">支付通道申请中：当前仅开放非支付功能。</p>
            )}
          </section>

          <section className="grid min-w-0 gap-5 lg:grid-cols-3">
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
                    <th className="py-3 px-3">💎 省心会员（推荐）</th>
                    <th className="py-3 px-3">👑 尊享会员</th>
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
                ? '会员可按固定包价补充积分，不影响当前会员等级。'
                : '免费用户也可按固定包价补充积分，生成与下载统一按积分结算。'}
            </p>
            {creditMessage && <p className="mt-3 text-sm text-indigo-600 font-semibold">{creditMessage}</p>}
            <div className="grid md:grid-cols-3 gap-3 mt-4">
              {(creditPackages.length > 0 ? creditPackages : [
                { id: 'topup-100', name: '体验包', credits: 100, price: 1000, price_yuan: 10, rate_text: '固定包价：¥10 / 100积分', price_tier: 'free' as const },
                { id: 'topup-500', name: '基础包', credits: 500, price: 2000, price_yuan: 20, rate_text: '固定包价：¥20 / 500积分', price_tier: 'free' as const },
                { id: 'topup-3000', name: '超值包', credits: 3000, price: 10000, price_yuan: 100, rate_text: '固定包价：¥100 / 3000积分', price_tier: 'free' as const },
              ]).map((pkg) => (
                <div key={pkg.id} className="flex items-center gap-3 rounded-2xl border border-indigo-100 bg-white/80 p-4 md:block">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-bold text-slate-800">{pkg.name}</p>
                    <p className="mt-1.5 whitespace-nowrap text-2xl font-black sx-accent-text md:mt-2">{pkg.credits} 积分</p>
                    <p className="mt-1 text-sm text-slate-500">¥{(Number(pkg.price_yuan ?? Number(pkg.price) / 100)).toFixed(2)}</p>
                    <p className="mt-1 truncate text-[11px] text-slate-400">{pkg.rate_text || '固定包价'}</p>
                  </div>
                  <button
                    onClick={() => createCreditOrder(pkg)}
                    disabled={creditLoading || !paymentEnabled}
                    className="w-[112px] shrink-0 rounded-xl border border-indigo-200 bg-white px-3 py-2.5 text-sm font-bold leading-5 text-indigo-700 hover:bg-indigo-50 md:mt-4 md:w-full"
                  >
                    {paymentEnabled ? '创建充值订单' : '支付通道申请中'}
                  </button>
                </div>
              ))}
            </div>
          </section>

          <div className="pt-6 text-center text-[11px] text-gray-400">版本 {APP_VERSION}</div>
        </div>
      </div>

      <PaymentModal open={showPayment} onClose={closePayment} plan={paymentPlan} />
      <LoginModal open={showLogin} onClose={closeLogin} />
    </>
  );
}
