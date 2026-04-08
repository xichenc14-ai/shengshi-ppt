'use client';

import React from 'react';

const SCENES = [
  { emoji: '📊', title: '工作汇报', desc: '周报、月报、季度总结，一键生成专业汇报，告别加班做PPT' },
  { emoji: '💼', title: '商业路演', desc: '融资BP、产品推介、营销方案，逻辑清晰，打动投资人' },
  { emoji: '🎓', title: '教学课件', desc: '课程大纲、培训材料，信息清晰、排版规范，老师的好帮手' },
  { emoji: '📑', title: '毕业答辩', desc: '论文答辩、课题汇报，学术规范、重点突出，顺利过关' },
  { emoji: '🎉', title: '活动策划', desc: '年会、发布会、品牌活动，创意满分、流程清晰' },
  { emoji: '🚀', title: '产品发布', desc: '新品推介、功能展示，科技感拉满，让产品自己说话' },
  { emoji: '🏛️', title: '政府报告', desc: '体制内汇报、政策解读，格式规范、风格严肃' },
  { emoji: '📱', title: '自媒体课件', desc: '知识付费、教程视频脚本，结构清晰，粉丝爱看' },
];

export default function SceneCards() {
  return (
    <section className="py-20 md:py-24 bg-white" id="scenes">
      <div className="max-w-5xl mx-auto px-4 md:px-6">
        <div className="text-center mb-10">
          <h2 className="text-2xl md:text-3xl font-extrabold text-gray-900 mb-2">适用于各种场景</h2>
          <p className="text-sm text-gray-400">无论什么需求，都能快速生成高质量PPT</p>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
          {SCENES.map((s, i) => (
            <div
              key={i}
              className="group bg-[#FAFBFE] border border-gray-100 rounded-2xl p-5 text-center hover:bg-white hover:border-[#EDE9FE] hover:shadow-lg hover:shadow-purple-100/30 hover:-translate-y-1 transition-all duration-300 cursor-pointer"
            >
              <div className="text-3xl md:text-4xl mb-3 group-hover:scale-110 transition-transform duration-300">{s.emoji}</div>
              <h3 className="text-sm font-bold text-gray-800 mb-1">{s.title}</h3>
              <p className="text-xs text-gray-400 leading-relaxed hidden sm:block">{s.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
