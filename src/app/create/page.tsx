'use client';

import React, { useState, useEffect, useCallback, useRef, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Presentation } from '@/lib/types';

// Gamma 主题预设（基于技术部研究成果）
const GAMMA_THEMES = [
  { id: 'auto', name: '🎨 自动匹配', desc: '根据内容自动选择' },
  { id: 'consultant', name: '💼 商务汇报', desc: '专业、正式、简洁' },
  { id: 'founder', name: '🚀 路演融资', desc: '现代、极简、冲击力' },
  { id: 'icebreaker', name: '📚 培训课件', desc: '友好、清晰、易读' },
  { id: 'electric', name: '💡 创意方案', desc: '大胆、未来、色彩丰富' },
  { id: 'chisel', name: '🎓 教育课件', desc: '温暖、自然、大地色' },
  { id: 'gleam', name: '📊 数据分析', desc: '科技、极简、高对比' },
  { id: 'blues', name: '🏆 年度总结', desc: '高端、沉稳、蓝金' },
  { id: 'aurora', name: '🛸 产品发布', desc: '渐变、未来感、震撼' },
  { id: 'ashrose', name: '💄 美妆时尚', desc: '柔和、梦幻、优雅' },
  { id: 'default-light', name: '⬜ 简约白', desc: '干净、通用' },
  { id: 'default-dark', name: '⬛ 暗夜黑', desc: '深色、专业' },
];

// Gamma 风格预设
const GAMMA_STYLES = [
  { id: 'professional', name: '💼 专业商务', desc: '正式、严谨、汇报', tone: 'professional' },
  { id: 'casual', name: '😊 轻松友好', desc: '亲切、活泼、培训', tone: 'casual' },
  { id: 'creative', name: '🎨 创意活泼', desc: '大胆、丰富、方案', tone: 'creative' },
  { id: 'bold', name: '🚀 大胆科技', desc: '未来感、冲击力', tone: 'bold' },
  { id: 'elegant', name: '✨ 优雅高级', desc: '精致、质感、品牌', tone: 'professional' },
  { id: 'warm', name: '🌞 温馨自然', desc: '温暖、亲和、生活', tone: 'casual' },
  { id: 'academic', name: '🎓 学术严谨', desc: '规范、数据驱动', tone: 'professional' },
  { id: 'playful', name: '🎈 活泼趣味', desc: '年轻、有趣、校园', tone: 'casual' },
];

// 图片模式（基于技术部研究成果的分级体系）
const IMAGE_MODES = [
  { id: 'auto', name: '🤖 自动匹配', desc: '根据场景自动选择（不含AI生图）', locked: false },
  { id: 'none', name: '📄 无图纯净', desc: '纯文字+图标+色块，加载最快', locked: false },
  { id: 'web', name: '🖼️ 网图/主题图', desc: '自动搜索商用免费配图', locked: false },
  { id: 'ai', name: '🎨 AI定制图', desc: 'AI生成高质量配图（2 credits/图）', locked: true },
  { id: 'ai-pro', name: '💎 AI高级图', desc: '顶级AI配图（20 credits/图）', locked: true },
];

type PageMode = 'easy' | 'pro';
type Step = 'input' | 'outline' | 'generating' | 'done';

interface OutlineItem {
  id: string;
  title: string;
  content: string[];
  notes?: string;
}

interface UploadedFile {
  name: string;
  type: string;
  size: number;
  content?: string;
}

function CreatePageInner() {
  const searchParams = useSearchParams();
  const initialTopic = searchParams.get('topic') || '';

  // 核心状态
  const [pageMode, setPageMode] = useState<PageMode>('easy');
  const [step, setStep] = useState<Step>('input');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [progress, setProgress] = useState('');

  // 省心模式
  const [easyFiles, setEasyFiles] = useState<UploadedFile[]>([]);
  const [easyDragging, setEasyDragging] = useState(false);

  // 专业模式
  const [inputText, setInputText] = useState(initialTopic);
  const [proFiles, setProFiles] = useState<UploadedFile[]>([]);
  const [slideCount, setSlideCount] = useState<'auto' | number>('auto');
  const [textMode, setTextMode] = useState<'generate' | 'condense' | 'preserve'>('generate');
  const [selectedTheme, setSelectedTheme] = useState('auto');
  const [selectedStyle, setSelectedStyle] = useState('professional');
  const [selectedImageMode, setSelectedImageMode] = useState('auto');

  // 大纲
  const [outline, setOutline] = useState<OutlineItem[]>([]);
  const [outlineTitle, setOutlineTitle] = useState('');
  const [editingOutlineId, setEditingOutlineId] = useState<string | null>(null);

  // AI 推荐的主题配置（省心模式自动用，专业模式可选覆盖）
  const [aiThemeId, setAiThemeId] = useState<string | null>(null);
  const [aiTone, setAiTone] = useState<string | null>(null);
  const [aiImageMode, setAiImageMode] = useState<string | null>(null);

  // Gamma 结果
  const [gammaExportUrl, setGammaExportUrl] = useState<string | null>(null);
  const [gammaPreviewUrl, setGammaPreviewUrl] = useState<string | null>(null);

  // Refs
  const easyFileRef = useRef<HTMLInputElement>(null);
  const proFileRef = useRef<HTMLInputElement>(null);

  // ===== 文件处理 =====
  const processFiles = useCallback(async (files: FileList | File[]): Promise<UploadedFile[]> => {
    const processed: UploadedFile[] = [];
    for (const file of Array.from(files)) {
      const item: UploadedFile = { name: file.name, type: file.type, size: file.size };
      // 文本文件直接读取
      if (file.type === 'text/plain' || file.name.endsWith('.md') || file.name.endsWith('.txt') || file.name.endsWith('.csv')) {
        item.content = await file.text();
      }
      processed.push(item);
    }
    return processed;
  }, []);

  const handleEasyDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault();
    setEasyDragging(false);
    if (e.dataTransfer.files.length > 0) {
      const files = await processFiles(e.dataTransfer.files);
      setEasyFiles(prev => [...prev, ...files]);
    }
  }, [processFiles]);

  const handleEasyFileSelect = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.length) {
      const files = await processFiles(e.target.files);
      setEasyFiles(prev => [...prev, ...files]);
    }
  }, [processFiles]);

  const handleProFileSelect = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.length) {
      const files = await processFiles(e.target.files);
      setProFiles(prev => [...prev, ...files]);
    }
  }, [processFiles]);

  const removeFile = useCallback((list: 'easy' | 'pro', index: number) => {
    const setter = list === 'easy' ? setEasyFiles : setProFiles;
    setter(prev => prev.filter((_, i) => i !== index));
  }, []);

  // ===== 省心模式：一键生成 =====
  const handleEasyGenerate = useCallback(async () => {
    if (easyFiles.length === 0 && !inputText.trim()) return;

    setLoading(true);
    setError('');
    setStep('generating');
    setProgress('正在分析内容，生成大纲...');

    try {
      // 收集所有文本内容
      const textParts: string[] = [];
      easyFiles.forEach(f => {
        if (f.content) textParts.push(`[文件: ${f.name}]\n${f.content}`);
        else textParts.push(`[文件: ${f.name}]`);
      });
      if (inputText.trim()) textParts.push(inputText.trim());
      const fullText = textParts.join('\n\n');

      // Step 1: 用 GLM-5 生成大纲
      const outlineRes = await fetch('/api/outline', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ inputText: fullText, auto: true }),
      });

      if (!outlineRes.ok) {
        const data = await outlineRes.json();
        throw new Error(data.error || '大纲生成失败');
      }

      const outlineData = await outlineRes.json();
      setOutlineTitle(outlineData.title || 'PPT');
      setOutline(outlineData.slides || []);

      // 保存 AI 推荐的主题配置
      if (outlineData.themeId) setAiThemeId(outlineData.themeId);
      if (outlineData.tone) setAiTone(outlineData.tone);
      if (outlineData.imageMode) setAiImageMode(outlineData.imageMode);

      // Step 2: 构建 Gamma Markdown 并直接生成（使用AI推荐的主题配置）
      setProgress('正在生成PPT...');
      const gammaMarkdown = buildGammaMarkdown(outlineData.title, outlineData.slides || []);

      const gammaRes = await fetch('/api/gamma', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          inputText: gammaMarkdown,
          format: 'presentation',
          numCards: (outlineData.slides || []).length,
          exportAs: 'pptx',
          textMode: 'generate',
          themeId: outlineData.themeId || undefined,
          tone: outlineData.tone || undefined,
          imageMode: outlineData.imageMode || 'auto',
        }),
      });

      if (!gammaRes.ok) {
        const data = await gammaRes.json();
        throw new Error(data.error || 'PPT生成失败');
      }

      const gammaData = await gammaRes.json();
      if (gammaData.generationId) {
        // 轮询等待
        await pollGamma(gammaData.generationId);
      }

      setStep('done');
    } catch (err: any) {
      setError(err.message || '生成失败');
      setStep('input');
    } finally {
      setLoading(false);
    }
  }, [easyFiles, inputText]);

  // ===== 专业模式：生成大纲 =====
  const handleProOutline = useCallback(async () => {
    const textParts: string[] = [];
    proFiles.forEach(f => {
      if (f.content) textParts.push(`[文件: ${f.name}]\n${f.content}`);
      else textParts.push(`[文件: ${f.name}]`);
    });
    if (inputText.trim()) textParts.push(inputText.trim());
    const fullText = textParts.join('\n\n');

    if (!fullText.trim()) return;

    setLoading(true);
    setError('');
    setProgress('AI 正在生成大纲...');

    try {
      const numCards = slideCount === 'auto' ? 10 : slideCount;
      const res = await fetch('/api/outline', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ inputText: fullText, slideCount: numCards, textMode }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || '大纲生成失败');
      }

      const data = await res.json();
      setOutlineTitle(data.title || 'PPT');
      setOutline(data.slides || []);

      // 用 AI 推荐的主题配置预填（用户仍可修改）
      if (data.themeId) setSelectedTheme(data.themeId);
      if (data.tone) setSelectedStyle(data.tone);
      if (data.imageMode) setSelectedImageMode(data.imageMode);

      setStep('outline');
    } catch (err: any) {
      setError(err.message || '大纲生成失败');
    } finally {
      setLoading(false);
    }
  }, [inputText, proFiles, slideCount]);

  // ===== 专业模式：确认大纲 → Gamma 生成 =====
  const handleProConfirm = useCallback(async () => {
    if (outline.length === 0) return;

    setLoading(true);
    setError('');
    setStep('generating');
    setProgress('正在生成PPT...');

    try {
      const gammaMarkdown = buildGammaMarkdown(outlineTitle, outline);

      const gammaRes = await fetch('/api/gamma', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          inputText: gammaMarkdown,
          textMode: textMode,  // 专业模式按用户选择
          format: 'presentation',
          numCards: outline.length,
          exportAs: 'pptx',
          themeId: selectedTheme === 'auto' ? undefined : selectedTheme,
          tone: GAMMA_STYLES.find(s => s.id === selectedStyle)?.tone || 'professional',
          imageMode: selectedImageMode,
        }),
      });

      if (!gammaRes.ok) {
        const data = await gammaRes.json();
        throw new Error(data.error || 'PPT生成失败');
      }

      const gammaData = await gammaRes.json();
      if (gammaData.generationId) {
        await pollGamma(gammaData.generationId);
      }

      setStep('done');
    } catch (err: any) {
      setError(err.message || '生成失败');
      setStep('outline');
    } finally {
      setLoading(false);
    }
  }, [outline, outlineTitle, selectedTheme, selectedStyle, selectedImageMode]);

  // ===== Gamma 轮询 =====
  const pollGamma = useCallback(async (generationId: string) => {
    const maxAttempts = 48; // 4 minutes
    for (let i = 0; i < maxAttempts; i++) {
      await new Promise(r => setTimeout(r, 5000));
      const pct = Math.round(((i + 1) / maxAttempts) * 100);
      setProgress(`省事PPT生成中... ${pct}%`);

      try {
        const res = await fetch(`/api/gamma?id=${generationId}`);
        if (!res.ok) continue;
        const data = await res.json();

        if (data.status === 'completed') {
          setGammaExportUrl(data.exportUrl || null);
          setGammaPreviewUrl(data.gammaUrl || null);
          setProgress('PPT 生成完成！');
          return;
        }
        if (data.status === 'failed') {
          throw new Error(data.error || 'PPT生成失败');
        }
      } catch (err: any) {
        if (err.message?.includes('生成失败')) throw err;
        continue;
      }
    }
    throw new Error('PPT生成超时，请重试，请重试');
  }, []);

  // ===== 大纲编辑 =====
  const updateOutlineItem = useCallback((id: string, field: string, value: any) => {
    setOutline(prev => prev.map(item => {
      if (item.id !== id) return item;
      return { ...item, [field]: value };
    }));
  }, []);

  const addOutlineItem = useCallback((afterId?: string) => {
    const newItem: OutlineItem = {
      id: Math.random().toString(36).substring(2, 9),
      title: '新页面',
      content: ['要点1', '要点2', '要点3'],
    };
    setOutline(prev => {
      if (!afterId) return [...prev, newItem];
      const idx = prev.findIndex(i => i.id === afterId);
      return [...prev.slice(0, idx + 1), newItem, ...prev.slice(idx + 1)];
    });
  }, []);

  const removeOutlineItem = useCallback((id: string) => {
    setOutline(prev => prev.filter(i => i.id !== id));
  }, []);

  // ===== 重置 =====
  const handleReset = useCallback(() => {
    setStep('input');
    setGammaExportUrl(null);
    setGammaPreviewUrl(null);
    setError('');
    setProgress('');
    setOutline([]);
    setOutlineTitle('');
    setEasyFiles([]);
    setProFiles([]);
    setInputText('');
  }, []);

  // 构建文件大小显示
  const formatSize = (bytes: number) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

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
        {step !== 'input' && (
          <button
            onClick={handleReset}
            className="px-4 py-2 text-gray-600 hover:text-gray-800 text-sm font-medium transition-colors"
          >
            ← 重新开始
          </button>
        )}
      </nav>

      <div className="max-w-5xl mx-auto px-6 py-6">
        {/* ==================== INPUT STEP ==================== */}
        {step === 'input' && (
          <div className="animate-fade-in">
            {/* 模式切换 */}
            <div className="flex gap-2 mb-8 justify-center">
              <button
                onClick={() => setPageMode('easy')}
                className={`px-6 py-3 rounded-xl text-sm font-semibold transition-all ${
                  pageMode === 'easy'
                    ? 'bg-gradient-to-r from-blue-500 to-purple-600 text-white shadow-md'
                    : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'
                }`}
              >
                😎 省心模式
              </button>
              <button
                onClick={() => setPageMode('pro')}
                className={`px-6 py-3 rounded-xl text-sm font-semibold transition-all ${
                  pageMode === 'pro'
                    ? 'bg-gradient-to-r from-blue-500 to-purple-600 text-white shadow-md'
                    : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'
                }`}
              >
                ⚙️ 专业模式
              </button>
            </div>

            {/* ===== 省心模式 ===== */}
            {pageMode === 'easy' && (
              <div className="max-w-xl mx-auto">
                <div className="text-center mb-8">
                  <h1 className="text-2xl font-bold text-gray-900 mb-2">😎 省心模式</h1>
                  <p className="text-gray-500">把文件扔进来，AI 全自动处理，一键出 PPT</p>
                </div>

                <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-8">
                  {/* 拖拽区域 */}
                  <div
                    onDragOver={(e) => { e.preventDefault(); setEasyDragging(true); }}
                    onDragLeave={() => setEasyDragging(false)}
                    onDrop={handleEasyDrop}
                    onClick={() => easyFileRef.current?.click()}
                    className={`border-2 border-dashed rounded-xl p-10 text-center cursor-pointer transition-all ${
                      easyDragging
                        ? 'border-blue-500 bg-blue-50'
                        : 'border-gray-300 hover:border-blue-400 hover:bg-gray-50'
                    }`}
                  >
                    <div className="text-4xl mb-3">📎</div>
                    <p className="text-gray-700 font-medium">拖拽文件到此处，或点击上传</p>
                    <p className="text-gray-400 text-sm mt-2">
                      支持文档、表格、截图、文本等任意格式
                    </p>
                  </div>
                  <input
                    ref={easyFileRef}
                    type="file"
                    multiple
                    accept=".txt,.md,.doc,.docx,.pdf,.xls,.xlsx,.csv,.png,.jpg,.jpeg,.webp,.ppt,.pptx"
                    onChange={handleEasyFileSelect}
                    className="hidden"
                  />

                  {/* 可选：补充文字说明 */}
                  <textarea
                    value={inputText}
                    onChange={(e) => setInputText(e.target.value)}
                    placeholder="（可选）补充说明你的需求..."
                    className="w-full mt-4 px-4 py-3 rounded-xl border-2 border-gray-200 focus:border-blue-500 focus:outline-none resize-none transition-colors text-gray-800 text-sm"
                    rows={2}
                  />

                  {/* 已上传文件列表 */}
                  {easyFiles.length > 0 && (
                    <div className="mt-4 space-y-2">
                      {easyFiles.map((f, i) => (
                        <div key={i} className="flex items-center gap-3 p-2 bg-gray-50 rounded-lg">
                          <span className="text-lg">
                            {f.type.startsWith('image/') ? '🖼️' : f.name.match(/\.xls|\.csv/) ? '📊' : f.name.match(/\.doc|\.pdf|\.ppt/) ? '📄' : '📝'}
                          </span>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm text-gray-800 truncate">{f.name}</p>
                            <p className="text-xs text-gray-400">{formatSize(f.size)}</p>
                          </div>
                          <button
                            onClick={(e) => { e.stopPropagation(); removeFile('easy', i); }}
                            className="text-gray-400 hover:text-red-500 text-sm"
                          >
                            ✕
                          </button>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* 一键生成 */}
                  <button
                    onClick={handleEasyGenerate}
                    disabled={easyFiles.length === 0 && !inputText.trim()}
                    className="w-full mt-6 py-4 bg-gradient-to-r from-blue-500 to-purple-600 text-white rounded-xl font-semibold text-lg hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    🚀 一键生成PPT
                  </button>

                  {error && (
                    <div className="mt-4 p-3 bg-red-50 text-red-600 rounded-lg text-sm">
                      ❌ {error}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* ===== 专业模式 ===== */}
            {pageMode === 'pro' && (
              <div className="max-w-2xl mx-auto">
                <div className="text-center mb-8">
                  <h1 className="text-2xl font-bold text-gray-900 mb-2">⚙️ 专业模式</h1>
                  <p className="text-gray-500">自定义参数，精确控制每一页</p>
                </div>

                <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-8 space-y-6">
                  {/* 内容输入 */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      需求描述 / 内容 *
                    </label>
                    <textarea
                      value={inputText}
                      onChange={(e) => setInputText(e.target.value)}
                      placeholder="输入PPT主题或粘贴完整内容...\n支持粘贴文档、报告、大纲等"
                      className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 focus:border-blue-500 focus:outline-none resize-none transition-colors text-gray-800"
                      rows={5}
                    />
                    <div className="flex items-center gap-2 mt-2">
                      <input
                        ref={proFileRef}
                        type="file"
                        multiple
                        accept=".txt,.md,.doc,.docx,.pdf,.xls,.xlsx,.csv,.png,.jpg,.jpeg,.webp,.ppt,.pptx"
                        onChange={handleProFileSelect}
                        className="hidden"
                      />
                      <button
                        onClick={() => proFileRef.current?.click()}
                        className="px-3 py-1.5 text-xs text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
                      >
                        📎 上传附件
                      </button>
                      <span className="text-xs text-gray-400">支持文档、表格、图片</span>
                    </div>
                    {proFiles.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-2">
                        {proFiles.map((f, i) => (
                          <span key={i} className="inline-flex items-center gap-1 px-2 py-1 bg-blue-50 text-blue-700 text-xs rounded-lg">
                            {f.name}
                            <button onClick={() => removeFile('pro', i)} className="hover:text-red-500">✕</button>
                          </span>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* 页数选择 */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">页数</label>
                    <div className="flex items-center gap-4">
                      <button
                        onClick={() => setSlideCount('auto')}
                        className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                          slideCount === 'auto' ? 'bg-blue-500 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                        }`}
                      >
                        自动
                      </button>
                      {slideCount !== 'auto' && (
                        <div className="flex items-center gap-2">
                          <input
                            type="number"
                            min={3}
                            max={30}
                            value={slideCount}
                            onChange={(e) => setSlideCount(Math.max(3, Math.min(30, Number(e.target.value))))}
                            className="w-16 px-2 py-1 border border-gray-300 rounded-lg text-center text-sm"
                          />
                          <span className="text-sm text-gray-500">页</span>
                        </div>
                      )}
                      {slideCount === 'auto' && (
                        <span className="text-xs text-gray-400">AI 根据内容量自动决定</span>
                      )}
                    </div>
                  </div>

                  {/* PPT模式选择 */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">PPT生成模式</label>
                    <div className="grid grid-cols-3 gap-3">
                      <button
                        onClick={() => setTextMode('generate')}
                        className={`p-4 rounded-xl border-2 transition-all text-left ${
                          textMode === 'generate'
                            ? 'border-blue-500 bg-blue-50'
                            : 'border-gray-200 hover:border-gray-300'
                        }`}
                      >
                        <div className="text-xl mb-1">✨</div>
                        <div className={`text-sm font-semibold ${textMode === 'generate' ? 'text-blue-700' : 'text-gray-800'}`}>AI创作</div>
                        <div className="text-xs text-gray-400 mt-1">AI根据主题全新生成内容</div>
                      </button>
                      <button
                        onClick={() => setTextMode('condense')}
                        className={`p-4 rounded-xl border-2 transition-all text-left ${
                          textMode === 'condense'
                            ? 'border-blue-500 bg-blue-50'
                            : 'border-gray-200 hover:border-gray-300'
                        }`}
                      >
                        <div className="text-xl mb-1">📝</div>
                        <div className={`text-sm font-semibold ${textMode === 'condense' ? 'text-blue-700' : 'text-gray-800'}`}>智能摘要</div>
                        <div className="text-xs text-gray-400 mt-1">AI浓缩文档为PPT要点</div>
                      </button>
                      <button
                        onClick={() => setTextMode('preserve')}
                        className={`p-4 rounded-xl border-2 transition-all text-left ${
                          textMode === 'preserve'
                            ? 'border-blue-500 bg-blue-50'
                            : 'border-gray-200 hover:border-gray-300'
                        }`}
                      >
                        <div className="text-xl mb-1">📄</div>
                        <div className={`text-sm font-semibold ${textMode === 'preserve' ? 'text-blue-700' : 'text-gray-800'}`}>原文排版</div>
                        <div className="text-xs text-gray-400 mt-1">保留原文，只做排版美化</div>
                      </button>
                    </div>
                  </div>

                  {/* 主题选择 */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">主题风格</label>
                    <div className="grid grid-cols-4 gap-2">
                      {GAMMA_THEMES.map(t => (
                        <button
                          key={t.id}
                          onClick={() => setSelectedTheme(t.id)}
                          className={`p-3 rounded-xl border-2 transition-all text-left ${
                            selectedTheme === t.id
                              ? 'border-blue-500 bg-blue-50'
                              : 'border-gray-200 hover:border-gray-300'
                          }`}
                        >
                          <div className="text-xs font-semibold text-gray-800">{t.name}</div>
                          <div className="text-[10px] text-gray-400 mt-0.5">{t.desc}</div>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* 语气风格 */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">语气风格</label>
                    <div className="grid grid-cols-4 gap-2">
                      {GAMMA_STYLES.map(s => (
                        <button
                          key={s.id}
                          onClick={() => setSelectedStyle(s.id)}
                          className={`p-3 rounded-xl border-2 transition-all text-left ${
                            selectedStyle === s.id
                              ? 'border-blue-500 bg-blue-50'
                              : 'border-gray-200 hover:border-gray-300'
                          }`}
                        >
                          <div className="text-sm font-semibold text-gray-800">{s.name}</div>
                          <div className="text-[10px] text-gray-400 mt-0.5">{s.desc}</div>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* 图片模式 */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">配图方式</label>
                    <div className="grid grid-cols-5 gap-2">
                      {IMAGE_MODES.map(m => (
                        <button
                          key={m.id}
                          onClick={() => m.locked ? undefined : setSelectedImageMode(m.id)}
                          className={`relative p-3 rounded-xl border-2 transition-all text-left ${
                            m.locked
                              ? 'border-gray-200 bg-gray-50 opacity-60 cursor-not-allowed'
                              : selectedImageMode === m.id
                                ? 'border-blue-500 bg-blue-50'
                                : 'border-gray-200 hover:border-gray-300 cursor-pointer'
                          }`}
                          title={m.locked ? '会员功能' : undefined}
                        >
                          {m.locked && (
                            <span className="absolute top-1 right-1 text-[10px] bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded-full font-medium">VIP</span>
                          )}
                          <div className="text-sm font-semibold text-gray-800">{m.name}</div>
                          <div className="text-[10px] text-gray-400 mt-0.5 leading-tight">{m.desc}</div>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* 生成大纲 */}
                  <button
                    onClick={handleProOutline}
                    disabled={loading || (!inputText.trim() && proFiles.length === 0)}
                    className="w-full py-4 bg-gradient-to-r from-blue-500 to-purple-600 text-white rounded-xl font-semibold text-lg hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    📋 生成大纲
                  </button>

                  {error && (
                    <div className="p-3 bg-red-50 text-red-600 rounded-lg text-sm">
                      ❌ {error}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ==================== OUTLINE STEP ==================== */}
        {step === 'outline' && (
          <div className="animate-fade-in">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-xl font-bold text-gray-900">📋 大纲预览</h2>
                <p className="text-sm text-gray-500 mt-1">共 {outline.length} 页 · 点击任意内容可编辑</p>
              </div>
              <button
                onClick={() => setStep('input')}
                className="text-gray-500 hover:text-gray-700 text-sm"
              >
                ← 返回修改参数
              </button>
            </div>

            {/* 标题编辑 */}
            <div className="bg-white rounded-xl border border-gray-200 p-4 mb-4">
              <input
                value={outlineTitle}
                onChange={(e) => setOutlineTitle(e.target.value)}
                className="text-xl font-bold text-gray-900 w-full outline-none"
                placeholder="PPT 标题"
              />
            </div>

            {/* 大纲列表 */}
            <div className="space-y-3">
              {outline.map((item, index) => (
                <div
                  key={item.id}
                  className={`bg-white rounded-xl border border-gray-200 p-4 transition-all ${
                    editingOutlineId === item.id ? 'ring-2 ring-blue-500' : 'hover:border-gray-300'
                  }`}
                  onClick={() => setEditingOutlineId(item.id)}
                >
                  <div className="flex items-start gap-3">
                    <span className="flex-shrink-0 w-7 h-7 rounded-full bg-blue-100 text-blue-600 text-sm font-bold flex items-center justify-center mt-0.5">
                      {index + 1}
                    </span>
                    <div className="flex-1 min-w-0">
                      <input
                        value={item.title}
                        onChange={(e) => updateOutlineItem(item.id, 'title', e.target.value)}
                        className="font-semibold text-gray-800 w-full outline-none text-base"
                        placeholder="页面标题"
                      />
                      <div className="mt-2 space-y-1">
                        {(item.content || []).map((point, pi) => (
                          <input
                            key={pi}
                            value={point}
                            onChange={(e) => {
                              const newContent = [...(item.content || [])];
                              newContent[pi] = e.target.value;
                              updateOutlineItem(item.id, 'content', newContent);
                            }}
                            className="text-sm text-gray-600 w-full outline-none pl-4 border-l-2 border-gray-200 py-0.5"
                            placeholder={`要点 ${pi + 1}`}
                          />
                        ))}
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            updateOutlineItem(item.id, 'content', [...(item.content || []), '新要点']);
                          }}
                          className="text-xs text-blue-500 hover:text-blue-700 pl-4 mt-1"
                        >
                          + 添加要点
                        </button>
                      </div>
                    </div>
                    <button
                      onClick={(e) => { e.stopPropagation(); removeOutlineItem(item.id); }}
                      className="text-gray-300 hover:text-red-500 text-sm mt-1"
                    >
                      🗑️
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {/* 添加页面 */}
            <button
              onClick={() => addOutlineItem()}
              className="w-full mt-4 py-3 border-2 border-dashed border-gray-300 rounded-xl text-gray-500 hover:text-blue-600 hover:border-blue-400 transition-colors text-sm"
            >
              + 添加新页面
            </button>

            {/* 确认生成 */}
            <button
              onClick={handleProConfirm}
              disabled={loading || outline.length === 0}
              className="w-full mt-6 py-4 bg-gradient-to-r from-blue-500 to-purple-600 text-white rounded-xl font-semibold text-lg hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              ✅ 确认大纲，生成PPT
            </button>

            {error && (
              <div className="mt-4 p-3 bg-red-50 text-red-600 rounded-lg text-sm">
                ❌ {error}
              </div>
            )}
          </div>
        )}

        {/* ==================== GENERATING STEP ==================== */}
        {step === 'generating' && (
          <div className="flex items-center justify-center min-h-[60vh] animate-fade-in">
            <div className="text-center">
              <div className="loading-dots text-3xl mb-4">
                <span></span>
                <span></span>
                <span></span>
              </div>
              <p className="text-gray-600 text-lg">{progress || '正在生成...'}</p>
            </div>
          </div>
        )}

        {/* ==================== DONE STEP ==================== */}
        {step === 'done' && (
          <div className="animate-fade-in h-screen flex flex-col">
            {/* 顶部操作栏 */}
            <div className="bg-white border-b border-gray-200 px-6 py-3 flex items-center justify-between flex-shrink-0">
              <div className="flex items-center gap-3">
                <Link href="/" className="flex items-center gap-2">
                  <div className="w-7 h-7 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg flex items-center justify-center">
                    <span className="text-white text-xs font-bold">P</span>
                  </div>
                  <span className="font-bold text-gray-800">省事PPT</span>
                </Link>
                <span className="text-gray-300">|</span>
                <span className="text-sm text-gray-500">{outlineTitle}</span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => { setStep('outline'); setGammaExportUrl(null); setGammaPreviewUrl(null); }}
                  className="px-3 py-2 text-gray-600 hover:text-gray-800 text-sm font-medium transition-colors"
                >
                  ← 返回编辑大纲
                </button>
                {gammaExportUrl && (
                  <a
                    href={gammaExportUrl}
                    download
                    className="px-4 py-2 bg-gradient-to-r from-green-500 to-emerald-600 text-white rounded-lg font-semibold text-sm hover:shadow-lg transition-all flex items-center gap-2"
                  >
                    📥 下载PPT
                  </a>
                )}
                <button
                  onClick={handleReset}
                  className="px-3 py-2 text-gray-500 hover:text-gray-700 text-sm transition-colors"
                >
                  新建
                </button>
              </div>
            </div>

            {/* 预览区域 */}
            <div className="flex-1 bg-gray-100">
              {gammaPreviewUrl ? (
                <iframe
                  src={`/api/preview?url=${encodeURIComponent(gammaPreviewUrl)}`}
                  className="w-full h-full border-0"
                  title="PPT在线预览"
                  allow="fullscreen"
                />
              ) : gammaExportUrl ? (
                <div className="flex items-center justify-center h-full">
                  <div className="text-center bg-white rounded-2xl shadow-sm border border-gray-200 p-12 max-w-md">
                    <div className="text-5xl mb-4">📄</div>
                    <h3 className="text-lg font-bold text-gray-900 mb-2">PPT 已生成完毕！</h3>
                    <p className="text-sm text-gray-500 mb-6">
                      在线预览暂不可用，请下载后查看
                    </p>
                    <a
                      href={gammaExportUrl}
                      download
                      className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-green-500 to-emerald-600 text-white rounded-xl font-semibold hover:shadow-lg transition-all"
                    >
                      📥 下载PPT文件
                    </a>
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-center h-full">
                  <div className="text-center p-4 bg-yellow-50 rounded-xl">
                    ⚠️ PPT 生成失败，请重试
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// 构建 Gamma Markdown（基于技术部研究的排版触发规则）
function buildGammaMarkdown(title: string, slides: OutlineItem[]): string {
  const parts: string[] = [];

  // 封面（# 触发封面布局）
  parts.push(`# ${title}\n`);

  for (let i = 0; i < slides.length; i++) {
    const slide = slides[i];
    parts.push('---');
    parts.push('');

    // 最后一页：结尾页
    if (i === slides.length - 1 && (slide.title.includes('感谢') || slide.title.includes('谢谢') || slide.title.includes('Thank') || slide.title.includes('总结'))) {
      parts.push(`# ${slide.title}`);
      parts.push('');
      if (slide.content?.length) {
        parts.push(`> ${slide.content.join('；')}`);
      }
      continue;
    }

    // 第二页：目录页（用有序列表触发时间轴/流程布局）
    if (i === 1 && (slide.title.includes('目录') || slide.title.includes('概览') || slide.title.includes('Overview'))) {
      parts.push(`## ${slide.title}`);
      parts.push('');
      if (slide.content?.length) {
        // 有序列表触发时间轴布局
        slide.content.forEach((item, idx) => {
          parts.push(`${idx + 1}. **${item.trim()}**`);
        });
        parts.push('');
      }
      continue;
    }

    // 内容页
    parts.push(`## ${slide.title}`);
    parts.push('');

    if (slide.content?.length) {
      // 3个或4个要点 → 用 - **标题** 触发卡片布局
      if (slide.content.length <= 4) {
        for (const point of slide.content) {
          if (point.trim()) {
            parts.push(`- **${point.trim()}**`);
            parts.push('');
          }
        }
      } else {
        // 超过4个要点 → 用 ### 触发大文本，每项一个
        for (const point of slide.content) {
          if (point.trim()) {
            parts.push(`### ${point.trim()}`);
            parts.push('');
          }
        }
      }
    }

    // 演讲者备注（> 触发备注区域）
    if (slide.notes) {
      parts.push(`> ${slide.notes}`);
      parts.push('');
    }
  }

  return parts.join('\n');
}

export default function CreatePage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center text-gray-400">加载中...</div>}>
      <CreatePageInner />
    </Suspense>
  );
}
