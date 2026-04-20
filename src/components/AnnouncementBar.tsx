/**
 * 版本公告组件
 * 用法：<AnnouncementBar /> 放在 Navbar 下方
 * 
 * 商用时：
 * 1. 将 ANNOUNCEMENT 迁移到 Supabase 或 CMS
 * 2. 添加 dismiss 功能（localStorage 记录已读）
 * 3. 添加多公告支持（从 VERSION_HISTORY 读取）
 */

import React from 'react';
import Link from 'next/link';
import { VERSION_HISTORY } from '@/lib/version';

interface AnnouncementBarProps {
  /** 自定义公告内容，不传则使用默认 ANNOUNCEMENT */
  announcement?: {
    title: string;
    content: string;
    link?: string;
    linkText?: string;
    style?: 'warning' | 'info' | 'success';
  } | null;
}

export default function AnnouncementBar({ announcement = null }: AnnouncementBarProps) {
  // 暂无全局公告时，不渲染
  if (!announcement) return null;

  const style = announcement.style || 'info';
  const styleMap = {
    warning: 'bg-amber-50 border-amber-200 text-amber-800',
    info: 'bg-purple-50 border-purple-200 text-purple-800',
    success: 'bg-green-50 border-green-200 text-green-800',
  };

  return (
    <div className={`w-full py-2 px-4 border-b ${styleMap[style]}`}>
      <div className="max-w-6xl mx-auto flex items-center justify-center gap-3 text-xs">
        <span className="font-semibold">{announcement.title}</span>
        <span className="opacity-60">·</span>
        <span className="opacity-80">{announcement.content}</span>
        {announcement.link && (
          <>
            <span className="opacity-60">·</span>
            <Link
              href={announcement.link}
              className="font-medium underline hover:no-underline opacity-90"
            >
              {announcement.linkText || '查看详情'}
            </Link>
          </>
        )}
      </div>
    </div>
  );
}

// 🚨 便捷导出：获取最新版本公告（用于首页/公告栏）
export function getLatestAnnouncement() {
  const latest = VERSION_HISTORY[0];
  if (!latest) return null;

  // 只对重大版本（major）显示公告
  if (latest.severity !== 'major') return null;

  return {
    title: `🎉 ${latest.version} 版本更新`,
    content: latest.notes,
    link: '/account',
    linkText: '了解详情',
    style: 'info' as const,
  };
}