'use client';

import React from 'react';

const STEPS = [
  {
    num: '01',
    title: '描述需求',
    icon: '✍️',
    desc: '输入一句话描述你的PPT需求，比如「帮我做一份Q1季度销售汇报」。也可以直接上传Word/PDF文档，AI自动提取内容。',
  },
  {
    num: '02',
    title: '确认大纲',
    icon: '📋',
    desc: 'AI自动生成PPT大纲，你可以查看、编辑、调整顺序。选一个喜欢的主题风格，点击生成。',
  },
  {
    num: '03',
    title: '下载PPT',
    icon: '📥',
    desc: '30秒后，一份完整的PPT就做好了。直接下载PPTX或PDF，在PowerPoint/WPS里打开就能用。',
  },
];

export default function ProcessSection() {
  return (
    <section className="py-16 md:py-20 bg-white">
      <div className="max-w-4xl mx-auto px-4 md:px-6">
        <div className="text-center mb-12">
          <h2 className="text-2xl md:text-3xl font-extrabold text-gray-900 mb-2">三步搞定，就这么简单</h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 md:gap-4 relative">
          {/* Connecting line (desktop only) */}
          <div className="hidden md:block absolute top-16 left-[20%] right-[20%] h-0.5 bg-gradient-to-r from-[#5B4FE9]/30 via-[#8B5CF6]/30 to-[#5B4FE9]/30" />

          {STEPS.map((s, i) => (
            <div key={i} className="text-center relative">
              <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-[#EDE9FE] to-[#DDD6FE] flex items-center justify-center text-2xl shadow-lg shadow-purple-100/50 relative z-10">
                {s.icon}
              </div>
              <div className="text-[10px] font-bold text-[#C4B5FD] tracking-widest mb-1">STEP {s.num}</div>
              <h3 className="text-base font-bold text-gray-900 mb-2">{s.title}</h3>
              <p className="text-xs text-gray-400 leading-relaxed max-w-xs mx-auto">{s.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
