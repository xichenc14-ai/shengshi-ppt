'use client';

import React from 'react';
import Link from 'next/link';
import { useAuth } from '@/lib/auth-context';

// ===== 积分与定价体系 =====
// Gamma订阅：4000积分/月 = 150元（1积分≈0.0375元）
// 非会员：50积分/月，8页，无收费图
// 普通会员：500积分/月，20页，普通图（pictographic+pexels，0 credits）
// 高级会员：1000积分/月，40页，高级图（imagen-3-flash，2 credits/图）
// 尊享会员：2000积分/月，60页，权益全开（含flux-kontext-pro，20 credits/图）

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
  imageDesc: string;
  prices: { monthly: number; annual: number; annualMonthly: number; annualSave: string };
  features: PlanFeature[];
  cta: string;
  ctaDisabled: boolean;
  pptCount10Pages: number;
  costPerPage: string;
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
    imageDesc: '仅支持 pictographic 免费插图',
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
      { text: '优先生成队列', included: false },
      { text: '历史记录永久保存', included: false },
    ],
    cta: '当前方案',
    ctaDisabled: true,
    pptCount10Pages: 6,  // 50÷8≈6份
    costPerPage: '免费',
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
    imageDesc: 'pictographic + pexels + imagen-3-flash',
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
      { text: '优先生成队列', included: false },
      { text: '历史记录永久保存', included: false },
    ],
    cta: '立即开通',
    ctaDisabled: false,
    pptCount10Pages: 62,  // 500÷8=62份
    costPerPage: '¥0.06',
  },
  {
    id: 'pro',
    emoji: '👑',
    name: '高级会员',
    desc: '重度用户的首选方案',
    credits: 1000,
    maxPages: 40,
    imageTier: '高级图',
    imageDesc: '含 imagen-3-flash + flux-kontext-fast',
    prices: { monthly: 49.9, annual: 499, annualMonthly: 41.6, annualSave: '省100' },
    features: [
      { text: '每月 1000 积分', included: true, highlight: true },
      { text: '每次最多 40 页', included: true },
      { text: 'AI大纲编辑器', included: true, highlight: true },
      { text: '高级AI生图', included: true, highlight: true },
      { text: '优先生成队列', included: true },
      { text: '全格式导出', included: true },
      { text: '文档上传转PPT', included: true },
      { text: '尊享AI图（20积分/图）', included: false },
      { text: '历史记录永久保存', included: false },
    ],
    cta: '立即开通',
    ctaDisabled: false,
    pptCount10Pages: 125,  // 1000÷8=125份
    costPerPage: '¥0.05',
  },
  {
    id: 'vip',
    emoji: '🏆',
    name: '尊享会员',
    desc: '权益全开，无限可能',
    credits: 2000,
    maxPages: 60,
    imageTier: '权益全开',
    imageDesc: '所有图片渠道 + 全部AI模型',
    prices: { monthly: 99.9, annual: 999, annualMonthly: 83.3, annualSave: '省199' },
    features: [
      { text: '每月 2000 积分', included: true, highlight: true },
      { text: '每次最多 60 页', included: true, highlight: true },
      { text: '尊享AI图（20积分/图）', included: true, highlight: true },
      { text: '权益全开', included: true, highlight: true },
      { text: '优先生成队列', included: true },
      { text: '历史记录永久保存', included: true },
      { text: '专属客服', included: true },
      { text: '全格式导出', included: true },
    ],
    cta: '立即开通',
    ctaDisabled: false,
    pptCount10Pages: 250,  // 2000÷8=250份
    costPerPage: '¥0.05',
  },
];

// 图片积分对照表
const IMAGE_CREDIT_TABLE = [
  { mode: '无图纯净版', source: 'noImages', credits: '0', note: '纯文字+图标' },
  { mode: '免费插图', source: 'pictographic', credits: '0', note: '推荐默认，效果最好' },
  { mode: '免费搜索图', source: 'webFreeToUseCommercially', credits: '0', note: '商用免费图' },
  { mode: 'Pexels高质量图', source: 'pexels', credits: '0', note: '高质量摄影图' },
  { mode: '普通AI图', source: 'aiGenerated + imagen-3-flash', credits: '2/张', note: '💎普通会员起' },
  { mode: '高级AI图', source: 'aiGenerated + flux-kontext-fast', credits: '2/张', note: '👑高级会员起' },
  { mode: '尊享AI图', source: 'aiGenerated + flux-kontext-pro', credits: '20/张', note: '🏆尊享会员专属' },
];

function PlanCard({ plan, user, openPayment, openLogin, isSelected, onSelect }: { plan: Plan; user: any; openPayment: any; openLogin: any; isSelected?: boolean; onSelect?: () => void }) {
  const [isAnnual, setIsAnnual] = React.useState(false);
  const currentPrice = isAnnual ? plan.prices.annualMonthly : plan.prices.monthly;
  const period = isAnnual ? '/月 (年付)' : '/月';

  const handleCta = () => {
    if (plan.id === 'free') return;
    if (!user) { openLogin(); return; }
    // 先选中的当前套餐
    onSelect?.();
    // 用 setTimeout 确保 state 更新后再打开 PaymentModal
    setTimeout(() => {
      openPayment({
        id: plan.id,
        name: plan.name,
        price: currentPrice > 0 ? `¥${currentPrice}` : '免费',
        billing: isAnnual ? 'annual' : 'monthly',
        credits: plan.credits,
      });
    }, 0);
  };

  return (
    <div
      onClick={onSelect}
      className={`relative bg-white rounded-2xl p-6 border-2 transition-all duration-200 cursor-pointer hover:-translate-y-1 active:scale-[0.99] ${
        isSelected
          ? 'border-[#5B4FE9] shadow-xl shadow-purple-200/30 ring-4 ring-purple-100'
          : plan.popular
            ? 'border-[#5B4FE9] shadow-xl shadow-purple-200/30 md:scale-[1.02]'
            : 'border-gray-100 hover:border-[#EDE9FE] hover:shadow-lg'
      }`}
    >
      {plan.popular && (
        <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-0.5 bg-gradient-to-r from-[#5B4FE9] to-[#8B5CF6] text-white text-[10px] font-bold rounded-full shadow-md">
          {plan.badge || '推荐'}
        </div>
      )}

      <div className="text-center mb-5">
        <div className="text-3xl mb-2">{plan.emoji}</div>
        <h3 className="text-base font-bold text-gray-900">{plan.name}</h3>
        <p className="text-xs text-gray-400 mt-0.5">{plan.desc}</p>

        {/* Credits badge */}
        <div className="inline-flex items-center gap-1 mt-2 px-3 py-1 bg-amber-50 rounded-full">
          <span className="text-xs">🪙</span>
          <span className="text-xs font-bold text-amber-600">{plan.credits} 积分/月</span>
        </div>

        {/* Price toggle */}
        {!plan.ctaDisabled && (
          <div className="flex items-center justify-center gap-2 mt-3 mb-1">
            <button
              onClick={() => setIsAnnual(false)}
              className={`text-[11px] px-3 py-1 rounded-full transition-all active:scale-95 ${
                !isAnnual ? 'bg-[#5B4FE9] text-white shadow-sm' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
              }`}
            >
              月付
            </button>
            <button
              onClick={() => setIsAnnual(true)}
              className={`text-[11px] px-3 py-1 rounded-full transition-all active:scale-95 ${
                isAnnual ? 'bg-[#5B4FE9] text-white shadow-sm' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
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

        {/* Price display */}
        <div className="mt-2">
          {currentPrice > 0 ? (
            <>
              <span className="text-3xl font-extrabold text-gray-900">¥{currentPrice}</span>
              <span className="text-sm text-gray-400">{period}</span>
            </>
          ) : (
            <span className="text-3xl font-extrabold text-gray-900">免费</span>
          )}
        </div>
        {isAnnual && !plan.ctaDisabled && currentPrice > 0 && (
          <p className="text-[10px] mt-1 text-[#5B4FE9]">年付 ¥{plan.prices.annual}，平均每月仅 ¥{plan.prices.annualMonthly}</p>
        )}
      </div>

      {/* Quick specs */}
      <div className="flex items-center justify-center gap-3 mb-3 py-2 bg-[#FAFBFE] rounded-xl">
        <div className="text-center">
          <p className="text-sm font-bold text-gray-800">{plan.maxPages}页</p>
          <p className="text-[9px] text-gray-400">单次上限</p>
        </div>
        <div className="w-px h-6 bg-gray-200" />
        <div className="text-center">
          <p className="text-xs font-semibold text-gray-800">{plan.imageTier}</p>
          <p className="text-[9px] text-gray-400">图片方案</p>
        </div>
      </div>

      {/* 参考数据：纯净模式（每页1积分，图片0积分） */}
      <div className="flex items-center justify-center gap-3 mb-4 py-2 px-3 bg-gradient-to-r from-amber-50 to-orange-50 rounded-xl border border-amber-100/50">
        <div className="text-center">
          <p className="text-base font-extrabold text-amber-600">~{plan.pptCount10Pages}<span className="text-[10px] font-normal ml-0.5">份</span></p>
          <p className="text-[9px] text-gray-400">每月8页PPT约</p>
        </div>
        <div className="w-px h-6 bg-amber-200" />
        <div className="text-center">
          <p className="text-base font-extrabold text-amber-600">{plan.costPerPage}<span className="text-[10px] font-normal ml-0.5">/页</span></p>
          <p className="text-[9px] text-gray-400">纯净模式</p>
        </div>
      </div>

      {/* Features */}
      <ul className="space-y-2 mb-5">
        {plan.features.map((f, j) => (
          <li key={j} className={`flex items-start gap-2 text-xs ${f.included ? 'text-gray-600' : 'text-gray-300'}`}>
            <span className={`mt-0.5 flex-shrink-0 ${f.included ? '' : 'text-gray-200'}`}
              style={f.included ? { color: '#5B4FE9' } : undefined}>
              {f.included ? (f.highlight ? '★' : '✓') : '✕'}
            </span>
            <span className={f.highlight && f.included ? 'font-medium text-gray-800' : ''}>{f.text}</span>
          </li>
        ))}
      </ul>

      <button
        onClick={handleCta}
        disabled={plan.ctaDisabled}
        className={`w-full py-2.5 rounded-xl text-sm font-semibold transition-all active:scale-[0.98] ${
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
  const [selectedPlan, setSelectedPlan] = React.useState<string | null>(null);

  return (
    <div className="min-h-screen bg-[#FAFBFE]">
      {/* Hero */}
      <section className="pt-16 pb-6 text-center">
        <h1 className="text-2xl md:text-3xl font-extrabold text-gray-900 mb-2">简单透明的定价</h1>
        <p className="text-sm text-gray-400">按积分计费，用多少扣多少 · 每页约1-3积分</p>
      </section>

      {/* Plans */}
      <section className="max-w-5xl mx-auto px-4 pb-8">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {PLANS.map((p) => (
            <PlanCard key={p.id} plan={p} user={user} openPayment={openPayment} openLogin={openLogin} isSelected={selectedPlan === p.id} onSelect={() => setSelectedPlan(p.id)} />
          ))}
        </div>
      </section>

      {/* Image Credits Table */}
      <section className="max-w-4xl mx-auto px-4 py-10">
        <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm">
          <h2 className="text-lg font-bold text-gray-900 mb-1 text-center">🖼️ 图片积分消耗对照</h2>
          <p className="text-xs text-gray-400 mb-5 text-center">不同图片方案对应不同的积分消耗</p>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="text-left py-2 px-3 text-xs font-semibold text-gray-500">图片方案</th>
                  <th className="text-left py-2 px-3 text-xs font-semibold text-gray-500">渠道</th>
                  <th className="text-center py-2 px-3 text-xs font-semibold text-gray-500">积分</th>
                  <th className="text-left py-2 px-3 text-xs font-semibold text-gray-500">说明</th>
                  <th className="text-center py-2 px-3 text-xs font-semibold text-gray-500">可用等级</th>
                </tr>
              </thead>
              <tbody>
                {IMAGE_CREDIT_TABLE.map((row, i) => (
                  <tr key={i} className="border-b border-gray-50 hover:bg-[#FAFBFE] transition-colors">
                    <td className="py-2.5 px-3 font-medium text-gray-800">{row.mode}</td>
                    <td className="py-2.5 px-3 text-xs text-gray-500 font-mono">{row.source}</td>
                    <td className="py-2.5 px-3 text-center">
                      <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-bold ${
                        row.credits === '0' ? 'bg-green-50 text-green-600' : row.credits === '2/张' ? 'bg-blue-50 text-blue-600' : 'bg-amber-50 text-amber-600'
                      }`}>
                        {row.credits === '0' ? '免费' : row.credits}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-xs text-gray-400">{row.note}</td>
                    <td className="py-2.5 px-3 text-center text-xs text-gray-500">{row.note.includes('推荐') ? '全部' : row.note.includes('💎') ? '💎+' : row.note.includes('👑') ? '👑+' : row.note.includes('🏆') ? '🏆' : '全部'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-[10px] text-gray-300 mt-3 text-center">* 图片积分消耗与 Gamma API 官方扣费 1:1 对应，按实际生成图片数量计算</p>
        </div>
      </section>

      {/* FAQ */}
      <section className="max-w-3xl mx-auto px-4 py-12">
        <h2 className="text-xl font-bold text-gray-900 text-center mb-6">常见问题</h2>
        <div className="space-y-3">
          {[
            { q: '积分是什么？怎么用？', a: '积分是省心PPT的通用计费单位。每次生成PPT会消耗积分，消耗量 = 基础积分（约1积分/页）+ 图片积分（按所选图片方案计算）。免费插图0积分，AI生图2-20积分/张。' },
            { q: '免费版有什么限制？', a: '免费版每月50积分，每次最多8页，仅支持免费插图模式（pictographic），导出PPTX带水印。足够体验AI生成PPT的效果。' },
            { q: '积分用完了怎么办？', a: '可以等待下月自动刷新，也可以升级套餐获得更多积分。积分不会清零，会累计到下月。' },
            { q: '月付和年付有什么区别？', a: '功能完全一样，年付更优惠。普通会员年付¥299（省60），高级年付¥499（省100），尊享年付¥999（省199）。' },
            { q: '可以随时取消订阅吗？', a: '可以，随时取消不影响当前周期使用。取消后下个计费周期自动降为免费版。' },
            { q: '普通会员和高级会员的区别？', a: '核心区别在图片方案和页数上限。普通会员支持pictographic+pexels+imagen-3-flash（2积分/图），高级会员额外支持flux-kontext-fast等高级AI图模型。尊享会员全部解锁。' },
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
