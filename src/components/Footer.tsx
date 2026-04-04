import React from 'react';
import Link from 'next/link';

export default function Footer() {
  return (
    <footer className="bg-white border-t border-gray-100 py-10">
      <div className="max-w-5xl mx-auto px-4 md:px-6">
        <div className="flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-lg bg-gradient-to-br from-[#5B4FE9] to-[#8B5CF6] flex items-center justify-center">
              <span className="text-white text-[10px] font-bold">P</span>
            </div>
            <span className="text-sm font-bold text-gray-900">省心PPT</span>
            <span className="text-xs text-gray-400 ml-2">— AI一键生成专业PPT</span>
          </div>

          <div className="flex items-center gap-6 text-xs text-gray-400">
            <Link href="#" className="hover:text-[#5B4FE9] transition-colors">隐私政策</Link>
            <Link href="#" className="hover:text-[#5B4FE9] transition-colors">用户协议</Link>
            <Link href="#" className="hover:text-[#5B4FE9] transition-colors">联系我们</Link>
          </div>
        </div>

        <div className="mt-6 text-center">
          <p className="text-[11px] text-gray-300">让每个人都能轻松做出好看的PPT</p>
          <p className="text-[10px] text-gray-300 mt-1">© 2026 省心PPT · All rights reserved</p>
        </div>
      </div>
    </footer>
  );
}
