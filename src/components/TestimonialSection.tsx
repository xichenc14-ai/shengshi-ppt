'use client';

import React from 'react';

const TESTIMONIALS = [
  { name: '张经理', role: '互联网公司', text: '以前做月报PPT要花2小时，现在5分钟搞定，质量比我自己做的还好' },
  { name: '李老师', role: '高中数学', text: '教学课件一键生成，排版清晰，学生上课注意力都集中了' },
  { name: '小王', role: '应届毕业生', text: '毕业答辩PPT帮了大忙，导师都说做得挺专业的' },
  { name: '陈总监', role: '市场部', text: '商业方案PPT的框架逻辑非常清晰，帮了我们市场部大忙' },
];

const STATS = [
  { value: '30秒', label: '平均生成时间' },
  { value: '50+', label: '精选主题' },
  { value: '4种', label: '配图模式' },
];

export default function TestimonialSection() {
  return (
    <section className="py-20 md:py-24 bg-white">
      <div className="max-w-5xl mx-auto px-4 md:px-6">
        <div className="text-center mb-10">
          <h2 className="text-2xl md:text-3xl font-extrabold text-gray-900 mb-2">用户好评</h2>
          <p className="text-sm text-gray-400">内测用户真实反馈</p>
        </div>

        {/* Stats */}
        <div className="flex flex-wrap items-center justify-center gap-6 md:gap-12 mb-10">
          {STATS.map((s, i) => (
            <div key={i} className="text-center">
              <div className="text-2xl md:text-3xl font-extrabold text-[#5B4FE9]">{s.value}</div>
              <div className="text-xs text-gray-400 mt-0.5">{s.label}</div>
            </div>
          ))}
        </div>

        {/* Testimonials */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {TESTIMONIALS.map((t, i) => (
            <div key={i} className="bg-[#FAFBFE] border border-gray-100 rounded-2xl p-5 hover:border-[#EDE9FE] hover:shadow-sm transition-all">
              <p className="text-sm text-gray-700 mb-3 leading-relaxed">&ldquo;{t.text}&rdquo;</p>
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#5B4FE9] to-[#8B5CF6] flex items-center justify-center text-white text-xs font-bold">
                  {t.name.charAt(0)}
                </div>
                <div>
                  <p className="text-xs font-semibold text-gray-800">{t.name}</p>
                  <p className="text-[10px] text-gray-400">{t.role}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
