'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import Navbar from '@/components/Navbar';
import Link from 'next/link';

interface HistoryItem {
  id: string;
  title: string;
  slides: any[];
  theme_id: string;
  download_url: string;
  page_count: number;
  image_mode: string;
  created_at: string;
}

export default function HistoryPage() {
  const { user, logout } = useAuth();
  const router = useRouter();
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!user) return;
    fetchHistory();
  }, [user]);

  const fetchHistory = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/history?userId=${user.id}&limit=30`);
      const data = await res.json();
      if (data.history) {
        setHistory(data.history);
      } else if (data.error) {
        setError(data.error);
      }
    } catch (e: any) {
      setError(e.message);
    }
    setLoading(false);
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('确定要删除这条记录吗？')) return;
    try {
      const res = await fetch('/api/history', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'delete', userId: user?.id, id }),
      });
      if (res.ok) {
        setHistory(prev => prev.filter(h => h.id !== id));
      }
    } catch {}
  };

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    return `${d.getMonth() + 1}/${d.getDate()} ${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}`;
  };

  const getImageModeLabel = (mode: string) => {
    switch (mode) {
      case 'noImages': return '📝 无图';
      case 'pictographic': return '🖼️ 套图';
      case 'webFreeToUseCommercially': return '🌐 网图';
      case 'aiGenerated': return '🤖 AI图';
      default: return mode;
    }
  };

  if (!user) {
    return (
      <div className="min-h-screen bg-[#FAFBFE]">
        <Navbar />
        <div className="flex items-center justify-center py-32">
          <div className="text-center animate-fade-in">
            <div className="w-20 h-20 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-[#5B4FE9]/10 to-[#8B5CF6]/10 flex items-center justify-center">
              <span className="text-4xl">🔒</span>
            </div>
            <h2 className="text-lg font-bold text-gray-900 mb-2">请先登录</h2>
            <p className="text-sm text-gray-400 mb-6">登录后即可查看生成历史</p>
            <Link href="/" className="inline-flex items-center gap-2 px-6 py-2.5 bg-gradient-to-r from-[#5B4FE9] to-[#8B5CF6] text-white rounded-xl text-sm font-semibold shadow-md shadow-purple-200/50 hover:shadow-lg transition-all">
              ✨ 返回首页
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#FAFBFE]">
      <Navbar />

      {/* Header */}
      <div className="bg-gradient-to-br from-[#5B4FE9]/5 via-[#7C3AED]/5 to-[#8B5CF6]/5 border-b border-gray-100">
        <div className="max-w-3xl mx-auto px-4 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                <span className="text-2xl">📋</span> 生成历史
              </h1>
              <p className="text-sm text-gray-400 mt-1">共 {history.length} 条记录</p>
            </div>
            <Link href="/" className="px-4 py-2 bg-white border border-gray-200 rounded-xl text-sm text-gray-600 hover:border-purple-200 hover:text-purple-600 transition-all">
              + 新建PPT
            </Link>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-3xl mx-auto px-4 py-6">
        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map(i => (
              <div key={i} className="animate-pulse bg-white rounded-xl border border-gray-100 p-4">
                <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
                <div className="h-3 bg-gray-100 rounded w-1/2"></div>
              </div>
            ))}
          </div>
        ) : error ? (
          <div className="text-center py-12">
            <div className="text-4xl mb-4">❌</div>
            <p className="text-sm text-gray-500">{error}</p>
            <button onClick={fetchHistory} className="mt-4 px-4 py-2 bg-purple-100 text-purple-600 rounded-xl text-sm hover:bg-purple-200 transition-all">
              重试
            </button>
          </div>
        ) : history.length === 0 ? (
          <div className="text-center py-16">
            <div className="w-20 h-20 mx-auto mb-4 rounded-2xl bg-gray-100 flex items-center justify-center">
              <span className="text-4xl">📭</span>
            </div>
            <h2 className="text-lg font-bold text-gray-900 mb-2">暂无历史记录</h2>
            <p className="text-sm text-gray-400 mb-6">开始创建你的第一份PPT吧</p>
            <Link href="/" className="inline-flex items-center gap-2 px-6 py-2.5 bg-gradient-to-r from-[#5B4FE9] to-[#8B5CF6] text-white rounded-xl text-sm font-semibold shadow-md shadow-purple-200/50 hover:shadow-lg transition-all">
              ✨ 立即创建
            </Link>
          </div>
        ) : (
          <div className="space-y-3">
            {history.map((item) => (
              <div key={item.id} className="bg-white rounded-xl border border-gray-100 p-4 hover:border-purple-100 hover:shadow-sm transition-all group">
                <div className="flex items-start gap-3">
                  {/* Thumbnail placeholder */}
                  <div className="flex-shrink-0 w-12 h-12 rounded-lg bg-gradient-to-br from-purple-100 to-purple-50 flex items-center justify-center text-lg font-bold text-purple-600">
                    {item.page_count}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <h3 className="text-sm font-semibold text-gray-800 truncate">{item.title}</h3>
                    <div className="flex items-center gap-2 mt-1 text-xs text-gray-400">
                      <span>{item.page_count} 页</span>
                      <span>·</span>
                      <span>{getImageModeLabel(item.image_mode)}</span>
                      <span>·</span>
                      <span>{formatDate(item.created_at)}</span>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex-shrink-0 flex items-center gap-2 opacity-60 group-hover:opacity-100 transition-opacity">
                    {item.download_url && (
                      <a
                        href={item.download_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="w-8 h-8 rounded-lg bg-green-50 text-green-600 flex items-center justify-center hover:bg-green-100 transition-all"
                        title="下载"
                      >
                        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3"/>
                        </svg>
                      </a>
                    )}
                    <button
                      onClick={() => handleDelete(item.id)}
                      className="w-8 h-8 rounded-lg bg-red-50 text-red-400 flex items-center justify-center hover:bg-red-100 hover:text-red-600 transition-all"
                      title="删除"
                    >
                      <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M3 6h18M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/>
                      </svg>
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Back link */}
      <div className="max-w-3xl mx-auto px-4 pb-8">
        <Link href="/account" className="inline-flex items-center gap-1 text-sm text-gray-400 hover:text-gray-600 transition-colors">
          ← 返回用户中心
        </Link>
      </div>
    </div>
  );
}