'use client';

import {
  Briefcase,
  ChalkboardTeacher,
  GraduationCap,
  Megaphone,
  PresentationChart,
  RocketLaunch,
  Scroll,
  Video,
} from '@phosphor-icons/react';

const SCENES = [
  { title: '工作汇报', Icon: PresentationChart },
  { title: '商业路演', Icon: Briefcase },
  { title: '教学课件', Icon: ChalkboardTeacher },
  { title: '毕业答辩', Icon: GraduationCap },
  { title: '活动策划', Icon: Megaphone },
  { title: '产品发布', Icon: RocketLaunch },
  { title: '政府报告', Icon: Scroll },
  { title: '自媒体课件', Icon: Video },
];

const STEPS = [
  ['01', '描述需求', '输入主题或上传资料'],
  ['02', '智能成稿', '自动完成结构与设计'],
  ['03', '下载编辑', '导出 PPTX 继续调整'],
];

export default function SceneCards() {
  return (
    <section className="sx-art-section relative scroll-mt-20 py-12 md:scroll-mt-24 md:py-20" id="features">
      <div className="sx-art-orb sx-art-orb-a" aria-hidden="true" />
      <div className="sx-art-orb sx-art-orb-b" aria-hidden="true" />

      <div className="relative mx-auto max-w-6xl px-5 md:px-8">
        <div className="mx-auto mb-7 max-w-2xl text-center md:mb-11">
          <span className="sx-section-kicker">常用场景 · 简单三步</span>
          <h2 className="mt-4 text-[27px] font-black tracking-[-0.035em] text-slate-950 md:text-4xl">从想法，到一份完整演示</h2>
          <p className="mx-auto mt-3 max-w-xl text-sm leading-6 text-slate-500 md:text-[15px]">选择常用场景，三步完成专业 PPT。</p>
        </div>

        <div className="sx-showcase-card overflow-hidden rounded-[30px]">
          <div className="p-4 sm:p-7 md:p-9">
            <div className="grid grid-cols-4 gap-2.5 md:grid-cols-8 md:gap-3">
              {SCENES.map(({ title, Icon }) => (
                <div key={title} className="sx-scene-icon-tile group">
                  <span className="sx-scene-icon">
                    <Icon size={22} weight="duotone" aria-hidden="true" />
                  </span>
                  <p className="mt-2 text-center text-[11px] font-black leading-4 text-slate-700 md:text-xs">{title}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="border-t border-white/80 bg-white/52 px-4 py-6 backdrop-blur-xl sm:px-7 md:px-9 md:py-8">
            <div className="relative grid grid-cols-3 gap-2 md:gap-6">
              <span className="absolute left-[16%] right-[16%] top-[18px] h-px bg-gradient-to-r from-blue-300 via-violet-400 to-fuchsia-300" aria-hidden="true" />
              {STEPS.map(([num, title, desc]) => (
                <div key={num} className="relative z-10 text-center">
                  <span className="sx-step-number mx-auto">{num}</span>
                  <h3 className="mt-3 text-[13px] font-black text-slate-900 md:text-base">{title}</h3>
                  <p className="mt-1 text-[10px] leading-4 text-slate-400 md:text-xs md:leading-5">{desc}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
