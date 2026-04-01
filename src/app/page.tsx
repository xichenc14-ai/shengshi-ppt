'use client';

import React, { useState } from 'react';
import Link from 'next/link';

export default function Home() {
  const [topic, setTopic] = useState('');

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50">
      {/* 导航栏 */}
      <nav className="px-6 py-4 flex items-center justify-between max-w-6xl mx-auto">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg flex items-center justify-center">
            <span className="text-white text-sm font-bold">P</span>
          </div>
          <span className="text-lg font-bold text-gray-800">省事PPT</span>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-sm text-gray-500">AI驱动的PPT生成器</span>
          <Link
            href="/create"
            className="px-4 py-2 bg-blue-500 text-white rounded-lg text-sm font-medium hover:bg-blue-600 transition-colors"
          >
            开始制作
          </Link>
        </div>
      </nav>

      {/* Hero区域 */}
      <main className="max-w-4xl mx-auto px-6 pt-20 pb-32">
        <div className="text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-sm mb-6">
            <span>✨</span>
            <span>AI智能生成，一键搞定</span>
          </div>

          <h1 className="text-5xl md:text-6xl font-bold text-gray-900 leading-tight mb-6">
            告别加班做PPT
            <br />
            <span className="bg-gradient-to-r from-blue-500 to-purple-600 bg-clip-text text-transparent">
              让AI帮你搞定
            </span>
          </h1>

          <p className="text-xl text-gray-500 max-w-2xl mx-auto mb-10 leading-relaxed">
            输入一个主题，AI自动生成专业PPT内容
            <br />
            支持在线预览、一键导出PPTX文件
          </p>

          {/* 输入框 */}
          <div className="max-w-xl mx-auto mb-12">
            <div className="relative">
              <input
                type="text"
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                placeholder="输入PPT主题，例如：2024年市场营销策略"
                className="w-full px-6 py-4 text-lg rounded-2xl border-2 border-gray-200 focus:border-blue-500 focus:outline-none shadow-sm transition-all"
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && topic.trim()) {
                    window.location.href = `/create?topic=${encodeURIComponent(topic.trim())}`;
                  }
                }}
              />
              <Link
                href={topic.trim() ? `/create?topic=${encodeURIComponent(topic.trim())}` : '/create'}
                className="absolute right-2 top-1/2 -translate-y-1/2 px-6 py-2.5 bg-gradient-to-r from-blue-500 to-purple-600 text-white rounded-xl font-medium hover:shadow-lg transition-all"
              >
                生成PPT →
              </Link>
            </div>
          </div>

          {/* 特性卡片 */}
          <div className="grid grid-cols-3 gap-6 max-w-3xl mx-auto">
            <div className="p-6 bg-white rounded-2xl shadow-sm border border-gray-100">
              <div className="text-3xl mb-3">🤖</div>
              <h3 className="font-semibold text-gray-800 mb-1">AI智能生成</h3>
              <p className="text-sm text-gray-500">GLM大模型驱动，内容专业准确</p>
            </div>
            <div className="p-6 bg-white rounded-2xl shadow-sm border border-gray-100">
              <div className="text-3xl mb-3">🎨</div>
              <h3 className="font-semibold text-gray-800 mb-1">精美模板</h3>
              <p className="text-sm text-gray-500">多种风格模板，适配各种场景</p>
            </div>
            <div className="p-6 bg-white rounded-2xl shadow-sm border border-gray-100">
              <div className="text-3xl mb-3">📥</div>
              <h3 className="font-semibold text-gray-800 mb-1">导出PPTX</h3>
              <p className="text-sm text-gray-500">一键导出，兼容Office和WPS</p>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-gray-100 py-6 text-center text-sm text-gray-400">
        <p>省事PPT · AI驱动的演示文稿生成器 · Powered by GLM-5</p>
      </footer>
    </div>
  );
}
