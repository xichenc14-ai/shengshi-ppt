'use client';

import React from 'react';

type SlideItem = { id: string; title: string; content?: string[]; notes?: string };

interface OutlineEditorProps {
  outlineResult: { title: string; slides: SlideItem[]; themeId?: string };
  editedSlides: SlideItem[];
  setEditedSlides: (s: SlideItem[]) => void;
  error: string;
  onBackToInput: () => void;
}

export default React.memo(function OutlineEditor({
  outlineResult, editedSlides, setEditedSlides, error, onBackToInput,
}: OutlineEditorProps) {
  const updateSlide = (idx: number, field: 'title' | 'content', val: string) => {
    setEditedSlides(editedSlides.map((s, i) =>
      i === idx ? (field === 'title' ? { ...s, title: val } : { ...s, content: val.split('\n').filter(Boolean) }) : s
    ));
  };

  const addSlide = () => setEditedSlides([...editedSlides, { id: `new-${Date.now()}`, title: '新幻灯片', content: [] }]);
  const removeSlide = (idx: number) => {
    if (idx < 2) { alert('封面页和目录页不可删除'); return; }
    if (!window.confirm(`确定要删除第 ${idx + 1} 页「${editedSlides[idx].title}」吗？`)) return;
    setEditedSlides(editedSlides.filter((_, i) => i !== idx));
  };
  const moveSlide = (idx: number, dir: -1 | 1) => {
    const newIdx = idx + dir;
    if (newIdx < 0 || newIdx >= editedSlides.length) return;
    const arr = [...editedSlides];
    [arr[idx], arr[newIdx]] = [arr[newIdx], arr[idx]];
    setEditedSlides(arr);
  };

  return (
    <div className="flex-1">
      <div className="max-w-3xl mx-auto px-4 md:px-6 pt-8 pb-24">
        {/* Back button */}
        <button onClick={onBackToInput} className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-gray-600 mb-6 transition-colors">
          <span>←</span> 返回首页
        </button>

        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-lg font-bold text-gray-900">{outlineResult.title}</h2>
            <p className="text-xs text-gray-400 mt-0.5">共 {editedSlides.length} 页 · 可编辑标题和内容</p>
          </div>
          <button onClick={() => { onBackToInput(); }} className="text-xs text-gray-400 hover:text-gray-600 transition-colors">← 修改需求</button>
        </div>

        <div className="space-y-2 mb-4">
          {editedSlides.map((slide, idx) => (
            <div key={slide.id} className="bg-white rounded-xl border border-gray-100 p-3 group hover:border-[#EDE9FE] transition-colors">
              <div className="flex items-start gap-2">
                <div className="flex-shrink-0 w-6 h-6 rounded-full bg-[#F5F3FF] text-[#5B4FE9] text-[10px] font-bold flex items-center justify-center mt-0.5">{idx + 1}</div>
                <div className="flex-1 min-w-0">
                  <input value={slide.title} onChange={e => updateSlide(idx, 'title', e.target.value)}
                    className="w-full text-sm font-semibold text-gray-800 bg-transparent border-b border-transparent focus:border-[#5B4FE9] outline-none py-0.5" />
                  {slide.content && slide.content.length > 0 && (
                    <textarea value={slide.content.join('\n')} onChange={e => updateSlide(idx, 'content', e.target.value)}
                      rows={Math.min(slide.content.length, 4)}
                      className="w-full mt-1 text-xs text-gray-500 bg-gray-50 rounded-lg px-2.5 py-1.5 border border-transparent focus:border-[#5B4FE9] outline-none resize-none" />
                  )}
                </div>
                <div className="flex-shrink-0 flex items-center gap-1 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
                  <button onClick={() => moveSlide(idx, -1)} className="w-7 h-7 rounded-lg text-gray-300 hover:text-gray-600 hover:bg-gray-100 flex items-center justify-center transition-colors" title="上移">
                    <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 15l-6-6-6 6"/></svg>
                  </button>
                  <button onClick={() => moveSlide(idx, 1)} className="w-7 h-7 rounded-lg text-gray-300 hover:text-gray-600 hover:bg-gray-100 flex items-center justify-center transition-colors" title="下移">
                    <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 9l6 6 6-6"/></svg>
                  </button>
                  <button onClick={() => removeSlide(idx)} className="w-7 h-7 rounded-lg text-gray-300 hover:text-red-500 hover:bg-red-50 flex items-center justify-center transition-colors" title="删除此页">
                    <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg>
                  </button>
                </div>
              </div>
            </div>
          ))}
          <button onClick={addSlide} className="w-full py-2.5 border border-dashed border-gray-200 rounded-xl text-xs text-gray-400 hover:text-[#5B4FE9] hover:border-[#5B4FE9] transition-colors">+ 添加幻灯片</button>
        </div>

        {error && <div className="mb-4 px-3 py-2 bg-red-50 text-red-500 rounded-lg text-xs">❌ {error}</div>}
      </div>
    </div>
  );
});
