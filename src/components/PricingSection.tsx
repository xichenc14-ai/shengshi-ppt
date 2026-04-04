'use client';

import React from 'react';
import Link from 'next/link';
import { useAuth } from '@/lib/auth-context';

const PLANS = [
  {
    id: 'free',
    emoji: '💚',
    name: '免费体验版',
    price: '¥0',
    period: '/月',
    desc: '免费开始，感受AI的魔力',
    features: ['每月 3 次 PPT 生成', '每次最多 8 页', 'PDF 导出（带水印）', '5 个基础主题'],
    cta: '当前套餐',
    ctaDisabled: true,
  },
  {
    id: 'basic',
    emoji: '💎',
    name: '基础版',
    price: '¥19',
    period: '/月',
    desc: '职场人的效率神器',
    features: ['每月 30 次 PPT 生成', '每次最多 15 页', 'PDF + PPTX 导出（无水印）', '全部主题 + 模板', '文档上传转PPT'],
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
    desc: '重度用户的首选',
    features: ['每月 100 次 PPT 生成', '每次最多 30 页', 'AI大纲编辑器', '优先生成队列', '历史记录永久保存'],
    cta: '立即开通',
    ctaDisabled: false,
  },
];

export default function PricingSection() {
  const { user, openPayment, openLogin } = useAuth();

  const handleCta = (plan: typeof PLANS[number]) => {
    if (plan.id === 'free') return;
    if (!user) { openLogin(); return; }
    openPayment({ id: plan.id, name: plan.name, price: plan.price + plan.period });
  };

  return (
    <section className="py-16 md:py-20 bg-[#FAFBFE]" id="pricing">
      <div className="max-w-5xl mx-auto px-4 md:px-6">
        <div className="text-center mb-10">
          <h2 className="text-2xl md:text-3xl font-extrabold text-gray-900 mb-2">简单透明的定价</h2>
          <p className="text-sm text-gray-400">免费试用，满意再付费</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6 max-w-4xl mx-auto">
          {PLANS.map((p, i) => (
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
                  <span className="text-3xl font-extrabold text-gray-900">{p.price}</span>
                  <span className="text-sm text-gray-400">{p.period}</span>
                </div>
              </div>

              <ul className="space-y-2.5 mb-6">
                {p.features.map((f, j) => (
                  <li key={j} className="flex items-start gap-2 text-xs text-gray-600">
                    <span className="text-[#5B4FE9] mt-0.5 flex-shrink-0">✓</span>
                    <span>{f}</span>
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

        <div className="text-center mt-6">
          <Link href="/pricing" className="text-xs text-[#5B4FE9] hover:underline">查看完整套餐对比 →</Link>
        </div>
      </div>
    </section>
  );
}
