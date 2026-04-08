'use client';

import React, { useState, useCallback } from 'react';
import { useAuth } from '@/lib/auth-context';

const HOT_SCENES = [
  { label: '📊 工作汇报', text: '帮我做一份本周工作汇报，包含本周完成的任务、遇到的问题和下周计划' },
  { label: '💼 商业方案', text: '帮我写一份咖啡品牌的市场推广方案PPT' },
  { label: '🎓 教学课件', text: '帮我制作一份初中数学《勾股定理》的教学课件' },
  { label: '📑 毕业答辩', text: '帮我做一份计算机专业毕业论文答辩PPT，题目是《基于深度学习的图像识别研究》' },
  { label: '📋 年终总结', text: '帮我做一份2025年度工作总结PPT，包含主要成绩、数据亮点和明年规划' },
  { label: '🎉 活动策划', text: '帮我策划一份公司年会活动方案PPT' },
];

type UploadedFile = { name: string; type: string; size: number };

interface HeroSectionProps {
  topic: string;
  setTopic: (t: string) => void;
  files: UploadedFile[];
  setFiles: (f: UploadedFile[]) => void;
  onGenerate: () => void;
  hasInput: boolean;
  loading: boolean;
}

export default function HeroSection({ topic, setTopic, files, setFiles, onGenerate, hasInput, loading }: HeroSectionProps) {
  const { user, openLogin } = useAuth();
  const [dragging, setDragging] = useState(false);
  const fileRef = React.useRef<HTMLInputElement>(null);

  const processFiles = async (fl: FileList | File[]) => {
    const r: UploadedFile[] = [];
    for (const f of Array.from(fl)) r.push({ name: f.name, type: f.type, size: f.size });
    return r;
  };

  const onDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    if (e.dataTransfer.files.length) {
      const processed = await processFiles(e.dataTransfer.files);
      setFiles([...files, ...processed]);
    }
  };

  const onFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.length) {
      const processed = await processFiles(e.target.files);
      setFiles([...files, ...processed]);
    }
    e.target.value = '';
  };

  const rmFile = (i: number) => setFiles(files.filter((_, j) => j !== i));
  const fmtSize = (b: number) => b < 1024 ? b + ' B' : b < 1048576 ? (b / 1024).toFixed(1) + ' KB' : (b / 1048576).toFixed(1) + ' MB';

  const handleGenerate = () => {
    if (!user) { openLogin(); return; }
    onGenerate();
  };

  const handleSceneClick = (text: string) => {
    setTopic(text);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <section className="relative pt-16 pb-20 md:pt-24 md:pb-28 overflow-hidden">
      {/* Background decoration */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-96 h-96 bg-[#5B4FE9]/5 rounded-full blur-3xl" />
        <div className="absolute -bottom-40 -left-40 w-96 h-96 bg-[#8B5CF6]/5 rounded-full blur-3xl" />
      </div>

      <div className="relative max-w-3xl mx-auto px-4 md:px-6 text-center">
        {/* Main heading */}
        <h1 className="text-3xl sm:text-4xl md:text-5xl font-extrabold text-gray-900 mb-4 tracking-tight leading-tight">
          省事PPT，AI帮你搞定
          <span className="bg-gradient-to-r from-[#5B4FE9] to-[#8B5CF6] bg-clip-text text-transparent"> 每一份演示</span>
        </h1>
        <p className="text-base md:text-lg text-gray-500 mb-8 max-w-xl mx-auto leading-relaxed">
          描述你的需求，AI自动生成大纲、填充内容、精美排版。<br className="hidden sm:block" />
          从工作汇报到毕业答辩，30秒出稿。
        </p>

        {/* Input card */}
        <div className="bg-white rounded-2xl shadow-xl shadow-gray-200/50 border border-gray-100 p-4 md:p-6 max-w-2xl mx-auto">
          <textarea
            value={topic}
            onChange={e => setTopic(e.target.value)}
            placeholder="✍️ 描述你的PPT需求，例如：帮我做一份Q1季度销售工作汇报..."
            className="w-full px-5 py-4 rounded-xl bg-[#FAFBFE] border border-gray-200/80 focus:border-[#5B4FE9] focus:ring-2 focus:ring-[#EDE9FE] focus:bg-white outline-none resize-none text-sm text-gray-800 placeholder:text-gray-400 transition-all"
            rows={3}
          />

          {/* File upload */}
          <div
            onDragOver={e => { e.preventDefault(); setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onDrop={onDrop}
            onClick={() => fileRef.current?.click()}
            className={`mt-3 border border-dashed rounded-xl py-3 px-4 flex items-center gap-3 cursor-pointer transition-all ${
              dragging ? 'border-[#8B5CF6] bg-[#F5F3FF]/30' : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50/50'
            }`}
          >
            <span className="text-gray-400 text-sm">📎</span>
            <span className="text-xs text-gray-400">拖拽或点击上传文件</span>
            <span className="text-[10px] text-gray-400 ml-auto">Word / PDF / Excel / PPT</span>
          </div>
          <input ref={fileRef} type="file" multiple accept=".txt,.md,.doc,.docx,.pdf,.xls,.xlsx,.csv,.png,.jpg,.jpeg,.webp,.ppt,.pptx" onChange={onFileChange} className="hidden" />

          {/* Uploaded files */}
          {files.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {files.map((f, i) => (
                <span key={i} className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-[#F5F3FF] rounded-lg text-[11px] text-[#4338CA] font-medium">
                  {f.type.startsWith('image/') ? '🖼️' : /\.(xls|csv)/.test(f.name) ? '📊' : '📄'} {f.name}
                  <span className="text-gray-400">{fmtSize(f.size)}</span>
                  <button onClick={() => rmFile(i)} className="text-gray-300 hover:text-red-400 ml-0.5">×</button>
                </span>
              ))}
            </div>
          )}

          {/* CTA buttons */}
          <div className="mt-5 flex flex-col sm:flex-row items-center gap-3">
            <button
              onClick={handleGenerate}
              disabled={!hasInput || loading}
              className="w-full sm:w-auto px-10 py-4 bg-gradient-to-r from-[#5B4FE9] to-[#8B5CF6] text-white rounded-xl text-base font-bold hover:shadow-lg hover:shadow-purple-300/40 hover:-translate-y-0.5 active:translate-y-0 transition-all disabled:opacity-40 disabled:hover:shadow-none disabled:hover:translate-y-0"
            >
              🪄 免费生成PPT
            </button>
            <button
              onClick={() => fileRef.current?.click()}
              className="w-full sm:w-auto px-8 py-3.5 text-sm font-medium text-[#5B4FE9] bg-white border-2 border-[#EDE9FE] rounded-xl hover:bg-[#F5F3FF] transition-all"
            >
              📄 上传文档转PPT
            </button>
          </div>
        </div>

        {/* Hot scenes */}
        <div className="mt-6 flex flex-wrap items-center justify-center gap-2">
          <span className="text-xs text-gray-400 mr-1">热门场景：</span>
          {HOT_SCENES.map((s, i) => (
            <button
              key={i}
              onClick={() => handleSceneClick(s.text)}
              className="px-3 py-1.5 bg-white border border-gray-100 rounded-full text-xs text-gray-500 hover:text-[#5B4FE9] hover:border-[#C4B5FD] hover:bg-[#F5F3FF]/50 transition-all"
            >
              {s.label}
            </button>
          ))}
        </div>
      </div>
    </section>
  );
}
