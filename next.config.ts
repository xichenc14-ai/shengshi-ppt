import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // P0-004: 确保 SPA 路由的 SSR fallback
  // 统一使用尾部斜杠策略，避免路由重复
  trailingSlash: false,

  // 安全头部
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-XSS-Protection', value: '1; mode=block' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
        ],
      },
      {
        source: '/api/:path*',
        headers: [
          { key: 'Cache-Control', value: 'no-store' },
        ],
      },
    ];
  },
  // 图片优化域名白名单
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: '**.gamma.app' },
      { protocol: 'https', hostname: '**.supabase.co' },
    ],
  },
};

export default nextConfig;
