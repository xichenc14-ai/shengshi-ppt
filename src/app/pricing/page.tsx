'use client';

import React from 'react';
import Link from 'next/link';
import { useAuth } from '@/lib/auth-context';

type PlanFeature = { text: string; included: boolean };

type Plan = {
  id: string;
  emoji: string;
  name: string;
  desc: string;
  popular?: boolean;
  prices: { monthly: string; annual: string; annualMonthly: string; annualSave: string };
  features: PlanFeature[];
  cta: string;
  ctaDisabled: boolean;
};

const PLANS: Plan[] = [
  {
    id: 'free',
    emoji: '💚',
    name: '免费体验版',
    desc: '免费开始，感受AI的魔力',
    prices: { monthly: '¥0', annual: '¥0', annualMonthly: '¥0', annualSave: '' },
    features: [
      { text: '每月 3 次 PPT 生成', included: true },
      { text: '每次最多 8 页', included: true },
      { text: 'PPTX 导出（带水印）', included: true },
      { text: '5 个基础主题', included: true },
      { text: '文档上传转PPT', included: false },
      { text: 'AI大纲编辑器', included: false },
      { text: '优先生成队列', included: false },
      { text: '历史记录永久保存', included: false },
    ],
    cta: '当前套餐',
    ctaDisabled: true,
  },
  {
    id: 'basic',
    emoji: '💎',
    name: '基础版',
    desc: '职场人的效率神器',
    popular: true,
    prices: { monthly: '¥29', annual: '¥199/年', annualMonthly: '¥16.6', annualSave: '省¥149' },
    features: [
      { text: '每月 20 次 PPT 生成', included: true },
      { text: '每次最多 15 页', included: true },
      { text: '无水印导出（PPTX）', included: true },
      { text: '全部主题', included: true },
      { text: '文档上传转PPT', included: true },
      { text: 'AI大纲编辑器', included: false },
      { text: '优先生成队列', included: false },
      { text: '历史记录永久保存', included: false },
    ],
    cta: '立即开通',
    ctaDisabled: false,
  },
  {
    id: 'pro',
    emoji: '👑',
    name: '专业版',
    desc: '重度用户的首选',
    prices: { monthly: '¥59', annual: '¥399/年', annualMonthly: '¥33.3', annualSave: '省¥309' },
    features: [
      { text: '每月 100 次 PPT 生成', included: true },
      { text: '每次最多 30 页', included: true },
      { text: 'AI大纲编辑器', included: true },
      { text: '优先生成队列', included: true },
      { text: '历史记录永久保存', included: true },
      { text: '全格式导出（PDF/PPTX/PNG）', included: true },
    ],
    cta: '立即开通',
    ctaDisabled: false,
  },
];

function PlanCard({ plan, user, openPayment, openLogin }: { plan: Plan; user: any; openPayment: any; openLogin: any }) {
  const [isAnnual, setIsAnnual] = React.useState(false);
  const currentPrice = isAnnual ? plan.prices.annualMonthly : plan.prices.monthly;
  const period = isAnnual ? '/月 (年付)' : '/月';

  const handleCta = () => {
    if (plan.id === 'free') return;
    if (!user) { openLogin(); return; }
    openPayment({
      id: plan.id,
      name: plan.name,
      price: isAnnual ? plan.prices.annual : currentPrice,
      billing: isAnnual ? 'annual' : 'monthly',
    });
  };

  return (
    <div
      className={`relative bg-white rounded-2xl p-6 border transition-all duration-300 hover:-translate-y-1 ${
        plan.popular
          ? 'border-[#5B4FE9] shadow-xl shadow-purple-200/30 md:scale-105'
          : 'border-gray-100 hover:shadow-lg hover:border-[#EDE9FE]'
      }`}
    >
      {plan.popular && (
        <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-0.5 bg-gradient-to-r from-[#5B4FE9] to-[#8B5CF6] text-white text-[10px] font-bold rounded-full">
          最受欢迎
        </div>
      )}

      <div className="text-center mb-5">
        <div className="text-3xl mb-2">{plan.emoji}</div>
        <h3 className="text-base font-bold text-gray-900">{plan.name}</h3>
        <p className="text-xs text-gray-400 mt-0.5">{plan.desc}</p>

        {/* 价格切换（仅付费版显示） */}
        {!plan.ctaDisabled && (
          <div className="flex items-center justify-center gap-2 mt-3 mb-1">
            <button
              onClick={() => setIsAnnual(false)}
              className={`text-[11px] px-3 py-1 rounded-full transition-all ${
                !isAnnual ? 'bg-[#5B4FE9] text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
              }`}
            >
              月付
            </button>
            <button
              onClick={() => setIsAnnual(true)}
              className={`text-[11px] px-3 py-1 rounded-full transition-all ${
                isAnnual ? 'bg-[#5B4FE9] text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
              }`}
            >
              年付
              {plan.prices.annualSave && (
                <span className="ml-1 text-[9px] bg-[#10B981] text-white px-1.5 py-0.5 rounded-full align-middle">
                  {plan.prices.annualSave}
                </span>
              )}
            </button>
          </div>
        )}

        <div className="mt-2">
          <span className="text-3xl font-extrabold" style={{ color: '#111827' }}>{currentPrice}</span>
          <span className="text-sm text-gray-400">{period}</span>
        </div>
        {isAnnual && !plan.ctaDisabled && (
          <p className="text-[10px] mt-1" style={{ color: '#5B4FE9' }}>年付 {plan.prices.annual}，平均每月仅 {plan.prices.annualMonthly}</p>
        )}
      </div>

      <ul className="space-y-2 mb-6">
        {plan.features.map((f, j) => (
          <li key={j} className={`flex items-start gap-2 text-xs ${f.included ? 'text-gray-600' : 'text-gray-300'}`}>
            <span className={`mt-0.5 flex-shrink-0 ${f.included ? '' : 'text-gray-200'}`}
              style={f.included ? { color: '#5B4FE9' } : undefined}>
              {f.included ? '✓' : '✕'}
            </span>
            <span>{f.text}</span>
          </li>
        ))}
      </ul>

      <button
        onClick={handleCta}
        disabled={plan.ctaDisabled}
        className={`w-full py-2.5 rounded-xl text-sm font-semibold transition-all ${
          plan.ctaDisabled
            ? 'bg-gray-100 text-gray-400 cursor-default'
            : plan.popular
            ? 'text-white hover:shadow-lg hover:shadow-purple-300/40'
            : 'bg-white text-[#5B4FE9] border-2 border-[#EDE9FE] hover:bg-[#F5F3FF]'
        }`}
        style={!plan.ctaDisabled && plan.popular ? { background: 'linear-gradient(135deg, #5B4FE9, #8B5CF6)' } : undefined}
      >
        {plan.cta}
      </button>
    </div>
  );
}

export default function PricingPage() {
  const { user, openPayment, openLogin } = useAuth();

  return (
    <div className="min-h-screen bg-[#FAFBFE]">
      {/* Hero */}
      <section className="pt-16 pb-8 text-center">
        <h1 className="text-2xl md:text-3xl font-extrabold text-gray-900 mb-2">简单透明的定价</h1>
        <p className="text-sm text-gray-400">免费试用，满意再付费 · 月付年付随心选</p>
      </section>

      {/* Plans */}
      <section className="max-w-5xl mx-auto px-4 pb-8">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6">
          {PLANS.map((p) => (
            <PlanCard key={p.id} plan={p} user={user} openPayment={openPayment} openLogin={openLogin} />
          ))}
        </div>
      </section>

      {/* FAQ */}
      <section className="max-w-3xl mx-auto px-4 py-12">
        <h2 className="text-xl font-bold text-gray-900 text-center mb-6">常见问题</h2>
        <div className="space-y-3">
          {[
            { q: '免费版有什么限制？', a: '免费版每月可生成3次PPT，每次最多8页，导出PPTX带「省心PPT」水印。足够体验AI生成PPT的效果。' },
            { q: '可以随时取消订阅吗？', a: '可以，随时取消不会影响当前周期的使用。取消后下个计费周期自动降为免费版。' },
            { q: '月付和年付有什么区别？', a: '功能完全一样，年付更优惠。基础版年付¥199（省¥149），专业版年付¥399（省¥309）。月付适合先试用，年付适合长期用户。' },
            { q: '支持哪些支付方式？', a: '支持微信支付和支付宝。按月或按年付费，年付更优惠。' },
            { q: '基础版和专业版怎么选？', a: '如果你每月PPT需求在20次以内，基础版（¥29/月）足够。如果需要AI大纲编辑器、优先生成队列、历史记录永久保存等功能，推荐专业版（¥59/月）。' },
          ].map((f, i) => (
            <details key={i} className="bg-white border border-gray-100 rounded-xl group">
              <summary className="px-5 py-3 text-sm font-semibold text-gray-800 cursor-pointer hover:bg-gray-50/50 list-none flex items-center justify-between">
                {f.q}
                <span className="text-gray-400 group-open:rotate-45 transition-transform">+</span>
              </summary>
              <div className="px-5 pb-3 text-xs text-gray-500 leading-relaxed">{f.a}</div>
            </details>
          ))}
        </div>
      </section>
    </div>
  );
}
