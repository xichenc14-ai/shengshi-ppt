'use client';

import React from 'react';

const FEATURES = [
  {
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 10V3L4 14h7v7l9-11h-7z" />
      </svg>
    ),
    title: '极速生成',
    subtitle: '30秒出稿',
    desc: 'AI驱动，从输入到成品PPT最快30秒。明天的会议，今晚搞定。',
    color: 'blue'
  },
  {
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01" />
      </svg>
    ),
    title: '精美设计',
    subtitle: '50+ 专业主题',
    desc: '商务蓝、清新绿、创意紫……自动匹配最佳排版，不用懂设计也能做出好看的PPT',
    color: 'purple'
  },
  {
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
      </svg>
    ),
    title: '智能内容',
    subtitle: 'AI写大纲、填内容',
    desc: '不用对着空白页发呆。AI理解你的需求，自动生成逻辑清晰的完整内容',
    color: 'amber'
  },
  {
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
      </svg>
    ),
    title: '高保真导出',
    subtitle: 'PPTX/PDF 直接下载',
    desc: '导出就是你在网上看到的样子，字体不丢、布局不偏、16:9标准尺寸',
    color: 'green'
  },
  {
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
      </svg>
    ),
    title: '场景匹配',
    subtitle: '10大场景定制化',
    desc: '工作汇报、商业路演、教学课件……每个场景都有专属的内容结构和排版风格',
    color: 'rose'
  },
  {
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
      </svg>
    ),
    title: '隐私安全',
    subtitle: '文件即传即用',
    desc: '上传的文档不会被留存，你的数据只属于你自己',
    color: 'slate'
  },
];

const COLOR_MAP: Record<string, { bg: string; icon: string; gradient: string }> = {
  blue: { bg: 'bg-blue-50', icon: 'text-blue-600', gradient: 'from-blue-500 to-blue-400' },
  purple: { bg: 'bg-purple-50', icon: 'text-purple-600', gradient: 'from-purple-500 to-purple-400' },
  amber: { bg: 'bg-amber-50', icon: 'text-amber-600', gradient: 'from-amber-500 to-amber-400' },
  green: { bg: 'bg-green-50', icon: 'text-green-600', gradient: 'from-green-500 to-green-400' },
  rose: { bg: 'bg-rose-50', icon: 'text-rose-600', gradient: 'from-rose-500 to-rose-400' },
  slate: { bg: 'bg-slate-50', icon: 'text-slate-600', gradient: 'from-slate-500 to-slate-400' },
};

export default function FeaturesSection() {
  return (
    <section className="py-20 md:py-28 relative overflow-hidden" id="features">
      {/* Background */}
      <div className="absolute inset-0 bg-gradient-to-b from-white via-purple-50/30 to-white" />
      
      <div className="relative max-w-6xl mx-auto px-4 md:px-6">
        {/* Header */}
        <div className="text-center mb-14">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-purple-100 rounded-full mb-4">
            <span className="text-xs font-semibold text-purple-700">为什么选择我们</span>
          </div>
          <h2 className="text-3xl md:text-4xl font-black text-gray-900 mb-3">
            让PPT制作变得
            <span className="bg-gradient-to-r from-purple-600 to-amber-500 bg-clip-text text-transparent"> 简单高效</span>
          </h2>
          <p className="text-gray-500 max-w-md mx-auto">
            从此告别繁琐的排版设计，把时间留给真正重要的内容
          </p>
        </div>

        {/* Features grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {FEATURES.map((f, i) => {
            const colors = COLOR_MAP[f.color];
            return (
              <div
                key={i}
                className="group relative bg-white rounded-2xl p-6 md:p-7 border border-gray-100/80 shadow-sm hover:shadow-xl transition-all duration-500 hover:-translate-y-1 overflow-hidden"
                style={{ animationDelay: `${i * 100}ms` }}
              >
                {/* Gradient background on hover */}
                <div className={`absolute inset-0 bg-gradient-to-br ${colors.gradient} opacity-0 group-hover:opacity-[0.03] transition-opacity duration-500`} />
                
                {/* Icon */}
                <div className={`relative w-14 h-14 rounded-2xl ${colors.bg} flex items-center justify-center mb-5 transition-transform group-hover:scale-110`}>
                  <div className={colors.icon}>
                    {f.icon}
                  </div>
                  {/* Decorative dot */}
                  <div className={`absolute -top-1 -right-1 w-3 h-3 rounded-full bg-gradient-to-br ${colors.gradient} opacity-60`} />
                </div>

                {/* Content */}
                <div className="relative">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="text-lg font-bold text-gray-900">{f.title}</h3>
                    <span className={`px-2 py-0.5 ${colors.bg} ${colors.icon} rounded-full text-[10px] font-semibold`}>
                      {f.subtitle}
                    </span>
                  </div>
                  <p className="text-sm text-gray-500 leading-relaxed">{f.desc}</p>
                </div>

                {/* Bottom accent line */}
                <div className={`absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r ${colors.gradient} opacity-0 group-hover:opacity-100 transition-opacity duration-300`} />
              </div>
            );
          })}
        </div>

        {/* Bottom CTA */}
        <div className="mt-14 text-center">
          <p className="text-sm text-gray-400 mb-4">已经迫不及待了？</p>
          <button
            onClick={() => document.getElementById('hero-input')?.scrollIntoView({ behavior: 'smooth' })}
            className="inline-flex items-center gap-2 px-6 py-3 text-sm font-semibold text-white rounded-xl shadow-lg shadow-purple-200/50 hover:shadow-xl hover:shadow-purple-300/60 transition-all"
            style={{ background: 'linear-gradient(135deg, #7c3aed 0%, #8b5cf6 100%)' }}
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
