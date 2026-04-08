'use client';

import React, { useRef } from 'react';

type UploadedFile = { name: string; type: string; size: number; content?: string };

interface HeroInputProps {
  mode: 'direct' | 'smart';
  setMode: (m: 'direct' | 'smart') => void;
  topic: string;
  setTopic: (t: string) => void;
  files: UploadedFile[];
  setFiles: (f: UploadedFile[] | ((prev: UploadedFile[]) => UploadedFile[])) => void;
  hasInput: boolean;
  error: string;
  directTheme: string;
  setDirectTheme: (v: string) => void;
  directTone: string;
  setDirectTone: (v: string) => void;
  directImgMode: string;
  setDirectImgMode: (v: string) => void;
  directTextMode: 'generate' | 'condense' | 'preserve';
  setDirectTextMode: (v: 'generate' | 'condense' | 'preserve') => void;
  pages: number;
  setPages: (v: number) => void;
  onBackToLanding: () => void;
  fileProcess: (fl: FileList | File[]) => Promise<UploadedFile[]>;
}

const fmtSize = (b: number) => b < 1024 ? b + ' B' : b < 1048576 ? (b / 1024).toFixed(1) + ' KB' : (b / 1048576).toFixed(1) + ' MB';

export default React.memo(function HeroInput({
  mode, setMode, topic, setTopic, files, setFiles,
  hasInput, error,
  directTheme, setDirectTheme, directTone, setDirectTone,
  directImgMode, setDirectImgMode, directTextMode, setDirectTextMode,
  pages, setPages, onBackToLanding, fileProcess,
}: HeroInputProps) {
  const fileRef = useRef<HTMLInputElement>(null);

  return (
    <div className="flex-1">
      <div className="max-w-3xl mx-auto px-4 md:px-6 pt-8 pb-24">
        {/* Back button */}
        <button onClick={onBackToLanding} className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-gray-600 mb-6 transition-colors">
          <span>←</span> 返回首页
        </button>

        {/* Input card */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
          <textarea
            value={topic}
            onChange={e => setTopic(e.target.value)}
            placeholder="输入你想创建的 PPT 主题，例如：2024年度营销策略汇报"
            className="w-full px-4 py-3 rounded-xl bg-[#FAFBFE] border border-gray-200/80 focus:border-[#5B4FE9] focus:ring-2 focus:ring-[#EDE9FE] focus:bg-white outline-none resize-none text-sm text-gray-800 placeholder:text-gray-300 transition-all"
            rows={3}
          />

          {/* File upload */}
          <div
            onClick={() => fileRef.current?.click()}
            className="mt-3 border border-dashed rounded-xl py-3 px-4 flex items-center gap-3 cursor-pointer hover:border-gray-300 hover:bg-gray-50/50 transition-all"
          >
            <span className="text-gray-400 text-sm">📎</span>
            <span className="text-xs text-gray-400">拖拽或点击上传文件</span>
            <span className="text-[10px] text-gray-300 ml-auto">PPT / Word / PDF / Excel</span>
          </div>
          <input ref={fileRef} type="file" multiple accept=".txt,.md,.doc,.docx,.pdf,.xls,.xlsx,.csv,.png,.jpg,.jpeg,.webp,.ppt,.pptx" onChange={async e => { if (e.target.files?.length) { const processed = await fileProcess(e.target.files); setFiles((prev: any[]) => [...prev, ...processed]); } e.target.value = ''; }} className="hidden" />

          {files.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {files.map((f, i) => (
                <span key={i} className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-[#F5F3FF] rounded-lg text-[11px] text-[#4338CA] font-medium">
                  {f.type.startsWith('image/') ? '🖼️' : /\.(xls|csv)/.test(f.name) ? '📊' : '📄'} {f.name}
                  <span className="text-gray-400">{fmtSize(f.size)}</span>
                  <button onClick={() => setFiles((prev: any[]) => prev.filter((_, j) => j !== i))} className="text-gray-300 hover:text-red-400">×</button>
                </span>
              ))}
            </div>
          )}

          <div className="border-t border-gray-100 my-4" />

          {/* Mode indicator */}
          <div className="flex gap-2 mt-1">
            <button
              onClick={() => setMode('smart')}
              className={`flex-1 py-2.5 rounded-xl border text-center transition-all text-sm font-medium ${
                mode === 'smart'
                  ? 'border-[#5B4FE9] bg-[#F5F3FF] text-[#4338CA] shadow-sm'
                  : 'border-gray-200 text-gray-400 hover:border-gray-300'
              }`}
            >
              ✨ 省心定制
            </button>
            <button
              onClick={() => setMode('direct')}
              className={`flex-1 py-2.5 rounded-xl border text-center transition-all text-sm font-medium ${
                mode === 'direct'
                  ? 'border-[#5B4FE9] bg-[#F5F3FF] text-[#4338CA] shadow-sm'
                  : 'border-gray-200 text-gray-400 hover:border-gray-300'
              }`}
            >
              🚀 直通模式
            </button>
          </div>

          {/* Direct mode: show simplified params */}
          {mode === 'direct' && (
            <div className="mt-4 pt-4 border-t border-gray-100">
              {/* Text processing modes */}
              <div className="mt-3">
                <label className="text-xs text-gray-500 mb-2 block">文本处理模式</label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { value: 'generate', label: '🚀 扩充文本', desc: 'AI丰富内容' },
                    { value: 'condense', label: '✨ 总结提炼', desc: 'AI精简核心' },
                    { value: 'preserve', label: '📝 保持原样', desc: '忠实呈现' },
                  ].map(opt => (
                    <button
                      key={opt.value}
                      onClick={() => setDirectTextMode(opt.value as 'generate' | 'condense' | 'preserve')}
                      className={`py-2.5 px-2 rounded-xl border-2 text-center transition-all ${
                        directTextMode === opt.value
                          ? 'border-[#5B4FE9] bg-[#F5F3FF] shadow-sm'
                          : 'border-gray-100 hover:border-gray-200 bg-white'
                      }`}
                    >
                      <div className={`text-xs font-semibold ${directTextMode === opt.value ? 'text-[#4338CA]' : 'text-gray-600'}`}>{opt.label}</div>
                      <div className="text-[9px] text-gray-400 mt-0.5">{opt.desc}</div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Simplified params */}
              <div className="grid grid-cols-2 gap-3 mt-3">
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">配图模式</label>
                  <select
                    value={directImgMode}
                    onChange={e => setDirectImgMode(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm bg-white"
                  >
                    <option value="noImages">无图</option>
                    <option value="pictographic">插图图标</option>
                    <option value="pexels">高清照片</option>
                    <option value="webFreeToUseCommercially">搜索配图</option>
                    <option value="aiGenerated">AI配图</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">语气风格</label>
                  <select
                    value={directTone}
                    onChange={e => setDirectTone(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm bg-white"
                  >
                    <option value="professional">专业</option>
                    <option value="casual">轻松</option>
                    <option value="creative">创意</option>
                    <option value="bold">大胆</option>
                  </select>
                </div>
              </div>
              <div className="mt-3">
                <label className="text-xs text-gray-500 mb-1 block">页数：{pages} 页</label>
                <input
                  type="range"
                  min="5"
                  max="30"
                  value={pages}
                  onChange={e => setPages(Number(e.target.value))}
                  className="w-full"
                />
              </div>
            </div>
          )}

          {error && <div className="mt-3 px-3 py-2 bg-red-50 text-red-500 rounded-lg text-xs">❌ {error}</div>}
        </div>
      </div>
    </div>
  );
});
