'use client';

import React from 'react';
import { useAuth } from '@/lib/auth-context';

const PLANS = [
  {
    id: 'free',
    emoji: '💚',
    name: '免费体验版',
    price: '¥0',
    period: '/月',
    annualPrice: null,
    desc: '免费开始，感受AI的魔力',
    features: [
      { text: '每月 3 次 PPT 生成', included: true },
      { text: '每次最多 8 页', included: true },
      { text: 'PDF 导出（带水印）', included: true },
      { text: '5 个基础主题', included: true },
      { text: 'PPTX 导出', included: false },
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
    price: '¥19',
    period: '/月',
    annualPrice: '¥15/月',
    desc: '职场人的效率神器',
    features: [
      { text: '每月 30 次 PPT 生成', included: true },
      { text: '每次最多 15 页', included: true },
      { text: 'PDF + PPTX 导出（无水印）', included: true },
      { text: '全部主题 + 模板', included: true },
      { text: '文档上传转PPT', included: true },
      { text: 'AI大纲编辑器', included: false },
      { text: '优先生成队列', included: false },
      { text: '历史记录永久保存', included: false },
    ],
    popular: true,
    cta: '立即开通',
    ctaDisabled: false,
  },
  {
    id: 'pro',
    emoji: '👑',
    name: '专业版',
    price: '¥49',
    period: '/月',
    annualPrice: '¥39/月',
    desc: '重度用户的首选',
    features: [
      { text: '每月 100 次 PPT 生成', included: true },
      { text: '每次最多 30 页', included: true },
      { text: 'AI大纲编辑器', included: true },
      { text: '优先生成队列', included: true },
      { text: '历史记录永久保存', included: true },
      { text: '全格式导出（PDF/PPTX/PNG）', included: true },
      { text: '专属客服支持', included: true },
    ],
    cta: '立即开通',
    ctaDisabled: false,
  },
];

export default function PricingPage() {
  const { user, openPayment, openLogin } = useAuth();

  const handleCta = (plan: typeof PLANS[number]) => {
    if (plan.id === 'free') return;
    if (!user) { openLogin(); return; }
    openPayment({ id: plan.id, name: plan.name, price: plan.price + plan.period });
  };

  return (
    <div className="min-h-screen bg-[#FAFBFE]">
      {/* Hero */}
      <section className="pt-16 pb-8 text-center">
        <h1 className="text-2xl md:text-3xl font-extrabold text-gray-900 mb-2">简单透明的定价</h1>
        <p className="text-sm text-gray-400">免费试用，满意再付费</p>
      </section>

      {/* Plans */}
      <section className="max-w-5xl mx-auto px-4 pb-8">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6">
          {PLANS.map((p, i) => (
            <div
              key={i}
              className={`relative bg-white rounded-2xl p-6 border transition-all duration-300 hover:-translate-y-1 ${
                p.popular
                  ? 'border-[#5B4FE9] shadow-xl shadow-purple-200/30 md:scale-105'
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
                  <span className="text-3xl font-extrabold text-gray-900">{p.price}</span>
                  <span className="text-sm text-gray-400">{p.period}</span>
                </div>
                {p.annualPrice && (
                  <p className="text-[10px] text-[#5B4FE9] mt-1">年付 {p.annualPrice}，省20%</p>
                )}
              </div>

              <ul className="space-y-2 mb-6">
                {p.features.map((f, j) => (
                  <li key={j} className={`flex items-start gap-2 text-xs ${f.included ? 'text-gray-600' : 'text-gray-300'}`}>
                    <span className={`mt-0.5 flex-shrink-0 ${f.included ? 'text-[#5B4FE9]' : 'text-gray-200'}`}>
                      {f.included ? '✓' : '✕'}
                    </span>
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
                    ? 'bg-gradient-to-r from-[#5B4FE9] to-[#8B5CF6] text-white hover:shadow-lg hover:shadow-purple-300/40'
                    : 'bg-white text-[#5B4FE9] border-2 border-[#EDE9FE] hover:bg-[#F5F3FF]'
                }`}
              >
                {p.cta}
              </button>
            </div>
          ))}
        </div>
      </section>

      {/* FAQ */}
      <section className="max-w-3xl mx-auto px-4 py-12">
        <h2 className="text-xl font-bold text-gray-900 text-center mb-6">常见问题</h2>
        <div className="space-y-3">
          {[
            { q: '免费版有什么限制？', a: '免费版每月可生成3次PPT，每次最多8页，仅支持PDF导出（带水印）。足够体验AI生成PPT的效果。' },
            { q: '可以随时取消订阅吗？', a: '可以，随时取消不会影响当前周期的使用。取消后下个计费周期自动降为免费版。' },
            { q: '支持哪些支付方式？', a: '支持微信支付和支付宝。按月或按年付费，年付更优惠。' },
            { q: '积分和订阅有什么区别？', a: '积分按次扣除，用完可充值。订阅是包月套餐，每月固定次数，更划算。两者互不冲突。' },
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
