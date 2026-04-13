'use client';

import React from 'react';

const TESTIMONIALS = [
  { name: '张经理', role: '互联网公司', text: '以前做月报PPT要花2小时，现在5分钟搞定，质量比我自己做的还好', avatar: '👨‍💼' },
  { name: '李老师', role: '高中数学', text: '教学课件一键生成，排版清晰，学生上课注意力都集中了', avatar: '👩‍🏫' },
  { name: '小王', role: '应届毕业生', text: '毕业答辩PPT帮了大忙，导师都说做得挺专业的', avatar: '👨‍🎓' },
  { name: '陈总监', role: '市场部', text: '商业方案PPT的框架逻辑非常清晰，帮了我们市场部大忙', avatar: '👩‍💻' },
];

const STATS = [
  { value: '30秒', label: '平均生成时间', icon: '⚡' },
  { value: '50+', label: '精选主题', icon: '🎨' },
  { value: '4种', label: '配图模式', icon: '🖼️' },
  { value: '10万+', label: '用户信赖', icon: '👥' },
];

export default function TestimonialSection() {
  return (
    <section className="py-20 md:py-28 relative overflow-hidden" id="testimonials">
      {/* Background */}
      <div className="absolute inset-0 bg-gradient-to-b from-white via-purple-50/30 to-white" />
      
      {/* Decorative elements */}
      <div className="absolute top-20 left-10 w-64 h-64 bg-purple-200/20 rounded-full blur-3xl" />
      <div className="absolute bottom-20 right-10 w-48 h-48 bg-amber-200/20 rounded-full blur-3xl" />
      
      <div className="relative max-w-6xl mx-auto px-4 md:px-6">
        {/* Header */}
        <div className="text-center mb-12">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-purple-100 rounded-full mb-4">
            <span className="text-xs font-semibold text-purple-700">真实反馈</span>
          </div>
          <h2 className="text-3xl md:text-4xl font-black text-gray-900 mb-3">
            用户
            <span className="bg-gradient-to-r from-purple-600 to-amber-500 bg-clip-text text-transparent"> 好评如潮</span>
          </h2>
          <p className="text-gray-500">来自各行各业的真实用户反馈</p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-14">
          {STATS.map((s, i) => (
            <div key={i} className="text-center p-5 bg-white rounded-2xl border border-gray-100 shadow-sm hover:shadow-md hover:border-purple-100 transition-all">
              <div className="text-2xl mb-1">{s.icon}</div>
              <div className="text-2xl md:text-3xl font-black bg-gradient-to-r from-purple-600 to-purple-500 bg-clip-text text-transparent">
                {s.value}
              </div>
              <div className="text-xs text-gray-400 mt-0.5">{s.label}</div>
            </div>
          ))}
        </div>

        {/* Testimonials */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {TESTIMONIALS.map((t, i) => (
            <div 
              key={i} 
              className="group relative bg-white rounded-2xl p-6 md:p-7 border border-gray-100 shadow-sm hover:shadow-xl hover:border-purple-200 transition-all duration-300 overflow-hidden"
            >
              {/* Quote decoration */}
              <div className="absolute top-4 right-4 text-6xl text-purple-100 font-serif leading-none select-none">"</div>
              
              {/* Content */}
              <div className="relative">
                {/* Stars */}
                <div className="flex items-center gap-0.5 mb-4">
                  {[...Array(5)].map((_, j) => (
                    <svg key={j} className="w-4 h-4 text-amber-400" fill="currentColor" viewBox="0 0 20 20">
                      <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                    </svg>
                  ))}
                </div>
                
                {/* Quote */}
                <p className="text-sm text-gray-600 mb-5 leading-relaxed relative z-10">
                  &ldquo;{t.text}&rdquo;
                </p>
                
                {/* Author */}
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-100 to-purple-50 flex items-center justify-center text-xl">
                    {t.avatar}
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-gray-900">{t.name}</p>
                    <p className="text-xs text-gray-400">{t.role}</p>
                  </div>
                </div>
              </div>
              
              {/* Bottom accent */}
              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r from-purple-300 via-purple-400 to-amber-300 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
