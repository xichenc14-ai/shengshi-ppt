'use client';

import React, { useState, useCallback, useRef, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';

const GAMMA_THEMES = [
  { id: 'auto', name: '自动匹配', desc: 'AI智能选择', icon: '🤖' },
  { id: 'consultant', name: '商务汇报', desc: '专业简洁', icon: '💼' },
  { id: 'founder', name: '路演融资', desc: '现代极简', icon: '🚀' },
  { id: 'icebreaker', name: '培训课件', desc: '友好清晰', icon: '📚' },
  { id: 'electric', name: '创意方案', desc: '大胆未来', icon: '💡' },
  { id: 'chisel', name: '教育课件', desc: '温暖大地', icon: '🎓' },
  { id: 'gleam', name: '数据分析', desc: '科技高对比', icon: '📊' },
  { id: 'blues', name: '年度总结', desc: '高端蓝金', icon: '🏆' },
  { id: 'aurora', name: '产品发布', desc: '渐变震撼', icon: '🛸' },
  { id: 'ashrose', name: '美妆时尚', desc: '柔和梦幻', icon: '💄' },
  { id: 'finesse', name: '生活方式', desc: '优雅精致', icon: '🌿' },
  { id: 'default-light', name: '简约白', desc: '干净通用', icon: '⬜' },
  { id: 'default-dark', name: '暗夜黑', desc: '深色专业', icon: '⬛' },
];

const GAMMA_STYLES = [
  { id: 'professional', name: '专业商务', desc: '正式严谨', tone: 'professional' },
  { id: 'casual', name: '轻松友好', desc: '亲切活泼', tone: 'casual' },
  { id: 'creative', name: '创意活泼', desc: '大胆丰富', tone: 'creative' },
  { id: 'bold', name: '大胆科技', desc: '未来冲击', tone: 'bold' },
  { id: 'elegant', name: '优雅高级', desc: '精致质感', tone: 'professional' },
  { id: 'warm', name: '温馨自然', desc: '温暖亲和', tone: 'casual' },
  { id: 'academic', name: '学术严谨', desc: '规范数据', tone: 'professional' },
  { id: 'playful', name: '活泼趣味', desc: '年轻有趣', tone: 'casual' },
];

const IMAGE_MODES = [
  { id: 'auto', name: '自动匹配', desc: '智能（不含AI生图）', locked: false },
  { id: 'none', name: '无图纯净', desc: '纯文字+图标', locked: false },
  { id: 'web', name: '精选配图', desc: '商用免费图', locked: false },
  { id: 'ai', name: 'AI定制图', desc: '高质量配图', locked: true },
  { id: 'ai-pro', name: 'AI高级图', desc: '顶级AI配图', locked: true },
];

const GEN_MODES = [
  { id: 'easy', name: '省心智能', icon: '✨', desc: 'AI全自动，一步到位' },
  { id: 'generate', name: 'AI创作', icon: '🤖', desc: '从零生成完整内容' },
  { id: 'condense', name: '智能摘要', icon: '📝', desc: '提炼文档为要点' },
  { id: 'preserve', name: '原文排版', icon: '📄', desc: '保留原文美化排版' },
];

type Step = 'input' | 'outline' | 'generating' | 'done';
interface OutlineItem { id: string; title: string; content: string[]; notes?: string; }
interface UploadedFile { name: string; type: string; size: number; content?: string; }

function CreatePageInner() {
  const sp = useSearchParams();
  const [pm, setPm] = useState<'easy' | 'pro'>('easy');
  const [step, setStep] = useState<Step>('input');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [progress, setProgress] = useState('');
  const [eFiles, setEFiles] = useState<UploadedFile[]>([]);
  const [eDrag, setEDrag] = useState(false);
  const [text, setText] = useState(sp.get('topic') || '');
  const [pFiles, setPFiles] = useState<UploadedFile[]>([]);
  const [pages, setPages] = useState<'auto' | number>('auto');
  const [gm, setGm] = useState('easy');
  const [theme, setTheme] = useState('auto');
  const [style, setStyle] = useState('professional');
  const [imgMode, setImgMode] = useState('auto');
  const [outline, setOutline] = useState<OutlineItem[]>([]);
  const [oTitle, setOTitle] = useState('');
  const [dlUrl, setDlUrl] = useState<string | null>(null);
  const [pvUrl, setPvUrl] = useState<string | null>(null);
  const efRef = useRef<HTMLInputElement>(null);
  const pfRef = useRef<HTMLInputElement>(null);

  const proc = useCallback(async (f: FileList | File[]) => {
    const r: UploadedFile[] = [];
    for (const file of Array.from(f)) {
      const i: UploadedFile = { name: file.name, type: file.type, size: file.size };
      if (file.type === 'text/plain' || /\.(md|txt|csv)$/.test(file.name)) i.content = await file.text();
      r.push(i);
    }
    return r;
  }, []);

  const onEasyDrop = useCallback(async (e: React.DragEvent) => { e.preventDefault(); setEDrag(false); if (e.dataTransfer.files.length > 0) { const f = await proc(e.dataTransfer.files); setEFiles(p => [...p, ...f]); } }, [proc]);
  const onFileSel = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => { if (e.target.files?.length) { const f = await proc(e.target.files); setEFiles(p => [...p, ...f]); } e.target.value = ''; }, [proc]);
  const onProFile = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => { if (e.target.files?.length) { const f = await proc(e.target.files); setPFiles(p => [...p, ...f]); } e.target.value = ''; }, [proc]);
  const rmFile = useCallback((l: 'e' | 'p', i: number) => { (l === 'e' ? setEFiles : setPFiles)(p => p.filter((_, j) => j !== i)); }, []);
  const fmtS = (b: number) => b < 1024 ? b + ' B' : b < 1048576 ? (b / 1024).toFixed(1) + ' KB' : (b / 1048576).toFixed(1) + ' MB';

  const collectText = () => { const p: string[] = []; [...eFiles, ...pFiles].forEach(f => { p.push(f.content ? `[${f.name}]\n${f.content}` : `[${f.name}]`); }); if (text.trim()) p.push(text.trim()); return p.join('\n\n'); };

  const doGenerate = useCallback(async (inputText: string, auto: boolean, tm: string, sc: number | 'auto', th?: string, tn?: string, im?: string) => {
    setLoading(true); setError(''); setStep('generating'); setProgress('正在分析内容...');
    try {
      const numC = sc === 'auto' ? 10 : sc;
      setProgress('正在生成大纲...');
      const oRes = await fetch('/api/outline', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ inputText, slideCount: numC, textMode: auto ? 'generate' : tm, auto }) });
      if (!oRes.ok) { const d = await oRes.json(); throw new Error(d.error || '失败'); }
      const od = await oRes.json();
      setOTitle(od.title || 'PPT'); setOutline(od.slides || []);
      setProgress('正在生成PPT...');
      const md = buildMd(od.title, od.slides || []);
      const gRes = await fetch('/api/gamma', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ inputText: md, textMode: auto ? 'generate' : tm, format: 'presentation', numCards: (od.slides || []).length, exportAs: 'pptx', themeId: th || od.themeId || undefined, tone: tn || od.tone || 'professional', imageMode: im || od.imageMode || 'auto' }) });
      if (!gRes.ok) throw new Error('PPT生成失败');
      const gd = await gRes.json();
      if (gd.generationId) await poll(gd.generationId);
      setStep('done');
    } catch (e: any) { setError(e.message || '失败'); setStep('input'); } finally { setLoading(false); }
  }, []);

  const poll = useCallback(async (id: string) => {
    for (let i = 0; i < 48; i++) { await new Promise(r => setTimeout(r, 5000)); setProgress(`PPT 生成中... ${Math.round(((i + 1) / 48) * 100)}%`); try { const r = await fetch(`/api/gamma?id=${id}`); if (!r.ok) continue; const d = await r.json(); if (d.status === 'completed') { setDlUrl(d.exportUrl || null); setPvUrl(d.gammaUrl || null); return; } if (d.status === 'failed') throw new Error('PPT生成失败'); } catch (e: any) { if (e.message?.includes('失败')) throw e; } }
    throw new Error('PPT生成超时');
  }, []);

  const handleEasy = () => { if (eFiles.length === 0 && !text.trim()) return; doGenerate(collectText(), true, 'generate', 'auto'); };
  const handlePro = () => { if (!collectText().trim()) return; if (gm === 'easy') { doGenerate(collectText(), true, 'generate', pages, theme === 'auto' ? undefined : theme, GAMMA_STYLES.find(s => s.id === style)?.tone, imgMode === 'auto' ? undefined : imgMode); } else { setLoading(true); setError(''); setProgress('AI 正在分析...'); (async () => { try { const nc = pages === 'auto' ? 10 : pages; const r = await fetch('/api/outline', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ inputText: collectText(), slideCount: nc, textMode: gm }) }); if (!r.ok) { const d = await r.json(); throw new Error(d.error); } const d = await r.json(); setOTitle(d.title || 'PPT'); setOutline(d.slides || []); if (d.themeId) setTheme(d.themeId); if (d.tone) setStyle(d.tone); if (d.imageMode) setImgMode(d.imageMode); setStep('outline'); } catch (e: any) { setError(e.message); } finally { setLoading(false); } })(); } };
  const handleConfirm = () => { if (!outline.length) return; doGenerate('', false, gm, outline.length, theme === 'auto' ? undefined : theme, GAMMA_STYLES.find(s => s.id === style)?.tone, imgMode); };
  const reset = () => { setStep('input'); setDlUrl(null); setPvUrl(null); setError(''); setProgress(''); setOutline([]); setOTitle(''); setEFiles([]); setPFiles([]); setText(''); };
  const updItem = (id: string, f: string, v: any) => setOutline(p => p.map(i => i.id === id ? { ...i, [f]: v } : i));
  const addItem = (afterId?: string) => { const n: OutlineItem = { id: Math.random().toString(36).substring(2, 9), title: '新页面', content: ['要点1', '要点2', '要点3'] }; setOutline(p => { if (!afterId) return [...p, n]; const i = p.findIndex(x => x.id === afterId); return [...p.slice(0, i + 1), n, ...p.slice(i + 1)]; }); };
  const rmItem = (id: string) => setOutline(p => p.filter(i => i.id !== id));

  return (
    <div className="min-h-screen bg-[#fafbfc]">
      <nav className="bg-white/80 backdrop-blur-xl border-b border-gray-100/80 px-8 py-3 flex items-center justify-between sticky top-0 z-50">
        <Link href="/" className="flex items-center gap-2.5 group">
          <div className="w-8 h-8 bg-gradient-to-br from-violet-500 to-blue-600 rounded-xl flex items-center justify-center shadow-lg shadow-violet-200/50"><span className="text-white text-sm font-bold">P</span></div>
          <span className="text-lg font-bold bg-gradient-to-r from-gray-900 to-gray-600 bg-clip-text text-transparent">省事PPT</span>
        </Link>
        {step === 'outline' && <button onClick={() => setStep('input')} className="text-sm text-gray-400 hover:text-gray-700 transition-colors">← 返回</button>}
        {step === 'done' && <><button onClick={() => { setStep('outline'); setDlUrl(null); setPvUrl(null); }} className="text-sm text-gray-400 hover:text-gray-700 transition-colors">← 编辑大纲</button><button onClick={reset} className="text-sm text-gray-400 hover:text-gray-700 transition-colors ml-3">新建</button></>}
      </nav>
      <div className="max-w-5xl mx-auto px-6 py-8">
        {step === 'input' && (<div className="animate-fade-in">
          <div className="flex justify-center mb-10"><div className="inline-flex bg-gray-100 rounded-2xl p-1.5 gap-1">{(['easy', 'pro'] as const).map(m => (<button key={m} onClick={() => setPm(m)} className={`px-7 py-2.5 rounded-xl text-sm font-semibold transition-all duration-200 ${pm === m ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-400 hover:text-gray-600'}`}>{m === 'easy' ? '😎 省心模式' : '⚙️ 专业模式'}</button>))}</div></div>
          {pm === 'easy' && (<div className="max-w-lg mx-auto"><div className="text-center mb-8"><h1 className="text-2xl font-bold text-gray-900 mb-2">把文件丢进来，剩下的交给我</h1><p className="text-gray-400 text-sm">文档、表格、截图，什么都行</p></div><div className="bg-white rounded-3xl shadow-sm shadow-gray-100/50 border border-gray-100 p-8">
            <div onDragOver={e => { e.preventDefault(); setEDrag(true); }} onDragLeave={() => setEDrag(false)} onDrop={onEasyDrop} onClick={() => efRef.current?.click()} className={`border-2 border-dashed rounded-2xl p-12 text-center cursor-pointer transition-all duration-200 ${eDrag ? 'border-violet-400 bg-violet-50/50' : 'border-gray-200 hover:border-violet-300 hover:bg-gray-50/50'}`}><div className="w-14 h-14 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-violet-100 to-blue-100 flex items-center justify-center text-2xl">📎</div><p className="text-gray-600 font-medium text-sm">拖拽文件到这里</p><p className="text-gray-400 text-xs mt-1.5">或点击选择文件</p></div>
            <input ref={efRef} type="file" multiple accept=".txt,.md,.doc,.docx,.pdf,.xls,.xlsx,.csv,.png,.jpg,.jpeg,.webp,.ppt,.pptx" onChange={onFileSel} className="hidden" />
            <textarea value={text} onChange={e => setText(e.target.value)} placeholder="（可选）补充说明你的需求..." className="w-full mt-5 px-4 py-3 rounded-xl bg-gray-50/80 border border-gray-200 focus:border-violet-400 focus:ring-2 focus:ring-violet-100 focus:bg-white outline-none resize-none transition-all text-sm text-gray-700 placeholder:text-gray-300" rows={2} />
            {eFiles.length > 0 && (<div className="mt-5 space-y-2">{eFiles.map((f, i) => (<div key={i} className="flex items-center gap-3 px-3 py-2.5 bg-gray-50/80 rounded-xl group"><span className="text-base">{f.type.startsWith('image/') ? '🖼️' : /\.(xls|csv)/.test(f.name) ? '📊' : /\.(doc|pdf|ppt)/.test(f.name) ? '📄' : '📝'}</span><span className="flex-1 text-sm text-gray-700 truncate">{f.name}</span><span className="text-xs text-gray-400">{fmtS(f.size)}</span><button onClick={e => { e.stopPropagation(); rmFile('e', i); }} className="text-gray-300 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all text-xs">✕</button></div>))}</div>)}
            <button onClick={handleEasy} disabled={eFiles.length === 0 && !text.trim()} className="w-full mt-6 py-3.5 bg-gradient-to-r from-violet-500 to-blue-600 text-white rounded-2xl font-semibold text-sm hover:shadow-lg hover:shadow-violet-200/60 transition-all disabled:opacity-40 disabled:cursor-not-allowed">一键生成PPT</button>
            {error && <div className="mt-4 px-4 py-3 bg-red-50 text-red-500 rounded-xl text-sm">❌ {error}</div>}
          </div></div>)}
          {pm === 'pro' && (<div className="max-w-2xl mx-auto space-y-5">
            <div className="bg-white rounded-3xl shadow-sm shadow-gray-100/50 border border-gray-100 p-6 space-y-4">
              <label className="text-sm font-semibold text-gray-800">内容输入</label>
              <textarea value={text} onChange={e => setText(e.target.value)} placeholder="输入PPT主题或粘贴完整内容..." className="w-full px-4 py-3 rounded-xl bg-gray-50/80 border border-gray-200 focus:border-violet-400 focus:ring-2 focus:ring-violet-100 focus:bg-white outline-none resize-none transition-all text-sm text-gray-700 placeholder:text-gray-300" rows={5} />
              <div className="flex items-center gap-3"><input ref={pfRef} type="file" multiple accept=".txt,.md,.doc,.docx,.pdf,.xls,.xlsx,.csv,.png,.jpg,.jpeg,.webp,.ppt,.pptx" onChange={onProFile} className="hidden" /><button onClick={() => pfRef.current?.click()} className="px-3.5 py-2 text-xs font-medium text-gray-500 bg-gray-50 border border-gray-200 rounded-xl hover:bg-gray-100 transition-colors">📎 上传附件</button>{pFiles.length > 0 && <div className="flex gap-1.5 flex-wrap">{pFiles.map((f, i) => (<span key={i} className="inline-flex items-center gap-1 px-2.5 py-1 bg-violet-50 text-violet-700 text-xs rounded-lg font-medium">{f.name}<button onClick={() => rmFile('p', i)} className="hover:text-red-500 ml-0.5">×</button></span>))}</div>}</div>
            </div>
            <div className="bg-white rounded-3xl shadow-sm shadow-gray-100/50 border border-gray-100 p-6 space-y-6">
              <div><label className="text-sm font-semibold text-gray-800 mb-3 block">生成模式</label><div className="grid grid-cols-4 gap-2.5">{GEN_MODES.map(m => (<button key={m.id} onClick={() => setGm(m.id)} className={`p-3.5 rounded-2xl border-2 transition-all text-left ${gm === m.id ? 'border-violet-500 bg-violet-50/80' : 'border-gray-100 hover:border-gray-200'}`}><div className="text-lg mb-1">{m.icon}</div><div className={`text-xs font-semibold ${gm === m.id ? 'text-violet-700' : 'text-gray-700'}`}>{m.name}</div><div className="text-[10px] text-gray-400 mt-1 leading-tight">{m.desc}</div></button>))}</div></div>
              <div><label className="text-sm font-semibold text-gray-800 mb-2 block">页数</label><div className="flex items-center gap-3"><button onClick={() => setPages('auto')} className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${pages === 'auto' ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>自动</button>{pages !== 'auto' && <><input type="number" min={3} max={30} value={pages} onChange={e => setPages(Math.max(3, Math.min(30, Number(e.target.value))))} className="w-16 px-3 py-2 border border-gray-200 rounded-xl text-center text-sm focus:border-violet-400 outline-none" /><span className="text-xs text-gray-400">页</span></>}</div></div>
              <div><label className="text-sm font-semibold text-gray-800 mb-3 block">主题风格</label><div className="grid grid-cols-5 gap-2">{GAMMA_THEMES.map(t => (<button key={t.id} onClick={() => setTheme(t.id)} className={`p-2.5 rounded-xl border-2 transition-all text-left ${theme === t.id ? 'border-violet-500 bg-violet-50/80' : 'border-gray-100 hover:border-gray-200'}`}><div className="text-xs font-medium text-gray-800 truncate">{t.icon} {t.name}</div><div className="text-[10px] text-gray-400 mt-0.5 truncate">{t.desc}</div></button>))}</div></div>
              <div><label className="text-sm font-semibold text-gray-800 mb-3 block">语气风格</label><div className="grid grid-cols-4 gap-2">{GAMMA_STYLES.map(s => (<button key={s.id} onClick={() => setStyle(s.id)} className={`p-3 rounded-xl border-2 transition-all text-left ${style === s.id ? 'border-violet-500 bg-violet-50/80' : 'border-gray-100 hover:border-gray-200'}`}><div className="text-xs font-semibold text-gray-800">{s.name}</div><div className="text-[10px] text-gray-400 mt-0.5">{s.desc}</div></button>))}</div></div>
              <div><label className="text-sm font-semibold text-gray-800 mb-3 block">配图方式</label><div className="grid grid-cols-5 gap-2">{IMAGE_MODES.map(m => (
                      <button key={m.id} onClick={() => m.locked ? undefined : setImgMode(m.id)} className={`relative p-2.5 rounded-xl border-2 transition-all text-left ${m.locked ? 'border-gray-100 bg-gray-50/50 opacity-50 cursor-not-allowed' : imgMode === m.id ? 'border-violet-500 bg-violet-50/80' : 'border-gray-100 hover:border-gray-200 cursor-pointer'}`}>
                        {m.locked && <span className="absolute -top-1.5 -right-1 text-[9px] bg-amber-400 text-white px-1.5 py-0.5 rounded-full font-bold shadow-sm">VIP</span>}
                        <div className="text-xs font-semibold text-gray-800">{m.name}</div>
                        <div className="text-[10px] text-gray-400 mt-0.5 leading-tight">{m.desc}</div>
                      </button>
                    ))}</div></div>
              <button onClick={handlePro} disabled={loading || !collectText().trim()} className="w-full py-3.5 bg-gradient-to-r from-violet-500 to-blue-600 text-white rounded-2xl font-semibold text-sm hover:shadow-lg hover:shadow-violet-200/60 transition-all disabled:opacity-40 disabled:cursor-not-allowed">{gm === 'easy' ? '🚀 一键生成PPT' : '📋 生成大纲'}</button>
              {error && <div className="px-4 py-3 bg-red-50 text-red-500 rounded-xl text-sm">❌ {error}</div>}
            </div>
          </div>)}
        </div>)}
        {step === 'outline' && (<div className="animate-fade-in max-w-3xl mx-auto"><div className="mb-6"><h2 className="text-lg font-bold text-gray-900">大纲预览</h2><p className="text-sm text-gray-400 mt-0.5">{outline.length} 页 · 点击编辑</p></div>
          <div className="bg-white rounded-3xl shadow-sm shadow-gray-100/50 border border-gray-100 p-5 mb-4"><input value={oTitle} onChange={e => setOTitle(e.target.value)} className="text-xl font-bold text-gray-900 w-full outline-none bg-transparent" placeholder="PPT 标题" /></div>
          <div className="space-y-2.5">{outline.map((item, i) => (<div key={item.id} className="bg-white rounded-2xl border border-gray-100 p-4 hover:border-violet-200 transition-colors group"><div className="flex items-start gap-3"><span className="flex-shrink-0 w-6 h-6 rounded-full bg-violet-100 text-violet-600 text-xs font-bold flex items-center justify-center mt-0.5">{i + 1}</span><div className="flex-1 min-w-0"><input value={item.title} onChange={e => updItem(item.id, 'title', e.target.value)} className="font-semibold text-gray-800 w-full outline-none text-sm bg-transparent" placeholder="页面标题" /><div className="mt-2 space-y-1">{(item.content || []).map((pt, pi) => (<input key={pi} value={pt} onChange={e => { const nc = [...(item.content || [])]; nc[pi] = e.target.value; updItem(item.id, 'content', nc); }} className="text-sm text-gray-500 w-full outline-none pl-4 border-l-2 border-gray-100 py-0.5 bg-transparent" placeholder={`要点 ${pi + 1}`} />))}<button onClick={() => updItem(item.id, 'content', [...(item.content || []), '新要点'])} className="text-[11px] text-violet-400 hover:text-violet-600 pl-4 mt-0.5">+ 添加要点</button></div></div><button onClick={() => rmItem(item.id)} className="text-gray-200 hover:text-red-400 text-xs mt-1 opacity-0 group-hover:opacity-100 transition-all">✕</button></div></div>))}</div>
          <button onClick={() => addItem()} className="w-full mt-4 py-3 border-2 border-dashed border-gray-200 rounded-2xl text-gray-400 hover:text-violet-500 hover:border-violet-300 transition-colors text-sm font-medium">+ 添加页面</button>
          <button onClick={handleConfirm} disabled={loading || !outline.length} className="w-full mt-6 py-3.5 bg-gradient-to-r from-violet-500 to-blue-600 text-white rounded-2xl font-semibold text-sm hover:shadow-lg hover:shadow-violet-200/60 transition-all disabled:opacity-40 disabled:cursor-not-allowed">✅ 确认生成PPT</button>
          {error && <div className="mt-4 px-4 py-3 bg-red-50 text-red-500 rounded-xl text-sm">❌ {error}</div>}
        </div>)}
        {step === 'generating' && (<div className="flex items-center justify-center" style={{ minHeight: '60vh' }}><div className="text-center animate-fade-in"><div className="w-12 h-12 mx-auto mb-6 rounded-full border-4 border-violet-200 border-t-violet-500 animate-spin" /><p className="text-gray-600 text-sm">{progress}</p></div></div>)}
        {step === 'done' && (<div className="animate-fade-in" style={{ height: 'calc(100vh - 56px)' }}><div className="bg-white/80 backdrop-blur-xl border-b border-gray-100 px-6 py-2.5 flex items-center justify-between"><span className="text-sm text-gray-500">{oTitle}</span><a href={dlUrl || '#'} download className="px-4 py-2 bg-gradient-to-r from-green-500 to-emerald-600 text-white rounded-xl font-semibold text-sm hover:shadow-lg hover:shadow-green-200/60 transition-all flex items-center gap-2">📥 下载PPT</a></div>
          <div className="bg-gray-100" style={{ height: 'calc(100% - 48px)' }}>
            {pvUrl ? <iframe src={`/api/preview?url=${encodeURIComponent(pvUrl)}`} className="w-full h-full border-0" title="在线预览" allow="fullscreen" /> : dlUrl ? (<div className="flex items-center justify-center h-full"><div className="text-center bg-white rounded-2xl shadow-sm border border-gray-100 p-12"><div className="text-5xl mb-4">📄</div><h3 className="text-lg font-bold text-gray-900 mb-2">PPT 已生成</h3><p className="text-sm text-gray-400 mb-6">预览暂不可用，请下载查看</p><a href={dlUrl} download className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-green-500 to-emerald-600 text-white rounded-xl font-semibold hover:shadow-lg transition-all">📥 下载PPT文件</a></div></div>) : (<div className="flex items-center justify-center h-full"><div className="p-4 bg-yellow-50 rounded-xl text-yellow-700 text-sm">⚠️ 生成失败，请重试</div></div>)}
          </div></div>)}
      </div>
    </div>
  );
}

function buildMd(title: string, slides: OutlineItem[]): string {
  const p: string[] = [];
  p.push(`# ${title}\n`);
  for (let i = 0; i < slides.length; i++) {
    const s = slides[i];
    p.push('---\n');
    if (i === slides.length - 1 && (/感谢|谢谢|总结/.test(s.title))) { p.push(`# ${s.title}\n`); if (s.content?.length) p.push(`> ${s.content.join('；')}\n`); continue; }
    if (i === 1 && (/目录|概览/.test(s.title))) { p.push(`## ${s.title}\n\n`); s.content?.forEach((c, ci) => { p.push(`${ci + 1}. **${c.trim()}**\n`); }); continue; }
    p.push(`## ${s.title}\n\n`);
    if (s.content?.length) { if (s.content.length <= 4) { for (const pt of s.content) { if (pt.trim()) p.push(`- **${pt.trim()}**\n\n`); } } else { for (const pt of s.content) { if (pt.trim()) p.push(`### ${pt.trim()}\n\n`); } } }
    if (s.notes) p.push(`> ${s.notes}\n`);
  }
  return p.join('\n');
}

export default function CreatePage() {
  return <Suspense fallback={<div className="min-h-screen flex items-center justify-center text-gray-400">加载中...</div>}><CreatePageInner /></Suspense>;
}
