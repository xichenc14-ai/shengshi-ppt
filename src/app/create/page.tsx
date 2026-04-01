'use client';

import React, { useState, useEffect, useCallback, useRef, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import SlideRenderer from '@/components/SlideRenderer';
import TemplateSelector from '@/components/TemplateSelector';
import { Presentation, Template, templates } from '@/lib/types';

// 三种 PPT 模式
const MODES = [
  { id: 'generate', name: 'AI 创作', icon: '✨', desc: '输入主题，AI 从零生成完整PPT' },
  { id: 'condense', name: '智能摘要', icon: '📝', desc: '粘贴内容，AI 提炼精简为PPT' },
  { id: 'preserve', name: '原文排版', icon: '📄', desc: '粘贴内容，保持原文直接排版' },
] as const;

type TextMode = typeof MODES[number]['id'];
type Step = 'input' | 'generating' | 'preview';

function CreatePageInner() {
  const searchParams = useSearchParams();
  const initialTopic = searchParams.get('topic') || '';

  // 状态
  const [mode, setMode] = useState<TextMode>('generate');
  const [topic, setTopic] = useState(initialTopic);
  const [slideCount, setSlideCount] = useState(8);
  const [selectedTemplate, setSelectedTemplate] = useState<Template>(templates[0]);
  const [presentation, setPresentation] = useState<Presentation | null>(null);
  const [currentSlide, setCurrentSlide] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [exporting, setExporting] = useState(false);
  const [step, setStep] = useState<Step>('input');
  const [generateProgress, setGenerateProgress] = useState('');

  // Gamma 相关状态
  const [gammaResult, setGammaResult] = useState<{ gammaUrl?: string; exportUrl?: string } | null>(null);
  const [gammaPolling, setGammaPolling] = useState(false);

  // 文件上传 ref
  const fileInputRef = useRef<HTMLInputElement>(null);

  // 处理文件上传
  const handleFileUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // 文本文件直接读取
    if (file.type === 'text/plain' || file.name.endsWith('.md') || file.name.endsWith('.txt')) {
      const text = await file.text();
      setTopic(prev => prev ? prev + '\n\n' + text : text);
      return;
    }

    // 其他文件类型提示
    const ext = file.name.split('.').pop()?.toLowerCase();
    if (['doc', 'docx', 'pdf', 'xls', 'xlsx', 'csv'].includes(ext || '')) {
      // TODO: 接入文件解析服务
      setTopic(prev => prev ? prev + '\n\n' + `[已上传文件: ${file.name}]` : `[已上传文件: ${file.name}]`);
    }

    if (file.type.startsWith('image/')) {
      // TODO: 接入 OCR 服务
      setTopic(prev => prev ? prev + '\n\n' + `[已上传图片: ${file.name}]` : `[已上传图片: ${file.name}]`);
    }
  }, []);

  // 生成PPT（GLM-5-turbo 快速生成，用于本地预览）
  const handleGenerate = useCallback(async () => {
    if (!topic.trim()) return;

    setLoading(true);
    setError('');
    setStep('generating');
    setCurrentSlide(0);
    setGammaResult(null);

    try {
      // Step 1: 用 GLM-5-turbo 生成结构化内容（快速，用于即时预览）
      setGenerateProgress('AI 正在生成内容结构...');

      const response = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          topic: topic.trim(),
          slideCount,
          style: 'professional',
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || '生成失败');
      }

      const ppt: Presentation = {
        ...data.presentation,
        templateId: selectedTemplate.id,
      };

      setPresentation(ppt);
      setStep('preview');

      // Step 2: 异步调用 Gamma API 生成精美版本
      setGenerateProgress('正在调用 Gamma 生成精美版本...');
      try {
        const gammaRes = await fetch('/api/gamma', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            inputText: topic.trim(),
            textMode: mode,
            format: 'presentation',
            numCards: slideCount,
            exportAs: 'pptx',
          }),
        });

        if (gammaRes.ok) {
          const gammaData = await gammaRes.json();
          if (gammaData.generationId) {
            // 开始轮询 Gamma 状态
            setGammaPolling(true);
            pollGammaStatus(gammaData.generationId);
          }
        }
      } catch (gammaErr) {
        // Gamma 调用失败不影响本地预览
        console.warn('Gamma generation skipped:', gammaErr);
      }
    } catch (err: any) {
      setError(err.message || '生成失败，请重试');
      setStep('input');
    } finally {
      setLoading(false);
    }
  }, [topic, slideCount, selectedTemplate, mode]);

  // 轮询 Gamma 状态
  const pollGammaStatus = useCallback(async (generationId: string) => {
    const maxAttempts = 36; // 3 minutes (5s * 36)
    for (let i = 0; i < maxAttempts; i++) {
      await new Promise(r => setTimeout(r, 5000));

      try {
        const res = await fetch(`/api/gamma?id=${generationId}`);
        if (!res.ok) continue;

        const data = await res.json();

        if (data.status === 'completed') {
          setGammaResult({
            gammaUrl: data.gammaUrl,
            exportUrl: data.exportUrl,
          });
          setGammaPolling(false);
          setGenerateProgress('Gamma 精美版已生成！');
          return;
        }

        if (data.status === 'failed') {
          console.warn('Gamma generation failed:', data.error);
          setGammaPolling(false);
          return;
        }

        setGenerateProgress(`Gamma 生成中... (${Math.round(((i + 1) / maxAttempts) * 100)}%)`);
      } catch {
        continue;
      }
    }
    setGammaPolling(false);
    setGenerateProgress('Gamma 生成超时，可使用本地预览版');
  }, []);

  // 导出PPTX
  const handleExport = useCallback(async () => {
    if (!presentation) return;

    setExporting(true);
    try {
      const PptxGenJS = (await import('pptxgenjs')).default;
      const { templates } = await import('@/lib/types');
      const pptx = new PptxGenJS();
      pptx.layout = 'LAYOUT_16x9';
      pptx.author = '省事PPT';
      pptx.title = presentation.title;

      const template = templates.find(t => t.id === presentation.templateId) || templates[0];
      const c = template.colors;

      presentation.slides.forEach((slide, index) => {
        const s = pptx.addSlide();
        if (slide.type === 'title' || slide.type === 'end') {
          s.background = { color: c.primary };
          s.addText(slide.title, {
            x: 1, y: slide.type === 'title' ? 1.8 : 2, w: 8, h: 1.5,
            fontSize: slide.type === 'title' ? 36 : 40,
            color: 'FFFFFF', bold: true, align: 'center', valign: 'middle',
          });
          if (slide.subtitle) {
            s.addText(slide.subtitle, {
              x: 1, y: 3.5, w: 8, h: 0.8,
              fontSize: 18, color: 'FFFFFF', align: 'center', valign: 'middle',
            });
          }
        } else {
          s.background = { color: c.background };
          s.addShape(pptx.ShapeType.rect, {
            x: 0, y: 0, w: '100%', h: 0.8, fill: { color: c.primary },
          });
          s.addText(String(index + 1), {
            x: 8.8, y: 0.15, w: 0.8, h: 0.5,
            fontSize: 14, color: 'FFFFFF', align: 'right',
          });
          s.addText(slide.title, {
            x: 0.8, y: 1.2, w: 8.4, h: 0.8,
            fontSize: 28, color: c.primary, bold: true,
          });
          if (slide.content && slide.content.length > 0) {
            const rows = slide.content.map((item: string) => ({
              text: item,
              options: { fontSize: 18, color: c.text, bullet: { code: '2022', color: c.secondary }, paraSpaceAfter: 12 },
            }));
            s.addText(rows, { x: 1.2, y: 2.3, w: 7.8, h: 4, valign: 'top', lineSpacing: 28 });
          }
        }
      });

      const filename = (presentation.title || 'presentation').replace(/[^\u4e00-\u9fa5a-zA-Z0-9_-]/g, '_');
      await pptx.writeFile({ fileName: `${filename}.pptx` });
    } catch (err: any) {
      console.error('Export error:', err);
      setError(err.message || '导出失败');
    } finally {
      setExporting(false);
    }
  }, [presentation]);

  // 键盘导航
  useEffect(() => {
    if (!presentation) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
        setCurrentSlide(prev => Math.max(0, prev - 1));
      } else if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
        setCurrentSlide(prev => Math.min(presentation.slides.length - 1, prev + 1));
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [presentation]);

  useEffect(() => {
    if (presentation && presentation.templateId !== selectedTemplate.id) {
      setPresentation(prev => prev ? { ...prev, templateId: selectedTemplate.id } : null);
    }
  }, [selectedTemplate]);

  const inputPlaceholder = {
    generate: '输入PPT主题，例如：2024年人工智能发展趋势分析\n也可以详细描述你的需求...',
    condense: '粘贴你需要提炼的完整内容：\n文章、报告、笔记、大纲等...\n\nAI会自动提取要点并生成精简PPT',
    preserve: '粘贴你需要排版的内容：\n每行一个要点，或用空行分隔不同页面...\n\nAI会保持原文内容，只做排版美化',
  }[mode];

  return (
    <div className="min-h-screen bg-gray-50">
      {/* 顶部导航 */}
      <nav className="bg-white border-b border-gray-200 px-6 py-3 flex items-center justify-between sticky top-0 z-50">
        <Link href="/" className="flex items-center gap-2">
          <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg flex items-center justify-center">
            <span className="text-white text-sm font-bold">P</span>
          </div>
          <span className="text-lg font-bold text-gray-800">省事PPT</span>
        </Link>

        <div className="flex items-center gap-3">
          {step !== 'input' && (
            <button
              onClick={() => { setStep('input'); setGammaResult(null); setGammaPolling(false); }}
              className="px-4 py-2 text-gray-600 hover:text-gray-800 text-sm font-medium transition-colors"
            >
              ← 重新创建
            </button>
          )}
          {presentation && step === 'preview' && (
            <>
              {gammaResult?.exportUrl && (
                <a
                  href={gammaResult.exportUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-4 py-2 bg-purple-500 text-white rounded-lg text-sm font-medium hover:bg-purple-600 transition-colors flex items-center gap-2"
                >
                  🎨 Gamma 精美版
                </a>
              )}
              <button
                onClick={handleExport}
                disabled={exporting}
                className="px-4 py-2 bg-green-500 text-white rounded-lg text-sm font-medium hover:bg-green-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {exporting ? (
                  <>
                    <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    导出中...
                  </>
                ) : (
                  <>📥 导出PPTX</>
                )}
              </button>
            </>
          )}
        </div>
      </nav>

      <div className="max-w-7xl mx-auto px-6 py-6">
        {step === 'input' ? (
          /* ========== 输入阶段 ========== */
          <div className="max-w-2xl mx-auto pt-16 animate-fade-in">
            <div className="text-center mb-10">
              <h1 className="text-3xl font-bold text-gray-900 mb-3">
                🎯 创建你的PPT
              </h1>
              <p className="text-gray-500">
                选择模式，AI为你自动生成专业内容
              </p>
            </div>

            <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-8 space-y-6">
              {/* 模式选择 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-3">
                  选择生成模式
                </label>
                <div className="grid grid-cols-3 gap-3">
                  {MODES.map(m => (
                    <button
                      key={m.id}
                      onClick={() => setMode(m.id)}
                      className={`p-4 rounded-xl border-2 transition-all text-left ${
                        mode === m.id
                          ? 'border-blue-500 bg-blue-50 shadow-sm'
                          : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                      }`}
                    >
                      <div className="text-2xl mb-1">{m.icon}</div>
                      <div className={`font-semibold text-sm ${mode === m.id ? 'text-blue-700' : 'text-gray-800'}`}>
                        {m.name}
                      </div>
                      <div className="text-xs text-gray-500 mt-1 leading-relaxed">
                        {m.desc}
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {/* 内容输入 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  {mode === 'generate' ? 'PPT主题 *' : '输入内容 *'}
                </label>
                <textarea
                  value={topic}
                  onChange={(e) => setTopic(e.target.value)}
                  placeholder={inputPlaceholder}
                  className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 focus:border-blue-500 focus:outline-none resize-none transition-colors text-gray-800"
                  rows={4}
                />

                {/* 文件上传按钮 */}
                <div className="flex items-center gap-2 mt-2">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".txt,.md,.doc,.docx,.pdf,.xls,.xlsx,.csv,.png,.jpg,.jpeg,.webp"
                    onChange={handleFileUpload}
                    className="hidden"
                  />
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="px-3 py-1.5 text-xs text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors flex items-center gap-1"
                  >
                    📎 上传文件
                  </button>
                  <span className="text-xs text-gray-400">
                    支持 txt、md、doc、pdf、xls、csv、图片
                  </span>
                </div>
              </div>

              {/* 页数选择 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  幻灯片数量：<span className="text-blue-600 font-semibold">{slideCount}页</span>
                </label>
                <input
                  type="range"
                  min={5}
                  max={15}
                  value={slideCount}
                  onChange={(e) => setSlideCount(Number(e.target.value))}
                  className="w-full accent-blue-500"
                />
                <div className="flex justify-between text-xs text-gray-400 mt-1">
                  <span>5页</span>
                  <span>15页</span>
                </div>
              </div>

              {/* 模板选择 */}
              <TemplateSelector
                selectedId={selectedTemplate.id}
                onSelect={setSelectedTemplate}
              />

              {/* 生成按钮 */}
              <button
                onClick={handleGenerate}
                disabled={!topic.trim() || loading}
                className="w-full py-4 bg-gradient-to-r from-blue-500 to-purple-600 text-white rounded-xl font-semibold text-lg hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:shadow-none"
              >
                {loading ? (
                  <span className="loading-dots">
                    <span></span>
                    <span></span>
                    <span></span>
                    <span className="ml-2">{generateProgress || 'AI正在生成中...'}</span>
                  </span>
                ) : (
                  '🚀 开始生成PPT'
                )}
              </button>

              {error && (
                <div className="p-3 bg-red-50 text-red-600 rounded-lg text-sm">
                  ❌ {error}
                </div>
              )}
            </div>

            <div className="mt-6 text-center text-sm text-gray-400">
              💡 {mode === 'generate' ? '主题越具体，生成效果越好' : '内容越详细，排版效果越好'}
            </div>
          </div>
        ) : step === 'generating' ? (
          /* ========== 生成中 ========== */
          <div className="flex items-center justify-center min-h-[60vh] animate-fade-in">
            <div className="text-center">
              <div className="loading-dots text-3xl mb-4">
                <span></span>
                <span></span>
                <span></span>
              </div>
              <p className="text-gray-600 text-lg">{generateProgress || 'AI 正在精心制作你的PPT...'}</p>
              {error && (
                <div className="mt-4 p-3 bg-red-50 text-red-600 rounded-lg text-sm max-w-md">
                  ❌ {error}
                </div>
              )}
            </div>
          </div>
        ) : (
          /* ========== 预览阶段 ========== */
          <div className="animate-fade-in">
            {/* Gamma 生成状态提示 */}
            {gammaPolling && (
              <div className="mb-4 p-3 bg-purple-50 border border-purple-200 rounded-xl text-sm text-purple-700 flex items-center gap-2">
                <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                {generateProgress || 'Gamma 精美版生成中...'}
              </div>
            )}
            {gammaResult && !gammaPolling && (
              <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-xl text-sm text-green-700 flex items-center gap-2">
                ✅ {generateProgress}
                {gammaResult.gammaUrl && (
                  <a href={gammaResult.gammaUrl} target="_blank" rel="noopener noreferrer" className="underline font-medium">
                    在线查看 →
                  </a>
                )}
              </div>
            )}

            <div className="flex gap-6">
              {/* 左侧：幻灯片列表 */}
              <div className="w-48 flex-shrink-0 space-y-3 overflow-y-auto max-h-[calc(100vh-100px)] pb-4">
                {presentation?.slides.map((slide, index) => (
                  <SlideRenderer
                    key={slide.id}
                    slide={slide}
                    template={selectedTemplate}
                    slideIndex={index}
                    totalSlides={presentation.slides.length}
                    isCurrent={currentSlide === index}
                    onClick={() => setCurrentSlide(index)}
                    className="!cursor-pointer"
                  />
                ))}
              </div>

              {/* 右侧：主预览区 */}
              <div className="flex-1 flex flex-col items-center">
                {presentation && (
                  <div className="w-full max-w-4xl">
                    <SlideRenderer
                      slide={presentation.slides[currentSlide]}
                      template={selectedTemplate}
                      slideIndex={currentSlide}
                      totalSlides={presentation.slides.length}
                    />
                  </div>
                )}

                {/* 导航控制 */}
                <div className="flex items-center gap-4 mt-6">
                  <button
                    onClick={() => setCurrentSlide(prev => Math.max(0, prev - 1))}
                    disabled={currentSlide === 0}
                    className="p-2 rounded-lg bg-white border border-gray-200 hover:bg-gray-50 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                    </svg>
                  </button>
                  <span className="text-sm text-gray-500 min-w-[80px] text-center">
                    {currentSlide + 1} / {presentation?.slides.length || 0}
                  </span>
                  <button
                    onClick={() => setCurrentSlide(prev => Math.min((presentation?.slides.length || 1) - 1, prev + 1))}
                    disabled={currentSlide === (presentation?.slides.length || 1) - 1}
                    className="p-2 rounded-lg bg-white border border-gray-200 hover:bg-gray-50 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </button>
                </div>

                {/* 错误信息 */}
                {error && !loading && (
                  <div className="mt-6 p-4 bg-red-50 text-red-600 rounded-lg text-sm max-w-md">
                    ❌ {error}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default function CreatePage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center text-gray-400">加载中...</div>}>
      <CreatePageInner />
    </Suspense>
  );
}
