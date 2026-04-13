'use client';

import React, { useState } from 'react';

const FAQS = [
  { 
    q: '生成的PPT质量怎么样？', 
    a: '我们使用AI智能优化+专业设计模板，生成的PPT在内容和排版上都能达到专业水准。你可以先免费体验50积分，看看效果。',
    icon: '📊'
  },
  { 
    q: '支持导出什么格式？', 
    a: '免费版支持PPTX导出（带水印），付费版支持无水印PPTX和PDF导出。导出的文件可以在Microsoft PowerPoint和WPS中直接打开编辑。',
    icon: '📥'
  },
  { 
    q: '我的文档安全吗？', 
    a: '上传的文档仅用于本次PPT生成，不会被留存或用于其他用途。我们重视你的隐私安全，数据传输全程加密。',
    icon: '🔒'
  },
  { 
    q: '一次能生成多少页？', 
    a: '免费版每次最多8页，基础版20页，专业版40页，尊享版60页，足够覆盖大多数使用场景。',
    icon: '📑'
  },
  { 
    q: '可以编辑生成的内容吗？', 
    a: '生成前可以编辑AI大纲，生成后下载PPTX文件可以在PowerPoint/WPS中自由编辑，完全掌控你的内容。',
    icon: '✏️'
  },
  { 
    q: '支持哪些支付方式？', 
    a: '支持微信支付和支付宝，按月或按年付费。基础版¥29.9/月，专业版¥49.9/月，年付更优惠。',
    icon: '💳'
  },
  { 
    q: '积分用完了怎么办？', 
    a: '可以等待下月自动刷新（免费版每月50积分），也可以升级套餐获得更多积分。积分不会清零，会累计到下月。',
    icon: '🪙'
  },
  { 
    q: '省心定制和Gamma直通有什么区别？', 
    a: 'Gamma直通是快速生成，AI直接排版；省心定制是AI深度预处理后生成，内容质量更高，适合高质量需求（会员专属）。',
    icon: '✨'
  },
];

export default function FAQSection() {
  const [openIdx, setOpenIdx] = useState<number | null>(null);

  return (
    <section className="py-20 md:py-28 relative overflow-hidden" id="faq">
      {/* Background */}
      <div className="absolute inset-0 bg-gradient-to-b from-white via-purple-50/20 to-white" />
      
      <div className="relative max-w-3xl mx-auto px-4 md:px-6">
        {/* Header */}
        <div className="text-center mb-12">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-purple-100 rounded-full mb-4">
            <span className="text-xs font-semibold text-purple-700">有疑问？</span>
          </div>
          <h2 className="text-3xl md:text-4xl font-black text-gray-900 mb-3">
            常见问题
            <span className="bg-gradient-to-r from-purple-600 to-amber-500 bg-clip-text text-transparent"> 解答</span>
          </h2>
          <p className="text-gray-500">还有其他问题？联系我们</p>
        </div>

        {/* FAQ List */}
        <div className="space-y-3">
          {FAQS.map((f, i) => {
            const isOpen = openIdx === i;
            return (
              <div 
                key={i} 
                className={`bg-white rounded-2xl border-2 overflow-hidden transition-all duration-300 ${
                  isOpen 
                    ? 'border-purple-200 shadow-lg shadow-purple-100/30' 
                    : 'border-gray-100 hover:border-purple-100 hover:shadow-sm'
                }`}
              >
                <button
                  onClick={() => setOpenIdx(isOpen ? null : i)}
                  className="w-full flex items-center gap-4 px-5 py-4 md:px-6 md:py-5 text-left hover:bg-purple-50/30 transition-colors group"
                >
                  {/* Icon */}
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 transition-all ${
                    isOpen 
                      ? 'bg-purple-100 text-purple-600' 
                      : 'bg-gray-50 text-gray-400 group-hover:bg-purple-50 group-hover:text-purple-500'
                  }`}>
                    <span className="text-lg">{f.icon}</span>
                  </div>
                  
                  {/* Question */}
                  <span className={`flex-1 text-sm font-semibold pr-2 transition-colors ${
                    isOpen ? 'text-purple-700' : 'text-gray-800 group-hover:text-gray-900'
                  }`}>
                    {f.q}
                  </span>
                  
                  {/* Arrow */}
                  <div className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 transition-all duration-300 ${
                    isOpen 
                      ? 'bg-purple-600 text-white rotate-180' 
                      : 'bg-gray-100 text-gray-400 group-hover:bg-purple-100 group-hover:text-purple-600'
                  }`}>
                    <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                      <path d="M6 9l6 6 6-6"/>
                    </svg>
                  </div>
                </button>
                
                {isOpen && (
                  <div className="px-5 pb-5 md:px-6 animate-fade-in">
                    <div className="ml-14">
                      <p className="text-sm text-gray-500 leading-relaxed">{f.a}</p>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Contact CTA */}
        <div className="mt-12 text-center p-6 bg-gradient-to-br from-purple-50 to-white rounded-2xl border border-purple-100/50">
          <p className="text-sm text-gray-600 mb-3">还有其他问题？</p>
          <a href="#" className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-semibold text-purple-600 bg-white rounded-xl border-2 border-purple-200 hover:bg-purple-50 hover:border-purple-300 transition-all">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
            </svg>
            联系我们
          </a>
        </div>
      </div>
    </section>
  );
}
