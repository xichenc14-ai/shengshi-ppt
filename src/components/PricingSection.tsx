'use client';

import React from 'react';
import Link from 'next/link';
import { useAuth } from '@/lib/auth-context';

type PlanFeature = { text: string; included: boolean; highlight?: boolean };

type Plan = {
  id: string;
  emoji: string;
  name: string;
  badge?: string;
  desc: string;
  popular?: boolean;
  credits: number;
  maxPages: number;
  imageTier: string;
  prices: { monthly: number; annual: number; annualMonthly: number; annualSave: string };
  features: PlanFeature[];
  cta: string;
  ctaDisabled: boolean;
};

const PLANS: Plan[] = [
  {
    id: 'free',
    emoji: '💚',
    name: '免费体验',
    desc: '零成本体验AI生成PPT',
    credits: 50,
    maxPages: 8,
    imageTier: '无收费图',
    prices: { monthly: 0, annual: 0, annualMonthly: 0, annualSave: '' },
    features: [
      { text: '每月 50 积分', included: true },
      { text: '每次最多 8 页', included: true },
      { text: '免费插图模式', included: true },
      { text: 'PPTX 导出（带水印）', included: true },
      { text: '5 个基础主题', included: true },
      { text: 'AI大纲编辑器', included: false },
      { text: 'AI生图（2积分/图）', included: false },
      { text: '高级AI图（20积分/图）', included: false },
    ],
    cta: '当前方案',
    ctaDisabled: true,
  },
  {
    id: 'basic',
    emoji: '💎',
    name: '普通会员',
    badge: '推荐',
    desc: '职场人的效率利器',
    popular: true,
    credits: 500,
    maxPages: 20,
    imageTier: '普通图',
    prices: { monthly: 29.9, annual: 299, annualMonthly: 24.9, annualSave: '省60' },
    features: [
      { text: '每月 500 积分', included: true, highlight: true },
      { text: '每次最多 20 页', included: true },
      { text: 'PPTX 无水印导出', included: true },
      { text: '全部 50+ 主题', included: true },
      { text: '免费插图 + 普通AI图', included: true, highlight: true },
      { text: '文档上传转PPT', included: true },
      { text: 'AI大纲编辑器', included: false },
      { text: '高级AI图（20积分/图）', included: false },
    ],
    cta: '立即开通',
    ctaDisabled: false,
  },
  {
    id: 'pro',
    emoji: '👑',
    name: '高级会员',
    desc: '重度用户的首选方案',
    credits: 1000,
    maxPages: 40,
    imageTier: '高级图',
    prices: { monthly: 49.9, annual: 499, annualMonthly: 41.6, annualSave: '省100' },
    features: [
      { text: '每月 1000 积分', included: true, highlight: true },
      { text: '每次最多 40 页', included: true },
      { text: 'AI大纲编辑器', included: true, highlight: true },
      { text: '高级AI生图', included: true, highlight: true },
      { text: '优先生成队列', included: true },
      { text: '全格式导出', included: true },
      { text: '文档上传转PPT', included: true },
    ],
    cta: '立即开通',
    ctaDisabled: false,
  },
  {
    id: 'vip',
    emoji: '🏆',
    name: '尊享会员',
    desc: '权益全开，无限可能',
    credits: 2000,
    maxPages: 60,
    imageTier: '权益全开',
    prices: { monthly: 99.9, annual: 999, annualMonthly: 83.3, annualSave: '省199' },
    features: [
      { text: '每月 2000 积分', included: true, highlight: true },
      { text: '每次最多 60 页', included: true, highlight: true },
      { text: '尊享AI图（20积分/图）', included: true, highlight: true },
      { text: '权益全开', included: true, highlight: true },
      { text: '优先生成队列', included: true },
      { text: '历史记录永久保存', included: true },
      { text: '专属客服', included: true },
    ],
    cta: '立即开通',
    ctaDisabled: false,
  },
];

function PlanCard({ plan, user, openPayment, openLogin, isSelected, onSelect }: { plan: Plan; user: any; openPayment: any; openLogin: any; isSelected?: boolean; onSelect?: () => void }) {
  const [isAnnual, setIsAnnual] = React.useState(false);
  const currentPrice = isAnnual ? plan.prices.annualMonthly : plan.prices.monthly;
  const period = isAnnual ? '/月 (年付)' : '/月';

  const handleCta = () => {
    if (plan.id === 'free') return;
    if (!user) { openLogin(); return; }
    onSelect?.();
    openPayment({
      id: plan.id,
      name: plan.name,
      price: currentPrice > 0 ? `¥${currentPrice}` : '免费',
      billing: isAnnual ? 'annual' : 'monthly',
      credits: plan.credits,
    });
  };

  return (
    <div
      onClick={onSelect}
      className={`relative bg-white rounded-3xl p-6 md:p-7 border-2 transition-all duration-300 cursor-pointer hover:-translate-y-1.5 ${
        isSelected
          ? 'border-purple-400 shadow-xl shadow-purple-200/30 ring-4 ring-purple-100'
          : plan.popular
            ? 'border-purple-200 shadow-lg'
            : 'border-gray-100 hover:border-purple-200 hover:shadow-lg'
      }`}
    >
      {plan.popular && (
        <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 px-4 py-1 bg-gradient-to-r from-purple-600 to-purple-500 text-white text-[10px] font-bold rounded-full shadow-lg shadow-purple-200/50 whitespace-nowrap">
          {plan.badge || '最受欢迎'}
        </div>
      )}

      {/* Header */}
      <div className="text-center mb-5">
        <div className="text-4xl mb-2">{plan.emoji}</div>
        <h3 className="text-lg font-bold text-gray-900">{plan.name}</h3>
        <p className="text-xs text-gray-400 mt-0.5">{plan.desc}</p>
        
        {/* Credits badge */}
        <div className="inline-flex items-center gap-1 mt-3 px-3 py-1.5 bg-amber-50 rounded-full">
          <span className="text-sm">🪙</span>
          <span className="text-xs font-bold text-amber-600">{plan.credits} 积分/月</span>
        </div>

        {/* Price toggle */}
        {!plan.ctaDisabled && (
          <div className="flex items-center justify-center gap-2 mt-4 mb-2">
            <button
              onClick={(e) => { e.stopPropagation(); setIsAnnual(false); }}
              className={`text-[11px] px-3.5 py-1.5 rounded-full transition-all ${
                !isAnnual ? 'bg-purple-600 text-white shadow-sm' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
              }`}
            >
              月付
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); setIsAnnual(true); }}
              className={`text-[11px] px-3.5 py-1.5 rounded-full transition-all flex items-center gap-1 ${
                isAnnual ? 'bg-purple-600 text-white shadow-sm' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
              }`}
            >
              年付
              {plan.prices.annualSave && (
                <span className="ml-0.5 text-[9px] bg-emerald-500 text-white px-1.5 py-0.5 rounded-full">
                  省{plan.prices.annualSave.replace('省', '')}
                </span>
              )}
            </button>
          </div>
        )}

        {/* Price display */}
        <div className="mt-2">
          {currentPrice > 0 ? (
            <>
              <span className="text-4xl font-black text-gray-900">¥{currentPrice}</span>
              <span className="text-sm text-gray-400">{period}</span>
            </>
          ) : (
            <span className="text-4xl font-black text-gray-900">免费</span>
          )}
        </div>
        {isAnnual && !plan.ctaDisabled && currentPrice > 0 && (
          <p className="text-[10px] mt-1.5 text-purple-600 font-medium">
            年付 ¥{plan.prices.annual}，平均每月仅 ¥{plan.prices.annualMonthly}
          </p>
        )}
      </div>

      {/* Quick specs */}
      <div className="flex items-center justify-center gap-4 mb-4 py-3 bg-gray-50/80 rounded-2xl">
        <div className="text-center">
          <p className="text-sm font-bold text-gray-800">{plan.maxPages}页</p>
          <p className="text-[10px] text-gray-400">单次上限</p>
        </div>
        <div className="w-px h-8 bg-gray-200" />
        <div className="text-center">
          <p className="text-xs font-semibold text-gray-700">{plan.imageTier}</p>
          <p className="text-[10px] text-gray-400">图片方案</p>
        </div>
      </div>

      {/* Features */}
      <ul className="space-y-2.5 mb-6">
        {plan.features.map((f, j) => (
          <li key={j} className={`flex items-start gap-2.5 text-xs ${f.included ? 'text-gray-600' : 'text-gray-300'}`}>
            <span className={`mt-0.5 flex-shrink-0 text-sm ${f.included ? 'text-emerald-500' : 'text-gray-200'}`}>
              {f.included ? '✓' : '✕'}
            </span>
            <span className={f.highlight && f.included ? 'font-semibold text-gray-800' : ''}>{f.text}</span>
          </li>
        ))}
      </ul>

      {/* CTA Button */}
      <button
        onClick={(e) => { e.stopPropagation(); handleCta(); }}
        disabled={plan.ctaDisabled}
        className={`w-full py-3 rounded-xl text-sm font-bold transition-all ${
          plan.ctaDisabled
            ? 'bg-gray-100 text-gray-400 cursor-default'
            : isSelected
              ? 'text-white hover:shadow-lg hover:shadow-purple-300/40'
              : 'bg-white text-purple-600 border-2 border-purple-200 hover:bg-purple-50 hover:border-purple-300'
        }`}
        style={!plan.ctaDisabled && isSelected ? { background: 'linear-gradient(135deg, #7c3aed, #8b5cf6)' } : undefined}
      >
        {plan.cta}
      </button>
    </div>
  );
}

export default function PricingSection() {
  const { user, openPayment, openLogin } = useAuth();
  const [selectedPlan, setSelectedPlan] = React.useState<string | null>(null);

  return (
    <section className="py-20 md:py-28 relative overflow-hidden" id="pricing">
      {/* Background */}
      <div className="absolute inset-0 bg-gradient-to-b from-white via-purple-50/20 to-white" />
      
      <div className="relative max-w-6xl mx-auto px-4 md:px-6">
        {/* Header */}
        <div className="text-center mb-12">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-purple-100 rounded-full mb-4">
            <span className="text-xs font-semibold text-purple-700">简单透明的定价</span>
          </div>
          <h2 className="text-3xl md:text-4xl font-black text-gray-900 mb-3">
            选择适合你的
            <span className="bg-gradient-to-r from-purple-600 to-amber-500 bg-clip-text text-transparent"> 方案</span>
          </h2>
          <p className="text-gray-500 max-w-md mx-auto">
            按积分计费，用多少扣多少 · 免费试用，满意再付费
          </p>
        </div>

        {/* Plans */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {PLANS.map((p) => (
            <PlanCard 
              key={p.id} 
              plan={p} 
              user={user} 
              openPayment={openPayment} 
              openLogin={openLogin} 
              isSelected={selectedPlan === p.id} 
              onSelect={() => setSelectedPlan(p.id)} 
            />
          ))}
        </div>

        {/* Bottom note */}
        <div className="mt-10 text-center">
          <Link href="/pricing" className="inline-flex items-center gap-1.5 text-sm font-medium text-purple-600 hover:text-purple-700 hover:underline">
            查看完整套餐对比 →
          </Link>
        </div>
      </div>
    </section>
  );
}
