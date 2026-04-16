import React from 'react';
import Link from 'next/link';

export default function Footer() {
  return (
    <footer className="relative bg-gradient-to-b from-white to-[#fafbfd] border-t border-purple-100/50">
      {/* 顶部装饰线 */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-32 h-1 bg-gradient-to-r from-transparent via-purple-400 to-transparent rounded-full opacity-60" />
      
      <div className="max-w-6xl mx-auto px-4 md:px-6 py-12 md:py-16">
        {/* 主要内容 */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8 md:gap-12">
          
          {/* Logo区 */}
          <div className="md:col-span-2">
            <div className="flex items-center gap-3 mb-4">
              <div className="relative">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-600 to-purple-500 flex items-center justify-center shadow-lg shadow-purple-200/50">
                  <span className="text-white text-lg font-black">P</span>
                </div>
                <div className="absolute -inset-1 bg-gradient-to-r from-purple-400 to-purple-300 rounded-xl blur opacity-30 -z-10" />
              </div>
              <div>
                <span className="text-lg font-bold text-gray-900 tracking-tight">省心PPT</span>
                <p className="text-xs text-gray-400 mt-0.5">AI驱动的专业演示生成</p>
              </div>
            </div>
            <p className="text-sm text-gray-500 leading-relaxed max-w-sm">
              让每个人都能轻松制作专业级PPT演示文稿。输入主题，AI自动生成精美排版，节省宝贵时间。
            </p>
            
            {/* 社交链接 */}
            <div className="flex items-center gap-3 mt-5">
              <a href="#" className="w-9 h-9 rounded-lg bg-gray-100 hover:bg-purple-50 flex items-center justify-center text-gray-400 hover:text-purple-600 transition-all">
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>
              </a>
              <a href="#" className="w-9 h-9 rounded-lg bg-gray-100 hover:bg-purple-50 flex items-center justify-center text-gray-400 hover:text-purple-600 transition-all">
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2C6.477 2 2 6.477 2 12c0 4.991 3.657 9.128 8.438 9.879V14.89h-2.54V12h2.54V9.797c0-2.506 1.492-3.89 3.777-3.89 1.094 0 2.238.195 2.238.195v2.46h-1.26c-1.243 0-1.63.771-1.63 1.562V12h2.773l-.443 2.89h-2.33v6.989C18.343 21.129 22 16.99 22 12c0-5.523-4.477-10-10-10z"/></svg>
              </a>
              <a href="#" className="w-9 h-9 rounded-lg bg-gray-100 hover:bg-purple-50 flex items-center justify-center text-gray-400 hover:text-purple-600 transition-all">
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/></svg>
              </a>
            </div>
          </div>
          
          {/* 产品 */}
          <div>
            <h4 className="text-sm font-semibold text-gray-900 mb-4">产品</h4>
            <ul className="space-y-3">
              <li><Link href="/pricing" className="text-sm text-gray-500 hover:text-purple-600 transition-colors">定价方案</Link></li>
              <li><Link href="/account" className="text-sm text-gray-500 hover:text-purple-600 transition-colors">用户中心</Link></li>
              <li><a href="#" className="text-sm text-gray-500 hover:text-purple-600 transition-colors">模板市场</a></li>
              <li><a href="#" className="text-sm text-gray-500 hover:text-purple-600 transition-colors">企业版</a></li>
            </ul>
          </div>
          
          {/* 支持 */}
          <div>
            <h4 className="text-sm font-semibold text-gray-900 mb-4">支持</h4>
            <ul className="space-y-3">
              <li><a href="#" className="text-sm text-gray-500 hover:text-purple-600 transition-colors">帮助中心</a></li>
              <li><a href="#" className="text-sm text-gray-500 hover:text-purple-600 transition-colors">使用教程</a></li>
              <li><a href="#" className="text-sm text-gray-500 hover:text-purple-600 transition-colors">联系我们</a></li>
              <li><a href="#" className="text-sm text-gray-500 hover:text-purple-600 transition-colors">意见反馈</a></li>
            </ul>
          </div>
        </div>
        
        {/* 分隔线 */}
        <div className="mt-10 pt-8 border-t border-gray-100">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex flex-wrap items-center justify-center gap-4 text-xs text-gray-400">
              <Link href="#" className="hover:text-purple-600 transition-colors">隐私政策</Link>
              <span className="w-1 h-1 rounded-full bg-gray-300" />
              <Link href="#" className="hover:text-purple-600 transition-colors">用户协议</Link>
              <span className="w-1 h-1 rounded-full bg-gray-300" />
              <Link href="#" className="hover:text-purple-600 transition-colors">服务条款</Link>
            </div>
            
            <div className="flex items-center gap-2">
              <span className="text-[11px] text-gray-400">让每个人都能轻松做出好看的PPT</span>
            </div>
          </div>
          
          <div className="mt-4 text-center">
            <p className="text-[11px] text-gray-300">© 2026 省心PPT · AI演示生成平台 · v9.5.1 · All rights reserved</p>
          </div>
        </div>
      </div>
    </footer>
  );
}
