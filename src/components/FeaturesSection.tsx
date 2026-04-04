'use client';

import React from 'react';

const FEATURES = [
  { icon: '⚡', title: '极速生成', subtitle: '30秒出稿', desc: 'AI驱动，从输入到成品PPT最快30秒。明天的会议，今晚搞定。' },
  { icon: '🎨', title: '精美设计', subtitle: '13+ 主题风格', desc: '商务蓝、清新绿、创意紫……自动匹配最佳排版，不用懂设计也能做出好看的PPT' },
  { icon: '🧠', title: '智能内容', subtitle: 'AI写大纲、填内容', desc: '不用对着空白页发呆。AI理解你的需求，自动生成逻辑清晰的完整内容' },
  { icon: '📥', title: '高保真导出', subtitle: 'PPTX/PDF 直接下载', desc: '导出就是你在网上看到的样子，字体不丢、布局不偏、16:9标准尺寸' },
  { icon: '🎯', title: '场景匹配', subtitle: '8大场景定制化', desc: '工作汇报、商业路演、教学课件……每个场景都有专属的内容结构和排版风格' },
  { icon: '🔒', title: '隐私安全', subtitle: '文件即传即用', desc: '上传的文档不会被留存，你的数据只属于你自己' },
];

export default function FeaturesSection() {
  return (
    <section className="py-16 md:py-20 bg-[#FAFBFE]" id="features">
      <div className="max-w-5xl mx-auto px-4 md:px-6">
        <div className="text-center mb-10">
          <h2 className="text-2xl md:text-3xl font-extrabold text-gray-900 mb-2">为什么选择省心PPT？</h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6">
          {FEATURES.map((f, i) => (
            <div
              key={i}
              className="bg-white border border-gray-100 rounded-2xl p-6 hover:border-[#EDE9FE] hover:shadow-lg hover:shadow-purple-100/20 hover:-translate-y-1 transition-all duration-300"
            >
              <div className="text-3xl mb-3">{f.icon}</div>
              <h3 className="text-base font-bold text-gray-900 mb-0.5">{f.title}</h3>
              <p className="text-xs font-semibold text-[#5B4FE9] mb-2">{f.subtitle}</p>
              <p className="text-xs text-gray-400 leading-relaxed">{f.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
