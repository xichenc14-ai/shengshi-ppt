'use client';

import React from 'react';

interface SkeletonCardProps {
  lines?: number;
}

export default function SkeletonCard({ lines = 3 }: SkeletonCardProps) {
  return (
    <div className="bg-white rounded-xl border border-gray-100 p-4 animate-pulse">
      <div className="flex items-start gap-3">
        <div className="w-6 h-6 rounded-full bg-gray-200 flex-shrink-0" />
        <div className="flex-1 space-y-2">
          <div className="h-4 bg-gray-200 rounded w-3/4" />
          {Array.from({ length: lines }).map((_, i) => (
            <div key={i} className="h-3 bg-gray-100 rounded" style={{ width: `${60 + Math.random() * 30}%` }} />
          ))}
        </div>
      </div>
    </div>
  );
}
