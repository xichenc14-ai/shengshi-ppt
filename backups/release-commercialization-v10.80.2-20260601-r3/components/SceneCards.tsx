'use client';

import React from 'react';

const SCENES = [
  { emoji: '📊', title: '工作汇报', desc: '周报、月报、季度总结，一键生成专业汇报' },
  { emoji: '💼', title: '商业路演', desc: '融资BP、产品推介、招商方案，逻辑清晰' },
  { emoji: '🎓', title: '教学课件', desc: '课程大纲、培训材料、信息讲解，排版规范' },
  { emoji: '📑', title: '毕业答辩', desc: '论文答辩、课题汇报，重点突出、顺利过关' },
  { emoji: '🎉', title: '活动策划', desc: '年会、发布会、品牌活动，创意满分' },
  { emoji: '🚀', title: '产品发布', desc: '新品推介、功能展示，让产品自己说话' },
  { emoji: '🏛️', title: '政府报告', desc: '体制内汇报、政策解读，格式规范' },
  { emoji: '▶️', title: '自媒体课件', desc: '知识付费、教程视频脚本，结构清晰' },
];

export default function SceneCards() {
  return (
    <section className="py-16 md:py-22 relative overflow-hidden" id="scenes">
      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-white/58 to-indigo-50/35" />
      <span className="sx-crystal hidden md:block" style={{ '--size': '86px', '--rotate': '18deg', '--opacity': '0.32', left: '4%', top: '18%' } as React.CSSProperties} />
      <span className="sx-crystal hidden md:block" style={{ '--size': '58px', '--rotate': '-22deg', '--opacity': '0.28', right: '6%', bottom: '14%' } as React.CSSProperties} />

      <div className="relative max-w-6xl mx-auto px-4 md:px-6">
        <div className="text-center mb-10">
          <h2 className="text-2xl md:text-3xl font-black text-gray-900 mb-2">适用于各种场景</h2>
          <p className="text-sm text-gray-400">无论什么需求，都能快速生成高质量PPT</p>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
          {SCENES.map((s, i) => (
            <div
              key={i}
              className="group sx-glass rounded-[22px] p-4 md:p-5 text-left hover:-translate-y-1 transition-all duration-300 cursor-pointer"
            >
              <div className="flex items-center gap-3">
                <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-white to-indigo-50 border border-indigo-100/70 shadow-lg shadow-indigo-100/50 flex items-center justify-center text-2xl group-hover:scale-105 transition-transform">
                  {s.emoji}
                </div>
                <div className="min-w-0">
                  <h3 className="text-sm font-extrabold text-slate-900 mb-1">{s.title}</h3>
                  <p className="text-xs text-slate-500 leading-relaxed hidden sm:block">{s.desc}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
