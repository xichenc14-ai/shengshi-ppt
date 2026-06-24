'use client';

import React, { useState } from 'react';

const FAQS = [
  { q: '支持导出和继续编辑吗？', a: '生成成功后可下载 PPTX，并在 Microsoft PowerPoint 或 WPS 中继续编辑。' },
  { q: '一次能生成多少页？', a: '免费用户每次最多 8 页，省心会员 20 页，尊享会员 40 页。' },
  { q: '专业模式和省心定制有什么区别？', a: '专业模式可手动选择主题、语气和配图；省心定制会自动分析需求并匹配参数。' },
];

const TIPS = [
  ['先写清用途', '例如“客户汇报”或“毕业答辩”，AI 才能选择合适的结构和语气。'],
  ['明确页数', '直接写“做成 10 页”，系统会优先遵循你的篇幅要求。'],
  ['说明素材用途', '告诉 AI 哪些必须保留、哪些仅供参考，内容会更稳定。'],
];

export default function FAQSection() {
  const [openIdx, setOpenIdx] = useState<number | null>(0);

  return (
    <section className="relative overflow-hidden py-16 md:py-24" id="faq">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_15%_25%,rgba(83,105,255,0.10),transparent_30%),radial-gradient(circle_at_90%_60%,rgba(177,79,255,0.11),transparent_32%)]" />
      <div className="relative mx-auto max-w-6xl px-5 md:px-8">
        <div className="mx-auto mb-10 max-w-2xl text-center md:mb-14">
          <span className="sx-section-kicker">生成小技巧 · 常见问题</span>
          <h2 className="mt-4 text-[28px] font-black tracking-[-0.035em] text-slate-950 md:text-4xl">细节说清楚，第一版就更好</h2>
          <p className="mt-4 text-[15px] leading-7 text-slate-500">几个简单的输入习惯，会明显提升大纲质量和最终成稿效果。</p>
        </div>

        <div className="grid items-start gap-7 md:grid-cols-[1fr_1fr] md:gap-8">
          <div className="sx-showcase-card rounded-[30px] p-7 sm:p-8 md:p-10">
            <div className="mb-7 flex items-center justify-between">
              <div>
                <p className="text-xs font-bold tracking-[0.16em] text-violet-500">BETTER PROMPTS</p>
                <h3 className="mt-2 text-xl font-black text-slate-900">3 个实用提示</h3>
              </div>
              <span className="sx-logo-glow" aria-hidden="true" />
            </div>
            <div className="space-y-7">
              {TIPS.map(([title, desc], index) => (
                <div key={title} className="flex gap-4">
                  <span className="sx-tip-index">{index + 1}</span>
                  <div>
                    <p className="text-[15px] font-black text-slate-800">{title}</p>
                    <p className="mt-2 text-xs leading-6 text-slate-500">{desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-4">
            {FAQS.map((faq, index) => {
              const isOpen = openIdx === index;
              return (
                <div key={faq.q} className={`sx-faq-card overflow-hidden rounded-[22px] transition-all ${isOpen ? 'sx-faq-card-open' : ''}`}>
                  <button
                    type="button"
                    onClick={() => setOpenIdx(isOpen ? null : index)}
                    className="flex w-full items-center gap-4 px-5 py-5 text-left sm:px-6 sm:py-6"
                    aria-expanded={isOpen}
                  >
                    <span className="flex-1 text-sm font-black leading-6 text-slate-800">{faq.q}</span>
                    <span className={`sx-faq-toggle ${isOpen ? 'rotate-45' : ''}`} aria-hidden="true">+</span>
                  </button>
                  {isOpen && <p className="px-5 pb-6 text-sm leading-7 text-slate-500 animate-fade-in sm:px-6">{faq.a}</p>}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}
