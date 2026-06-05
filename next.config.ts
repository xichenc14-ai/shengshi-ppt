import type { NextConfig } from "next";

const cspDirectives = [
  "default-src 'self'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  "frame-src 'self' blob: data:",
  "object-src 'self' blob: data:",
  "img-src 'self' data: blob: https:",
  "font-src 'self' data:",
  "style-src 'self' 'unsafe-inline'",
  "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
  "connect-src 'self' https:",
  "worker-src 'self' blob:",
].join('; ');

const nextConfig: NextConfig = {
  typescript: {
    // 商业部署要求：构建期必须开启类型阻断
    ignoreBuildErrors: false,
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
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
          { key: 'Cross-Origin-Opener-Policy', value: 'same-origin' },
          { key: 'Cross-Origin-Resource-Policy', value: 'same-site' },
          { key: 'X-DNS-Prefetch-Control', value: 'off' },
          { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
          { key: 'Content-Security-Policy', value: cspDirectives },
        ],
      },
      {
        source: '/api/preview/file',
        headers: [
          { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
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
