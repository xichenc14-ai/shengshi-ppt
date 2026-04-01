import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: '省事PPT - AI一键生成专业PPT',
  description: '输入主题，AI自动生成精美PPT，支持在线预览和导出PPTX。让PPT制作变得简单高效。',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="zh-CN">
      <body className="antialiased">
        {children}
      </body>
    </html>
  );
}
