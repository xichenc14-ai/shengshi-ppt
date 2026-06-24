import React from 'react';
import Image from 'next/image';

type BrandLogoProps = {
  compact?: boolean;
  className?: string;
};

export default function BrandLogo({ compact = false, className = '' }: BrandLogoProps) {
  return (
    <div className={`flex items-center gap-3 ${className}`}>
      <span className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-[15px] bg-white shadow-[0_10px_30px_rgba(91,78,238,0.24)] ring-1 ring-violet-200/70">
        <Image src="/brand/shengxin-logo.jpg" alt="" width={44} height={44} className="h-full w-full object-cover" aria-hidden="true" priority />
      </span>
      <span className="min-w-0">
        <span className="block whitespace-nowrap text-[17px] font-black tracking-[-0.025em] text-slate-950">省心PPT</span>
        {!compact && <span className="block whitespace-nowrap text-[10px] font-semibold tracking-[0.12em] text-violet-400">AI 演示设计</span>}
      </span>
    </div>
  );
}
