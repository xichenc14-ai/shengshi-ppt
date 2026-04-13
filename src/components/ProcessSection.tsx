'use client';

import React from 'react';

const STEPS = [
  {
    num: '01',
    title: '描述需求',
    icon: (
      <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
      </svg>
    ),
    desc: '输入一句话描述你的PPT需求，或直接上传Word/PDF文档，AI自动提取内容生成。',
    color: 'from-blue-500 to-cyan-400',
    bg: 'bg-blue-50',
    iconColor: 'text-blue-600',
  },
  {
    num: '02',
    title: '确认大纲',
    icon: (
      <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
      </svg>
    ),
    desc: 'AI自动生成PPT大纲，你可以查看、编辑、调整顺序。选一个喜欢的主题风格，点击生成。',
    color: 'from-purple-500 to-purple-400',
    bg: 'bg-purple-50',
    iconColor: 'text-purple-600',
  },
  {
    num: '03',
    title: '下载PPT',
    icon: (
      <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
      </svg>
    ),
    desc: '30秒后，一份完整的PPT就做好了。直接下载PPTX或PDF，在PowerPoint/WPS里打开就能用。',
    color: 'from-emerald-500 to-emerald-400',
    bg: 'bg-emerald-50',
    iconColor: 'text-emerald-600',
  },
];

export default function ProcessSection() {
  return (
    <section className="py-20 md:py-28 relative overflow-hidden" id="how-it-works">
      {/* Background */}
      <div className="absolute inset-0 bg-gradient-to-b from-white via-purple-50/20 to-white" />
      
      {/* Decorative */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-purple-100/20 rounded-full blur-3xl" />
      
      <div className="relative max-w-5xl mx-auto px-4 md:px-6">
        {/* Header */}
        <div className="text-center mb-14">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-purple-100 rounded-full mb-4">
            <span className="text-xs font-semibold text-purple-700">简单高效</span>
          </div>
          <h2 className="text-3xl md:text-4xl font-black text-gray-900 mb-3">
            三步搞定
            <span className="bg-gradient-to-r from-purple-600 to-amber-500 bg-clip-text text-transparent"> 专业PPT</span>
          </h2>
          <p className="text-gray-500 max-w-md mx-auto">告别繁琐的排版设计，把时间留给真正重要的内容</p>
        </div>

        {/* Steps */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 md:gap-8 relative">
          {/* Connecting line */}
          <div className="hidden md:block absolute top-14 left-[18%] right-[18%] h-0.5 bg-gradient-to-r from-blue-300 via-purple-300 to-emerald-300 opacity-60" />

          {STEPS.map((s, i) => (
            <div key={i} className="text-center relative group">
              {/* Step card */}
              <div className="relative bg-white rounded-3xl p-7 md:p-8 border border-gray-100 shadow-sm hover:shadow-xl transition-all duration-500 hover:-translate-y-2 overflow-hidden">
                {/* Number badge */}
                <div className={`absolute -top-1 -right-1 px-3 py-1 bg-gradient-to-br ${s.color} text-white text-[10px] font-black rounded-bl-xl rounded-tr-3xl`}>
                  {s.num}
                </div>
                
                {/* Icon */}
                <div className={`w-16 h-16 mx-auto mb-5 rounded-2xl ${s.bg} flex items-center justify-center shadow-lg transition-transform group-hover:scale-110`}>
                  <div className={s.iconColor}>
                    {s.icon}
                  </div>
                </div>
                
                {/* Content */}
                <h3 className="text-lg font-bold text-gray-900 mb-2">{s.title}</h3>
                <p className="text-sm text-gray-500 leading-relaxed">{s.desc}</p>
                
                {/* Bottom arrow (desktop) */}
                {i < STEPS.length - 1 && (
                  <div className="hidden md:block absolute -right-5 top-1/2 -translate-y-1/2 z-10">
                    <div className="w-10 h-10 rounded-full bg-white shadow-lg border border-gray-100 flex items-center justify-center text-gray-300">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </div>
                  </div>
                )}
                
                {/* Hover gradient overlay */}
                <div className={`absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r ${s.color} opacity-0 group-hover:opacity-100 transition-opacity duration-300`} />
              </div>
            </div>
          ))}
        </div>

        {/* CTA */}
        <div className="mt-14 text-center">
          <button
            onClick={() => document.getElementById('hero-input')?.scrollIntoView({ behavior: 'smooth' })}
            className="inline-flex items-center gap-2.5 px-7 py-3.5 text-sm font-bold text-white rounded-2xl shadow-lg transition-all hover:shadow-xl hover:-translate-y-0.5"
            style={{ 
              background: 'linear-gradient(135deg, #7c3aed 0%, #8b5cf6 100%)',
              boxShadow: '0 8px 24px rgba(139, 92, 246, 0.35)'
            }}
          >
            <span>立即开始制作</span>
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
            </svg>
          </button>
        </div>
      </div>
    </section>
  );
}
