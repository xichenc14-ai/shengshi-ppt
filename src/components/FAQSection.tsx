'use client';

import React, { useState } from 'react';

const FAQS = [
  { q: '生成的PPT质量怎么样？', a: '我们使用AI智能优化+专业设计模板，生成的PPT在内容和排版上都能达到专业水准。你可以先免费体验3次，看看效果。' },
  { q: '支持导出什么格式？', a: '免费版支持PDF导出，付费版支持PPTX和PDF导出。导出的PPTX文件可以在Microsoft PowerPoint和WPS中直接打开编辑。' },
  { q: '我的文档安全吗？', a: '上传的文档仅用于本次PPT生成，不会被留存或用于其他用途。我们重视你的隐私安全。' },
  { q: '一次能生成多少页？', a: '免费版每次最多8页，基础版15页，专业版30页，足够覆盖大多数使用场景。' },
  { q: '可以编辑生成的内容吗？', a: '生成前可以编辑AI大纲，生成后下载PPTX文件可以在PowerPoint/WPS中自由编辑。' },
  { q: '支持哪些支付方式？', a: '支持微信支付和支付宝，按月或按年付费。基础版¥29/月，专业版¥59/月，年付更优惠。' },
];

export default function FAQSection() {
  const [openIdx, setOpenIdx] = useState<number | null>(null);

  return (
    <section className="py-16 md:py-20 bg-[#FAFBFE]">
      <div className="max-w-3xl mx-auto px-4 md:px-6">
        <div className="text-center mb-10">
          <h2 className="text-2xl md:text-3xl font-extrabold text-gray-900 mb-2">常见问题</h2>
        </div>

        <div className="space-y-2">
          {FAQS.map((f, i) => (
            <div key={i} className="bg-white border border-gray-100 rounded-xl overflow-hidden">
              <button
                onClick={() => setOpenIdx(openIdx === i ? null : i)}
                className="w-full flex items-center justify-between px-5 py-4 text-left hover:bg-gray-50/50 transition-colors"
              >
                <span className="text-sm font-semibold text-gray-800 pr-4">{f.q}</span>
                <span className={`text-gray-400 text-lg flex-shrink-0 transition-transform duration-200 ${openIdx === i ? 'rotate-45' : ''}`}>+</span>
              </button>
              {openIdx === i && (
                <div className="px-5 pb-4 animate-fade-in">
                  <p className="text-sm text-gray-500 leading-relaxed">{f.a}</p>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
