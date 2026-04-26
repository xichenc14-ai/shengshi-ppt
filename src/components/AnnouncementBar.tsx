'use client';

import React from 'react';

export interface Announcement {
  id: string;
  message: string;
  type?: 'info' | 'success' | 'warning' | 'error';
  link?: string;
  startDate?: string;
  endDate?: string;
}

// 当前无公告
const ANNOUNCEMENTS: Announcement[] = [];

export function getLatestAnnouncement(): Announcement | null {
  const now = new Date();
  for (const a of ANNOUNCEMENTS) {
    if (a.startDate && new Date(a.startDate) > now) continue;
    if (a.endDate && new Date(a.endDate) < now) continue;
    return a;
  }
  return null;
}

interface AnnouncementBarProps {
  announcement: Announcement | null;
}

export default function AnnouncementBar({ announcement }: AnnouncementBarProps) {
  if (!announcement) return null;

  const bgColor = {
    info: 'bg-blue-50 border-blue-200',
    success: 'bg-green-50 border-green-200',
    warning: 'bg-orange-50 border-orange-200',
    error: 'bg-red-50 border-red-200',
  }[announcement.type || 'info'];

  const textColor = {
    info: 'text-blue-700',
    success: 'text-green-700',
    warning: 'text-orange-700',
    error: 'text-red-700',
  }[announcement.type || 'info'];

  return (
    <div className={`${bgColor} ${textColor} border-b px-4 py-2 text-center text-sm`}>
      {announcement.message}
      {announcement.link && (
        <a href={announcement.link} className="ml-2 underline font-medium hover:no-underline">
          了解更多 →
        </a>
      )}
    </div>
  );
}