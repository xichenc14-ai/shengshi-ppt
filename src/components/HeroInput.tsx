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
        <div className="relative bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
          {/* Textarea with inline upload */}
          <textarea
            value={topic}
            onChange={e => setTopic(e.target.value)}
            placeholder="输入你想创建的 PPT 主题，例如：2024年度营销策略汇报"
            className="w-full min-h-[120px] px-4 py-3 pr-10 rounded-xl bg-[#FAFBFE] border border-gray-200/80 focus:border-[#5B4FE9] focus:ring-2 focus:ring-[#EDE9FE] focus:bg-white outline-none resize-none text-sm text-gray-800 placeholder:text-gray-400 transition-all"
          />
          {/* Inline attach button */}
          <button
            onClick={() => fileRef.current?.click()}
            className="absolute top-[2.6rem] right-[1.6rem] w-8 h-8 flex items-center justify-center rounded-lg text-gray-300 hover:text-[#5B4FE9] hover:bg-[#F5F3FF] transition-all"
            title="上传附件"
          >
            <svg className="w-4.5 h-4.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21.44 11.05l-9.19 9.19a6 6 0 01-8.49-8.49l9.19-9.19a4 4 0 015.66 5.66l-9.2 9.19a2 2 0 01-2.83-2.83l8.49-8.48" />
            </svg>
          </button>
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
              🛠️ 专业模式
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
                <label className="text-xs text-gray-500 mb-1 block">页数</label>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setPages(Math.max(5, pages - 1))}
                    className="w-8 h-8 rounded-lg border border-gray-200 flex items-center justify-center text-gray-500 hover:border-[#5B4FE9] hover:text-[#5B4FE9] transition-colors"
                  >
                    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M6 9l6 6 6-6"/></svg>
                  </button>
                  <input
                    type="number"
                    min="5"
                    max="30"
                    value={pages}
                    onChange={e => setPages(Math.min(30, Math.max(5, Number(e.target.value))))}
                    className="w-16 h-8 text-center border border-gray-200 rounded-lg text-sm font-medium text-gray-700 outline-none focus:border-[#5B4FE9]"
                  />
                  <span className="text-xs text-gray-400">页</span>
                  <button
                    onClick={() => setPages(Math.min(30, pages + 1))}
                    className="w-8 h-8 rounded-lg border border-gray-200 flex items-center justify-center text-gray-500 hover:border-[#5B4FE9] hover:text-[#5B4FE9] transition-colors"
                  >
                    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 15l-6-6-6 6"/></svg>
                  </button>
                </div>
              </div>
            </div>
          )}

          {error && <div className="mt-3 px-3 py-2 bg-red-50 text-red-500 rounded-lg text-xs">❌ {error}</div>}
        </div>
      </div>
    </div>
  );
});
