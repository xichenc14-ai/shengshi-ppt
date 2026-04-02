'use client';

import React, { useState, useCallback, useRef } from 'react';

/* ==================== 配置数据 ==================== */

// 生成模式（精简为4个）
const GEN_MODES = [
  { id: 'easy', name: '省心智能', icon: '✨', desc: 'AI全自动，一步到位' },
  { id: 'generate', name: 'AI创作', icon: '🤖', desc: '从零生成完整内容' },
  { id: 'condense', name: '智能摘要', icon: '📝', desc: '提炼文档为要点' },
  { id: 'preserve', name: '原文排版', icon: '📄', desc: '保留原文美化排版' },
];

// 主题色系预设（8个，用色块展示）
const THEME_COLORS = [
  { id: 'auto', name: '智能匹配', colors: ['#8B5CF6', '#A78BFA', '#C4B5FD'] },
  { id: 'business-blue', name: '商务蓝', colors: ['#3B82F6', '#60A5FA', '#93C5FD'] },
  { id: 'roadshow-purple', name: '路演紫', colors: ['#8B5CF6', '#A855F7', '#C084FC'] },
  { id: 'creative-orange', name: '创意橙', colors: ['#F97316', '#FB923C', '#FDBA74'] },
  { id: 'earth-brown', name: '大地棕', colors: ['#92400E', '#B45309', '#D97706'] },
  { id: 'premium-gold', name: '高级金', colors: ['#D97706', '#F59E0B', '#FBBF24'] },
  { id: 'tech-cyan', name: '科技青', colors: ['#06B6D4', '#22D3EE', '#67E8F9'] },
  { id: 'minimal-white', name: '极简白', colors: ['#E5E7EB', '#F3F4F6', '#F9FAFB'] },
];

// 语气风格（精简为3个）
const TONE_STYLES = [
  { id: 'professional', name: '专业商务', icon: '💼' },
  { id: 'casual', name: '轻松友好', icon: '😊' },
  { id: 'creative', name: '创意活泼', icon: '🎨' },
];

// 配图方式（精简为3个）
const IMAGE_MODES = [
  { id: 'auto', name: '自动', desc: '智能配图' },
  { id: 'none', name: '无图', desc: '纯文字' },
  { id: 'web', name: '精选', desc: '商用图' },
];

// 场景展示（6个）
const SCENARIOS = [
  { icon: '💼', title: '工作汇报', desc: '周报、月报、季度总结，一键生成专业汇报', color: 'from-[#5B4FE9] to-[#4F46E5]' },
  { icon: '🚀', title: '商业路演', desc: '融资BP、产品推介，打动投资人', color: 'from-[#5B4FE9] to-[#8B5CF6]' },
  { icon: '🎓', title: '教学课件', desc: '课程大纲、培训材料，老师的好帮手', color: 'from-emerald-500 to-teal-600' },
  { icon: '📊', title: '数据分析', desc: '数据报告、趋势分析，让数据会说话', color: 'from-orange-500 to-red-500' },
  { icon: '🛍️', title: '营销策划', desc: '活动方案、品牌提案，创意满分', color: 'from-pink-500 to-rose-600' },
  { icon: '📝', title: '毕业答辩', desc: '论文答辩、课题汇报，顺利过关', color: 'from-[#5B4FE9] to-[#4F46E5]' },
];

type UploadedFile = { name: string; type: string; size: number; content?: string };

export default function Home() {
  // 输入状态（共享）
  const [files, setFiles] = useState<UploadedFile[]>([]);
  const [topic, setTopic] = useState('');
  const [dragging, setDragging] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  // 专业模式状态
  const [showPro, setShowPro] = useState(false);
  const [genMode, setGenMode] = useState('easy');
  const [themeColor, setThemeColor] = useState('auto');
  const [tone, setTone] = useState('professional');
  const [pages, setPages] = useState<'auto' | number>('auto');
  const [imgMode, setImgMode] = useState('auto');

  // 通用状态
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [step, setStep] = useState(0);
  const [stepText, setStepText] = useState('');
  const [result, setResult] = useState<{ title: string; slides: any[]; dlUrl: string } | null>(null);

  // 用户状态
  const [showLogin, setShowLogin] = useState(false);
  const [loginPhone, setLoginPhone] = useState('');
  const [loginLoading, setLoginLoading] = useState(false);
  const [loginError, setLoginError] = useState('');
  const [user, setUser] = useState<{ id: string; phone: string; nickname: string; credits: number; plan_type: string; is_new: boolean } | null>(null);

  // 文件处理
  const processFiles = useCallback(async (filesList: FileList | File[]) => {
    const r: UploadedFile[] = [];
    for (const file of Array.from(filesList)) {
      const i: UploadedFile = { name: file.name, type: file.type, size: file.size };
      if (file.type === 'text/plain' || /\.(md|txt|csv)$/.test(file.name)) i.content = await file.text();
      r.push(i);
    }
    return r;
  }, []);

  const onDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    if (e.dataTransfer.files.length > 0) {
      const f = await processFiles(e.dataTransfer.files);
      setFiles(p => [...p, ...f]);
    }
  }, [processFiles]);

  const onFileChange = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.length) {
      const f = await processFiles(e.target.files);
      setFiles(p => [...p, ...f]);
    }
    e.target.value = '';
  }, [processFiles]);

  const removeFile = useCallback((index: number) => {
    setFiles(p => p.filter((_, i) => i !== index));
  }, []);

  const fmtSize = (b: number) => b < 1024 ? b + ' B' : b < 1048576 ? (b / 1024).toFixed(1) + ' KB' : (b / 1048576).toFixed(1) + ' MB';

  const collectText = () => {
    const p: string[] = [];
    files.forEach(f => {
      p.push(f.content ? `[${f.name}]\n${f.content}` : `[${f.name}]`);
    });
    if (topic.trim()) p.push(topic.trim());
    return p.join('\n\n');
  };

  // 生成函数（保留所有现有逻辑）
  const generate = useCallback(async (inputText: string, auto: boolean, tm: string, sc: number | 'auto', th?: string, tn?: string, im?: string) => {
    setLoading(true);
    setError('');
    setResult(null);
    setStep(0);
    setStepText('正在分析你的需求...');

    try {
      const numC = sc === 'auto' ? 10 : sc;
      setStep(1);
      setStepText('AI正在生成大纲内容...');

      const oRes = await fetch('/api/outline', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ inputText, slideCount: numC, textMode: auto ? 'generate' : tm, auto }),
      });

      if (!oRes.ok) {
        const d = await oRes.json();
        throw new Error(d.error || '大纲生成失败');
      }

      const od = await oRes.json();
      const actualMode = auto ? 'generate' : tm;
      const actualPages = (od.slides || []).length;

      // 扣积分
      if (user) {
        setStep(1);
        setStepText('检查积分...');
        const deductRes = await fetch('/api/user', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'deduct', userId: user.id, mode: actualMode, numPages: actualPages }),
        });
        const deductData = await deductRes.json();

        if (!deductRes.ok || deductData.error) {
          if (deductData.error === '积分不足') {
            throw new Error(`积分不足！需要${deductData.needed}积分，当前余额${deductData.balance}积分`);
          }
          throw new Error(deductData.error || '积分扣除失败');
        }

        setUser(prev => prev ? { ...prev, credits: deductData.balance } : null);
        setStepText(`已扣除${deductData.creditsUsed}积分`);
      }

      if (auto || tm === 'easy') {
        setStep(2);
        setStepText('AI正在渲染PPT，请耐心等待...');

        const md = buildMd(od.title, od.slides || []);
        const gRes = await fetch('/api/gamma', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            inputText: md,
            textMode: auto ? 'generate' : tm,
            format: 'presentation',
            numCards: (od.slides || []).length,
            exportAs: 'pptx',
            themeId: th || od.themeId || undefined,
            tone: tn || od.tone || 'professional',
            imageMode: im || od.imageMode || 'auto',
          }),
        });

        if (!gRes.ok) throw new Error('PPT生成失败');
        const gd = await gRes.json();

        if (gd.generationId) {
          setStep(2);
          setStepText('PPT渲染中，预计30-60秒...');
          let pollCount = 0;

          const pollStep = () => new Promise<void>((resolve, reject) => {
            const timer = setInterval(async () => {
              pollCount++;
              try {
                const r = await fetch(`/api/gamma?id=${gd.generationId}`);
                if (!r.ok) return;
                const d = await r.json();
                if (d.status === 'completed') {
                  clearInterval(timer);
                  resolve();
                } else if (d.status === 'failed') {
                  clearInterval(timer);
                  reject(new Error('PPT生成失败'));
                } else {
                  setStepText(`PPT渲染中... (${pollCount * 5}秒)`);
                }
              } catch (e: any) {
                if (e.message?.includes('失败')) {
                  clearInterval(timer);
                  reject(e);
                }
              }
            }, 5000);
            setTimeout(() => {
              clearInterval(timer);
              reject(new Error('PPT生成超时'));
            }, 240000);
          });

          await pollStep();
          setStep(3);
          setStepText('准备下载...');

          const finalRes = await fetch(`/api/gamma?id=${gd.generationId}`);
          const finalData = await finalRes.json();
          setResult({ title: od.title, slides: od.slides || [], dlUrl: finalData.exportUrl || '' });
          setStep(4);
        }
      } else {
        setStep(3);
        setResult({ title: od.title, slides: od.slides || [], dlUrl: '' });
        setStep(4);
      }

      setLoading(false);
    } catch (e: any) {
      setError(e.message || '生成失败');
      setLoading(false);
      setStep(0);
    }
  }, [user]);

  // 省心模式一键生成
  const handleEasyGenerate = () => {
    if (files.length === 0 && !topic.trim()) return;
    if (!user) {
      setShowLogin(true);
      return;
    }
    generate(collectText(), true, 'generate', 'auto');
  };

  // 专业模式生成
  const handleProGenerate = () => {
    if (!collectText().trim()) return;
    if (!user) {
      setShowLogin(true);
      return;
    }
    if (genMode === 'easy') {
      generate(
        collectText(),
        true,
        'generate',
        pages,
        themeColor === 'auto' ? undefined : themeColor,
        tone,
        imgMode === 'auto' ? undefined : imgMode
      );
    } else {
      generate(collectText(), false, genMode, pages);
    }
  };

  // 重置
  const reset = () => {
    setLoading(false);
    setError('');
    setResult(null);
    setFiles([]);
    setTopic('');
    setShowPro(false);
  };

  // 登录
  const handleLogin = async () => {
    if (!loginPhone || !/^1[3-9]\d{9}$/.test(loginPhone)) return;
    setLoginLoading(true);
    setLoginError('');
    try {
      const res = await fetch('/api/user', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'login', phone: loginPhone }),
      });
      const data = await res.json();
      if (data.error) {
        setLoginError(data.error);
        setLoginLoading(false);
        return;
      }
      if (data.user) {
        setUser(data.user);
        setShowLogin(false);
        setLoginPhone('');
        localStorage.setItem('sx_user', JSON.stringify(data.user));
      }
    } catch {
      setLoginError('登录失败，请重试');
    }
    setLoginLoading(false);
  };

  const handleCloseLogin = () => {
    setShowLogin(false);
    setLoginPhone('');
    setLoginError('');
  };

  const handleLogout = () => {
    setUser(null);
    localStorage.removeItem('sx_user');
  };

  // 恢复登录态
  React.useEffect(() => {
    try {
      const saved = localStorage.getItem('sx_user');
      if (saved) setUser(JSON.parse(saved));
    } catch {}
  }, []);

  const resultOutline = result?.slides || [];

  return (
    <div className="min-h-screen bg-[#fafbfc] flex flex-col">
      {/* 导航 */}
      <nav className="bg-white/80 backdrop-blur-xl border-b border-gray-100/80 px-8 py-3 flex items-center justify-between sticky top-0 z-50">
        <button onClick={reset} className="flex items-center gap-2.5 group">
          <div className="w-8 h-8 bg-gradient-to-br from-[#5B4FE9] to-[#8B5CF6] rounded-xl flex items-center justify-center shadow-lg shadow-[#DDD6FE]/50">
            <span className="text-white text-sm font-bold">P</span>
          </div>
          <span className="text-lg font-bold bg-gradient-to-r from-gray-900 to-gray-600 bg-clip-text text-transparent">省心PPT</span>
        </button>
        <div className="flex items-center gap-3">
          {result && (
            <button onClick={reset} className="text-sm text-gray-400 hover:text-gray-700 transition-colors">
              ← 新建
            </button>
          )}
          {user ? (
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1.5 px-3 py-1.5 bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-100 rounded-xl">
                <span className="text-amber-500 text-xs">🪙</span>
                <span className="text-xs font-bold text-amber-700">{user.credits}</span>
              </div>
              <span className="text-xs text-gray-400">{user.nickname}</span>
              <button onClick={handleLogout} className="text-xs text-gray-300 hover:text-gray-500">
                退出
              </button>
            </div>
          ) : (
            <button
              onClick={() => setShowLogin(true)}
              className="px-4 py-2 text-xs font-medium text-white bg-gradient-to-r from-[#5B4FE9] to-[#8B5CF6] rounded-xl hover:shadow-lg hover:shadow-[#DDD6FE]/50 transition-all"
            >
              登录
            </button>
          )}
        </div>
      </nav>

      <div className="flex-1">
        {/* Loading overlay */}
        {loading && (
          <div className="fixed inset-0 bg-white/80 backdrop-blur-sm flex items-center justify-center z-50">
            <div className="text-center animate-fade-in w-full max-w-sm mx-4">
              <div className="w-full h-1.5 bg-gray-100 rounded-full overflow-hidden mb-8">
                <div
                  className="h-full bg-gradient-to-r from-[#5B4FE9] to-[#8B5CF6] rounded-full transition-all duration-700 ease-out"
                  style={{ width: `${Math.min(95, (step / 4) * 100)}%` }}
                />
              </div>

              <div className="w-20 h-20 mx-auto mb-6 rounded-3xl bg-gradient-to-br from-[#EDE9FE] to-[#DDD6FE] flex items-center justify-center relative">
                {step < 2 ? (
                  <div className="w-12 h-12 rounded-full border-4 border-[#A78BFA] border-t-[#5B4FE9] animate-spin" />
                ) : step < 4 ? (
                  <div className="text-3xl animate-pulse">🎨</div>
                ) : (
                  <div className="text-3xl">✅</div>
                )}
              </div>

              <p className="text-lg font-bold text-gray-900 mb-1">
                {step < 2 ? '正在分析需求' : step === 2 ? 'AI渲染中' : step === 3 ? '准备下载' : '完成！'}
              </p>
              <p className="text-sm text-gray-400 mb-8">{stepText || '请稍候...'}</p>

              <div className="flex items-center justify-center gap-2">
                {[
                  { icon: '📝', label: '分析需求' },
                  { icon: '📋', label: '生成大纲' },
                  { icon: '🎨', label: '渲染PPT' },
                  { icon: '📥', label: '下载' },
                ].map((s, i) => (
                  <React.Fragment key={i}>
                    <div className={`flex flex-col items-center gap-1 ${i <= step ? 'opacity-100' : 'opacity-30'}`}>
                      <div
                        className={`w-8 h-8 rounded-xl flex items-center justify-center text-sm transition-all ${
                          i < step
                            ? 'bg-green-100 text-green-600'
                            : i === step
                            ? 'bg-[#EDE9FE] text-[#4F46E5] scale-110 shadow-lg shadow-[#DDD6FE]/50'
                            : 'bg-gray-100 text-gray-400'
                        }`}
                      >
                        {i < step ? '✓' : s.icon}
                      </div>
                      <span className="text-[10px] font-medium text-gray-500">{s.label}</span>
                    </div>
                    {i < 3 && <div className={`w-4 h-px ${i < step ? 'bg-green-300' : 'bg-gray-200'}`} />}
                  </React.Fragment>
                ))}
              </div>

              <button
                onClick={() => {
                  setLoading(false);
                  setError('已取消');
                  setStep(0);
                }}
                className="mt-8 text-xs text-gray-300 hover:text-gray-500 transition-colors"
              >
                取消生成
              </button>
            </div>
          </div>
        )}

        {/* Login Modal */}
        {showLogin && !user && (
          <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50" onClick={handleCloseLogin}>
            <div className="relative bg-white rounded-3xl shadow-2xl p-8 w-full max-w-sm mx-4" onClick={e => e.stopPropagation()}>
              <button onClick={handleCloseLogin} className="absolute top-4 right-4 text-gray-300 hover:text-gray-500 text-lg">
                ✕
              </button>

              <div className="text-center mb-6">
                <div className="w-12 h-12 mx-auto mb-3 rounded-2xl bg-gradient-to-br from-[#5B4FE9] to-[#8B5CF6] flex items-center justify-center">
                  <span className="text-white text-lg font-bold">P</span>
                </div>
                <h3 className="text-lg font-bold text-gray-900">登录省心PPT</h3>
                <p className="text-xs text-gray-400 mt-1">登录即送100积分，免费生成PPT</p>
              </div>

              <div className="space-y-3">
                <input
                  type="tel"
                  value={loginPhone}
                  onChange={e => setLoginPhone(e.target.value)}
                  placeholder="请输入手机号"
                  maxLength={11}
                  className="w-full px-4 py-3 rounded-xl bg-gray-50 border border-gray-200 focus:border-[#8B5CF6] focus:ring-2 focus:ring-[#EDE9FE] focus:bg-white outline-none transition-all text-sm"
                />
                <button
                  onClick={handleLogin}
                  disabled={!loginPhone || !/^1[3-9]\d{9}$/.test(loginPhone) || loginLoading}
                  className="w-full py-3 bg-gradient-to-r from-[#5B4FE9] to-[#8B5CF6] text-white rounded-xl font-semibold text-sm disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {loginLoading && <div className="w-4 h-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />}
                  {loginLoading ? '登录中...' : '登录 / 注册'}
                </button>
              </div>

              {loginError && <p className="text-center text-xs text-red-500 mt-3">{loginError}</p>}
              <p className="text-center text-[10px] text-gray-300 mt-4">MVP演示版 · 手机号即账号 · 短信验证码待接入</p>
            </div>
          </div>
        )}

        {/* 结果页 */}
        {result && !loading && (
          <div className="max-w-3xl mx-auto px-6 py-12 text-center animate-fade-in">
            <div className="text-5xl mb-4">🎉</div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">PPT 已生成！</h2>
            <p className="text-gray-400 mb-8">
              {result.title} · {resultOutline.length} 页
            </p>

            {resultOutline.length > 0 && (
              <div className="bg-white rounded-3xl shadow-sm shadow-gray-100/50 border border-gray-100 p-6 mb-6 text-left">
                <h3 className="text-sm font-semibold text-gray-800 mb-3">📄 内容大纲</h3>
                <div className="grid grid-cols-2 gap-2">
                  {resultOutline.map((item, i) => (
                    <div key={item.id} className="flex items-start gap-2 px-3 py-2.5 bg-gray-50/80 rounded-xl">
                      <span className="flex-shrink-0 w-5 h-5 rounded-full bg-[#EDE9FE] text-[#4F46E5] text-[10px] font-bold flex items-center justify-center mt-0.5">
                        {i + 1}
                      </span>
                      <div className="min-w-0">
                        <div className="text-xs font-semibold text-gray-800 truncate">{item.title}</div>
                        <div className="text-[10px] text-gray-400 truncate">
                          {item.content?.slice(0, 2).join(' · ')}
                          {item.content?.length > 2 ? ` · +${item.content.length - 2}` : ''}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="flex items-center justify-center gap-4">
              {result.dlUrl && (
                <a
                  href={result.dlUrl}
                  download
                  className="inline-flex items-center gap-2 px-8 py-3.5 bg-gradient-to-r from-green-500 to-emerald-600 text-white rounded-2xl font-semibold text-sm hover:shadow-lg hover:shadow-green-200/60 transition-all"
                >
                  📥 下载PPT文件
                </a>
              )}
              <button onClick={reset} className="px-6 py-3.5 text-gray-500 hover:text-gray-700 text-sm font-medium transition-colors">
                继续创建
              </button>
            </div>
          </div>
        )}

        {/* 主页（单页设计） */}
        {!result && !loading && (
          <div className="max-w-6xl mx-auto px-6 py-6 animate-fade-in">
            {/* Hero 区 */}
            <div className="text-center mb-12 pt-8">
              <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-[#F5F3FF] text-[#4F46E5] rounded-full text-sm font-medium mb-6">
                <span>✨</span>
                <span>AI驱动 · 一键生成专业PPT</span>
              </div>
              <h1 className="text-5xl font-extrabold mb-4 bg-gradient-to-r from-[#4F46E5] via-[#5B4FE9] to-[#8B5CF6] bg-clip-text text-transparent leading-tight">
                让每一份PPT
                <br />
                都令人惊艳
              </h1>
              <p className="text-gray-400 text-lg max-w-xl mx-auto">拖入文件或输入主题，AI自动完成内容创作与精美排版，分钟级交付专业PPT</p>
            </div>

            {/* 输入区域 + 省心模式按钮 */}
            <div className="max-w-4xl mx-auto mb-6">
              <div className="flex flex-col lg:flex-row gap-4">
                {/* 左侧：拖拽上传 + 文本输入 */}
                <div className="flex-1 bg-white rounded-3xl shadow-sm shadow-gray-100/50 border border-gray-100 p-6">
                  <div
                    onDragOver={e => {
                      e.preventDefault();
                      setDragging(true);
                    }}
                    onDragLeave={() => setDragging(false)}
                    onDrop={onDrop}
                    onClick={() => fileRef.current?.click()}
                    className={`border-2 border-dashed rounded-2xl p-8 text-center cursor-pointer transition-all duration-200 ${
                      dragging ? 'border-[#8B5CF6] bg-[#F5F3FF]/50' : 'border-gray-200 hover:border-[#A78BFA] hover:bg-gray-50/50'
                    }`}
                  >
                    <div className="w-12 h-12 mx-auto mb-3 rounded-2xl bg-gradient-to-br from-[#EDE9FE] to-[#DDD6FE] flex items-center justify-center text-xl">
                      📎
                    </div>
                    <p className="text-gray-600 font-medium text-sm">拖拽文件到这里</p>
                    <p className="text-gray-400 text-xs mt-1">或点击选择文件</p>
                  </div>
                  <input
                    ref={fileRef}
                    type="file"
                    multiple
                    accept=".txt,.md,.doc,.docx,.pdf,.xls,.xlsx,.csv,.png,.jpg,.jpeg,.webp,.ppt,.pptx"
                    onChange={onFileChange}
                    className="hidden"
                  />
                  <textarea
                    value={topic}
                    onChange={e => setTopic(e.target.value)}
                    placeholder="输入PPT主题或补充说明..."
                    className="w-full mt-4 px-4 py-3 rounded-xl bg-gray-50/80 border border-gray-200 focus:border-[#8B5CF6] focus:ring-2 focus:ring-[#EDE9FE] focus:bg-white outline-none resize-none transition-all text-sm text-gray-700 placeholder:text-gray-300"
                    rows={3}
                  />
                  {files.length > 0 && (
                    <div className="mt-4 space-y-2">
                      {files.map((f, i) => (
                        <div key={i} className="flex items-center gap-3 px-3 py-2.5 bg-gray-50/80 rounded-xl group">
                          <span className="text-base">
                            {f.type.startsWith('image/') ? '🖼️' : /\.(xls|csv)/.test(f.name) ? '📊' : /\.(doc|pdf|ppt)/.test(f.name) ? '📄' : '📝'}
                          </span>
                          <span className="flex-1 text-sm text-gray-700 truncate">{f.name}</span>
                          <span className="text-xs text-gray-400">{fmtSize(f.size)}</span>
                          <button
                            onClick={e => {
                              e.stopPropagation();
                              removeFile(i);
                            }}
                            className="text-gray-300 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all text-xs"
                          >
                            ✕
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* 右侧：省心模式按钮 */}
                <div className="lg:w-64 flex flex-col gap-3">
                  <button
                    onClick={handleEasyGenerate}
                    disabled={files.length === 0 && !topic.trim()}
                    className="flex-1 lg:flex-none bg-gradient-to-r from-[#5B4FE9] to-[#8B5CF6] text-white rounded-2xl font-semibold text-base hover:shadow-lg hover:shadow-[#DDD6FE]/60 transition-all disabled:opacity-40 disabled:cursor-not-allowed flex flex-col items-center justify-center gap-2 py-6"
                  >
                    <span className="text-2xl">✨</span>
                    <span>省心模式</span>
                    <span className="text-xs opacity-80">一键生成</span>
                  </button>
                  <button
                    onClick={() => setShowPro(!showPro)}
                    className="px-4 py-3 bg-white border border-gray-200 rounded-xl text-sm font-medium text-gray-700 hover:bg-gray-50 hover:border-gray-300 transition-all flex items-center justify-center gap-2"
                  >
                    <span className={`transition-transform ${showPro ? 'rotate-90' : ''}`}>▸</span>
                    <span>专业模式</span>
                  </button>
                </div>
              </div>
            </div>

            {/* 专业模式折叠面板 */}
            {showPro && (
              <div className="max-w-4xl mx-auto mb-6 animate-fade-in">
                <div className="bg-white rounded-3xl shadow-sm shadow-gray-100/50 border border-gray-100 p-6 space-y-5">
                  {/* 生成模式 */}
                  <div>
                    <label className="text-xs font-semibold text-gray-600 mb-2.5 block uppercase tracking-wider">生成模式</label>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                      {GEN_MODES.map(m => (
                        <button
                          key={m.id}
                          onClick={() => setGenMode(m.id)}
                          className={`p-3 rounded-xl border-2 transition-all text-left ${
                            genMode === m.id ? 'border-[#5B4FE9] bg-[#F5F3FF]/80' : 'border-gray-100 hover:border-gray-200'
                          }`}
                        >
                          <div className="text-lg mb-0.5">{m.icon}</div>
                          <div className={`text-xs font-semibold ${genMode === m.id ? 'text-[#4338CA]' : 'text-gray-700'}`}>{m.name}</div>
                          <div className="text-[10px] text-gray-400 mt-0.5 leading-tight">{m.desc}</div>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* 主题色系 */}
                  <div>
                    <label className="text-xs font-semibold text-gray-600 mb-2.5 block uppercase tracking-wider">主题色系</label>
                    <div className="grid grid-cols-4 sm:grid-cols-8 gap-2">
                      {THEME_COLORS.map(t => (
                        <button
                          key={t.id}
                          onClick={() => setThemeColor(t.id)}
                          className={`p-3 rounded-xl border-2 transition-all ${
                            themeColor === t.id ? 'border-[#5B4FE9] bg-[#F5F3FF]/80' : 'border-gray-100 hover:border-gray-200'
                          }`}
                        >
                          <div className="flex items-center justify-center gap-1 mb-2">
                            {t.colors.map((c, i) => (
                              <div key={i} className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: c }} />
                            ))}
                          </div>
                          <div className={`text-[10px] font-semibold text-center ${themeColor === t.id ? 'text-[#4338CA]' : 'text-gray-700'}`}>
                            {t.name}
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* 语气 + 页数 + 配图 */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    {/* 语气 */}
                    <div>
                      <label className="text-xs font-semibold text-gray-600 mb-2 block uppercase tracking-wider">语气</label>
                      <div className="flex gap-2">
                        {TONE_STYLES.map(s => (
                          <button
                            key={s.id}
                            onClick={() => setTone(s.id)}
                            className={`flex-1 p-2.5 rounded-xl border-2 transition-all text-center ${
                              tone === s.id ? 'border-[#5B4FE9] bg-[#F5F3FF]/80' : 'border-gray-100 hover:border-gray-200'
                            }`}
                          >
                            <div className="text-lg">{s.icon}</div>
                            <div className={`text-[10px] font-semibold mt-0.5 ${tone === s.id ? 'text-[#4338CA]' : 'text-gray-600'}`}>{s.name}</div>
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* 页数 */}
                    <div>
                      <label className="text-xs font-semibold text-gray-600 mb-2 block uppercase tracking-wider">页数</label>
                      <div className="flex gap-2">
                        <button onClick={() => setPages('auto')} className={`flex-1 py-2.5 rounded-xl border-2 text-xs font-semibold transition-all ${pages === 'auto' ? 'border-[#5B4FE9] bg-[#F5F3FF]/80 text-[#4338CA]' : 'border-gray-100 text-gray-600 hover:border-gray-200'}`}>自动</button>
                        {[8, 12, 16, 20].map(n => (
                          <button key={n} onClick={() => setPages(n)} className={`py-2.5 px-2 rounded-xl border-2 text-xs font-semibold transition-all ${pages === n ? 'border-[#5B4FE9] bg-[#F5F3FF]/80 text-[#4338CA]' : 'border-gray-100 text-gray-600 hover:border-gray-200'}`}>{n}</button>
                        ))}
                      </div>
                    </div>

                    {/* 配图 */}
                    <div>
                      <label className="text-xs font-semibold text-gray-600 mb-2 block uppercase tracking-wider">配图</label>
                      <div className="flex gap-2">
                        {IMAGE_MODES.map(m => (
                          <button key={m.id} onClick={() => setImgMode(m.id)} className={`flex-1 p-2 rounded-xl border-2 transition-all text-center ${imgMode === m.id ? 'border-[#5B4FE9] bg-[#F5F3FF]/80' : 'border-gray-100 hover:border-gray-200'}`}>
                            <div className={`text-[10px] font-semibold ${imgMode === m.id ? 'text-[#4338CA]' : 'text-gray-600'}`}>{m.name}</div>
                            <div className="text-[9px] text-gray-400">{m.desc}</div>
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* 专业模式生成按钮 */}
                  <button onClick={handleProGenerate} disabled={!collectText().trim()} className="w-full py-3.5 bg-gradient-to-r from-[#5B4FE9] to-[#8B5CF6] text-white rounded-2xl font-bold text-sm hover:shadow-xl hover:shadow-purple-200/60 transition-all disabled:opacity-40 disabled:cursor-not-allowed">
                    🚀 一键生成PPT
                  </button>
                </div>
              </div>
            )}
            {error && <div className="max-w-4xl mx-auto mb-6 px-4 py-3 bg-red-50 text-red-500 rounded-xl text-sm">❌ {error}</div>}

            {/* 场景展示 */}
            <div className="max-w-4xl mx-auto mb-16">
              <h2 className="text-center text-xl font-bold text-gray-900 mb-2">适用于各种场景</h2>
              <p className="text-center text-gray-400 text-sm mb-8">无论什么需求，都能快速生成高质量PPT</p>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                {SCENARIOS.map(s => (
                  <div key={s.title} className="bg-white rounded-2xl border border-gray-100 p-5 hover:shadow-md hover:border-gray-200 transition-all">
                    <div className="text-2xl mb-3">{s.icon}</div>
                    <h3 className="text-sm font-bold text-gray-900 mb-1">{s.title}</h3>
                    <p className="text-xs text-gray-400">{s.desc}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* 特性区 */}
            <div className="max-w-4xl mx-auto bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 rounded-3xl p-8 md:p-10 mb-8">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-8 text-center">
                <div>
                  <div className="text-3xl mb-3">⚡</div>
                  <h3 className="text-white font-bold text-lg mb-2">极速生成</h3>
                  <p className="text-gray-400 text-sm">AI驱动，分钟级完成专业PPT</p>
                </div>
                <div>
                  <div className="text-3xl mb-3">🎨</div>
                  <h3 className="text-white font-bold text-lg mb-2">精美设计</h3>
                  <p className="text-gray-400 text-sm">8+主题色系，自动匹配最佳排版</p>
                </div>
                <div>
                  <div className="text-3xl mb-3">🔒</div>
                  <h3 className="text-white font-bold text-lg mb-2">隐私安全</h3>
                  <p className="text-gray-400 text-sm">文件即传即用，不留存任何数据</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Footer */}
        <footer className="border-t border-gray-100 py-5 text-center text-sm text-gray-400">
          省心PPT · AI驱动的PPT生成器 · Powered by GLM‑5
        </footer>
      </div>
    </div>
  );
}

function buildMd(title: string, slides: any[]): string {
  const p: string[] = [];
  p.push(`# ${title}\n`);
  for (let i = 0; i < slides.length; i++) {
    const s = slides[i];
    p.push('---\n');
    if (i === slides.length - 1 && (/感谢|谢谢|总结/.test(s.title))) { p.push(`# ${s.title}\n`); if (s.content?.length) p.push(`> ${s.content.join('；')}\n`); continue; }
    if (i === 1 && (/目录|概览/.test(s.title))) { p.push(`## ${s.title}\n\n`); s.content?.forEach((c: string, ci: number) => { p.push(`${ci + 1}. **${c.trim()}**\n`); }); continue; }
    p.push(`## ${s.title}\n\n`);
    if (s.content?.length) { if (s.content.length <= 4) { for (const pt of s.content) { if (pt.trim()) p.push(`- **${pt.trim()}**\n\n`); } } else { for (const pt of s.content) { if (pt.trim()) p.push(`### ${pt.trim()}\n\n`); } } }
    if (s.notes) p.push(`> ${s.notes}\n`);
  }
  return p.join('\n');
}