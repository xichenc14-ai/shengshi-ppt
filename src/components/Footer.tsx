import React from 'react';
import Link from 'next/link';
import { APP_VERSION } from '@/lib/version';
import BrandLogo from '@/components/BrandLogo';

export default function Footer() {
  return (
    <footer className="border-t border-violet-100/70 bg-[linear-gradient(180deg,rgba(255,255,255,0.82),rgba(247,246,255,0.96))]">
      <div className="mx-auto max-w-6xl px-5 py-12 md:px-8 md:py-16">
        <div className="grid gap-10 md:grid-cols-[1.5fr_1fr_1fr] md:gap-16">
          <div>
            <BrandLogo className="mb-3" />
            <p className="max-w-sm text-sm leading-relaxed text-slate-500">输入主题或上传资料，AI 自动完成大纲、排版、配色与配图。</p>
          </div>
          <div>
            <h4 className="text-sm font-bold text-slate-900">产品</h4>
            <div className="mt-3 flex flex-wrap gap-x-5 gap-y-2 md:flex-col">
              <Link href="/pricing" className="text-sm text-slate-500 hover:text-indigo-600">定价方案</Link>
              <Link href="/account" className="text-sm text-slate-500 hover:text-indigo-600">用户中心</Link>
              <Link href="/history" className="text-sm text-slate-500 hover:text-indigo-600">生成历史</Link>
            </div>
          </div>
          <div>
            <h4 className="text-sm font-bold text-slate-900">协议与支持</h4>
            <div className="mt-3 flex flex-wrap gap-x-5 gap-y-2 md:flex-col">
              <Link href="/privacy" className="text-sm text-slate-500 hover:text-indigo-600">隐私政策</Link>
              <Link href="/terms" className="text-sm text-slate-500 hover:text-indigo-600">用户协议</Link>
              <Link href="/service-terms" className="text-sm text-slate-500 hover:text-indigo-600">服务条款</Link>
            </div>
          </div>
        </div>
        <div className="mt-10 border-t border-violet-100/70 pt-6 text-center text-[11px] text-slate-400">
          © 2026 省心PPT · {APP_VERSION}
        </div>
      </div>
    </footer>
  );
}
