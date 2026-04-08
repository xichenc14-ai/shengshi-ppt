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
  credits: string;
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
    credits: '3 次/月',
    features: [
      '每月 3 次 PPT 生成',
      '每次最多 8 页',
      '可导出PPTX（带水印）',
      '5 个基础主题',
    ].map(t => ({ text: t, included: true })),
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
    credits: '20 次/月',
    features: [
      '每月 20 次 PPT 生成',
      '每次最多 15 页',
      '无水印导出PPTX，不限次数',
      '全部主题',
      '文档上传转PPT',
    ].map(t => ({ text: t, included: true })),
    cta: '立即开通',
    ctaDisabled: false,
  },
  {
    id: 'pro',
    emoji: '👑',
    name: '专业版',
    desc: '重度用户的首选',
    prices: { monthly: '¥59', annual: '¥399/年', annualMonthly: '¥33.3', annualSave: '省¥309' },
    credits: '100 次/月',
    features: [
      '每月 100 次 PPT 生成',
      '每次最多 30 页',
      'AI大纲编辑器',
      '优先生成队列',
      '历史记录永久保存',
      '全格式导出（PDF/PPTX/PNG）',
    ].map(t => ({ text: t, included: true })),
    cta: '立即开通',
    ctaDisabled: false,
  },
];

export default function PricingSection() {
  const { user, openPayment, openLogin } = useAuth();
  const [isAnnual, setIsAnnual] = React.useState(false);

  const handleCta = (plan: Plan) => {
    if (plan.id === 'free') return;
    if (!user) { openLogin(); return; }
    const price = isAnnual ? plan.prices.annual : plan.prices.monthly;
    openPayment({
      id: plan.id,
      name: plan.name,
      price: isAnnual ? plan.prices.annual : price + '/月',
      billing: isAnnual ? 'annual' : 'monthly',
    });
  };

  return (
    <section className="py-16 md:py-20 bg-[#FAFBFE]" id="pricing">
      <div className="max-w-5xl mx-auto px-4 md:px-6">
        <div className="text-center mb-6">
          <h2 className="text-2xl md:text-3xl font-extrabold text-gray-900 mb-2">简单透明的定价</h2>
          <p className="text-sm text-gray-400">免费试用，满意再付费 · 月付年付随心选</p>
        </div>

        {/* 月付/年付切换 */}
        <div className="flex items-center justify-center gap-2 mb-6">
          <button
            onClick={() => setIsAnnual(false)}
            className={`text-xs px-4 py-1.5 rounded-full transition-all font-medium ${
              !isAnnual ? 'bg-[#5B4FE9] text-white shadow-sm shadow-purple-200/50' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
            }`}
          >
            月付
          </button>
          <button
            onClick={() => setIsAnnual(true)}
            className={`text-xs px-4 py-1.5 rounded-full transition-all font-medium ${
              isAnnual ? 'bg-[#5B4FE9] text-white shadow-sm shadow-purple-200/50' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
            }`}
          >
            年付
            <span className="ml-1 text-[9px] bg-[#10B981] text-white px-1.5 py-0.5 rounded-full align-middle">
              省20%
            </span>
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6 max-w-4xl mx-auto">
          {PLANS.map((p, i) => {
            const displayPrice = p.ctaDisabled ? p.prices.monthly : (isAnnual ? p.prices.annualMonthly : p.prices.monthly);
            const displayPeriod = p.ctaDisabled ? '' : '/月';

            return (
              <div
                key={i}
                className={`relative bg-white rounded-2xl p-6 border transition-all duration-300 hover:-translate-y-1 ${
                  p.popular
                    ? 'border-[#5B4FE9] shadow-xl shadow-purple-200/30 scale-[1.02]'
                    : 'border-gray-100 hover:shadow-lg hover:border-[#EDE9FE]'
                }`}
              >
                {p.popular && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-0.5 bg-gradient-to-r from-[#5B4FE9] to-[#8B5CF6] text-white text-[10px] font-bold rounded-full">
                    最受欢迎
                  </div>
                )}
                <div className="text-center mb-5">
                  <div className="text-3xl mb-2">{p.emoji}</div>
                  <h3 className="text-base font-bold text-gray-900">{p.name}</h3>
                  <p className="text-xs text-gray-400 mt-0.5">{p.desc}</p>
                  <div className="mt-3">
                    <span className="text-3xl font-extrabold" style={{ color: '#111827' }}>{displayPrice}</span>
                    <span className="text-sm text-gray-400">{displayPeriod}</span>
                  </div>
                  <div className="mt-1">
                    <span className="text-xs font-semibold text-[#5B4FE9]">{p.credits}</span>
                  </div>
                  {isAnnual && !p.ctaDisabled && (
                    <p className="text-[10px] mt-1" style={{ color: '#5B4FE9' }}>年付 {p.prices.annual}，平均每月仅 {p.prices.annualMonthly}</p>
                  )}
                </div>

                <ul className="space-y-2.5 mb-6">
                  {p.features.map((f, j) => (
                    <li key={j} className="flex items-start gap-2 text-xs text-gray-600">
                      <span style={{ color: '#5B4FE9' }} className="mt-0.5 flex-shrink-0">✓</span>
                      <span>{f.text}</span>
                    </li>
                  ))}
                </ul>

                <button
                  onClick={() => handleCta(p)}
                  disabled={p.ctaDisabled}
                  className={`w-full py-2.5 rounded-xl text-sm font-semibold transition-all ${
                    p.ctaDisabled
                      ? 'bg-gray-100 text-gray-400 cursor-default'
                      : p.popular
                      ? 'text-white hover:shadow-lg hover:shadow-purple-300/40'
                      : 'bg-white text-[#5B4FE9] border-2 border-[#EDE9FE] hover:bg-[#F5F3FF]'
                  }`}
                  style={!p.ctaDisabled && p.popular ? { background: 'linear-gradient(135deg, #5B4FE9, #8B5CF6)' } : undefined}
                >
                  {p.cta}
                </button>
              </div>
            );
          })}
        </div>

        <div className="text-center mt-6">
          <Link href="/pricing" className="text-xs hover:underline" style={{ color: '#5B4FE9' }}>查看完整套餐对比 →</Link>
        </div>
      </div>
    </section>
  );
}
