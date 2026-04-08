'use client';

import React from 'react';

interface ResultPanelProps {
  title: string;
  slides: { id: string; title: string; content?: string[] }[];
  dlUrl: string;
  onReset: () => void;
}

export default React.memo(function ResultPanel({ title, slides, dlUrl, onReset }: ResultPanelProps) {
  const handleDownload = () => {
    if (dlUrl.startsWith('data:')) {
      const link = document.createElement('a');
      link.href = dlUrl;
      link.download = title ? `省心PPT_${title.substring(0, 20)}.pptx` : '省心PPT.pptx';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } else {
      window.open(dlUrl, '_blank');
    }
  };

  return (
    <div className="flex-1">
      <div className="max-w-2xl mx-auto px-4 md:px-6 pt-16 text-center animate-fade-in">
        <div className="text-5xl mb-4">🎉</div>
        <h2 className="text-xl font-bold text-gray-900 mb-1">PPT 已生成！</h2>
        <p className="text-xs text-gray-400 mb-8">{title} · {slides.length} 页</p>

        <div className="bg-white rounded-2xl border border-gray-100 p-6 mb-6">
          <div className="grid grid-cols-3 gap-4 mb-6">
            <div className="text-center">
              <div className="text-2xl mb-1">📄</div>
              <p className="text-xs text-gray-500">{slides.length} 页</p>
            </div>
            <div className="text-center">
              <div className="text-2xl mb-1">🎨</div>
              <p className="text-xs text-gray-500">AI 排版</p>
            </div>
            <div className="text-center">
              <div className="text-2xl mb-1">⬇️</div>
              <p className="text-xs text-gray-500">即下即用</p>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            {dlUrl && (
              <button onClick={handleDownload} className="w-full sm:w-auto px-8 py-3.5 bg-gradient-to-r from-green-500 to-emerald-600 text-white rounded-xl text-sm font-semibold hover:shadow-lg hover:shadow-green-200/50 transition-all">
                📥 下载 PPTX
              </button>
            )}
            <button onClick={onReset} className="w-full sm:w-auto px-8 py-3.5 text-gray-500 hover:text-gray-700 text-sm font-medium hover:bg-gray-50 rounded-xl transition-all">
              继续创建
            </button>
          </div>
        </div>
      </div>
    </div>
  );
});
