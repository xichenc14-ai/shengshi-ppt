import type { Metadata } from 'next';
import Script from 'next/script';
import { AuthProvider } from '@/lib/auth-context';
import './globals.css';

export const metadata: Metadata = {
  title: '省心PPT - AI一键生成专业PPT | 30秒出稿 | 免费试用',
  description: '省心PPT是AI驱动的PPT在线生成工具，输入主题即可30秒生成专业PPT。支持工作汇报、商业路演、教学课件、毕业答辩等8大场景，提供大纲编辑、多主题风格、PPTX/PDF导出。免费试用，每月3次免费生成。',
  keywords: '省心PPT,AI生成PPT,PPT在线生成,自动生成PPT,AI PPT,PPT制作工具,工作汇报PPT,免费PPT,在线PPT生成器',
  openGraph: {
    title: '省心PPT - AI一键生成专业PPT | 30秒出稿 | 免费试用',
    description: '输入主题，AI自动生成精美PPT。30秒出稿，支持PPTX/PDF导出，免费试用。',
    type: 'website',
    siteName: '省心PPT',
  },
};

const BAIDU_TONGJI_ID = process.env.NEXT_PUBLIC_BAIDU_TONGJI_ID;

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="zh-CN">
      <head>
        {BAIDU_TONGJI_ID ? (
          <Script
            src={`https://hm.baidu.com/hm.js?${BAIDU_TONGJI_ID}`}
            strategy="afterInteractive"
          />
        ) : null}
      </head>
      <body className="antialiased">
        <AuthProvider>
          {children}
        </AuthProvider>
      </body>
    </html>
  );
}
