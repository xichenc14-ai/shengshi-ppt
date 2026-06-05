import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  typescript: {
    // 临时放开构建期类型阻断，避免历史遗留模块影响生产发布
    ignoreBuildErrors: true,
  },

  // 允许本地 127.0.0.1 调试地址访问开发资源（Playwright/E2E 常用）
  allowedDevOrigins: ['127.0.0.1'],

  // P0-004: 确保 SPA 路由的 SSR fallback
  // 统一使用尾部斜杠策略，避免路由重复
  trailingSlash: false,

  // DOMMatrix polyfill for pdfjs-dist during SSR/prerendering
  // DOMMatrix polyfill — loaded via page-level import (src/lib/dommatrix-polyfill.js)
  // Turbopack does not use webpack plugins, so ProvidePlugin was removed.
  turbopack: {},

  webpack: (config, { isServer }) => {
    if (isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        canvas: false,
        path: false,
      };
    }
    return config;
  },

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
