// 简易 Rate Limiter（内存级，适合单实例）
// 生产环境建议用 Vercel Edge Middleware 或 Redis

type RateLimitEntry = { count: number; resetAt: number };

const store = new Map<string, RateLimitEntry>();

export interface RateLimitConfig {
  windowMs: number;  // 时间窗口（毫秒）
  maxRequests: number;  // 窗口内最大请求数
}

const DEFAULT_CONFIG: RateLimitConfig = {
  windowMs: 60 * 1000,  // 1分钟
  maxRequests: 30,
};

// 特殊路由限流
const ROUTE_CONFIGS: Record<string, RateLimitConfig> = {
  '/api/outline': { windowMs: 60 * 1000, maxRequests: 10 },
  '/api/gamma': { windowMs: 60 * 1000, maxRequests: 5 },
  '/api/user': { windowMs: 60 * 1000, maxRequests: 10 },
  '/api/credits': { windowMs: 60 * 1000, maxRequests: 20 },
};

export function rateLimit(key: string, config?: Partial<RateLimitConfig>): { allowed: boolean; remaining: number; resetAt: number } {
  const now = Date.now();
  const cfg = { ...DEFAULT_CONFIG, ...config };

  const entry = store.get(key);
  if (!entry || now > entry.resetAt) {
    const resetAt = now + cfg.windowMs;
    store.set(key, { count: 1, resetAt });
    return { allowed: true, remaining: cfg.maxRequests - 1, resetAt };
  }

  if (entry.count >= cfg.maxRequests) {
    return { allowed: false, remaining: 0, resetAt: entry.resetAt };
  }

  entry.count++;
  store.set(key, entry);
  return { allowed: true, remaining: cfg.maxRequests - entry.count, resetAt: entry.resetAt };
}

export function getRateLimitConfig(path: string): RateLimitConfig {
  // 匹配最具体的路由配置
  for (const [route, cfg] of Object.entries(ROUTE_CONFIGS)) {
    if (path.startsWith(route)) return cfg;
  }
  return DEFAULT_CONFIG;
}

// 定期清理过期条目（每5分钟）
if (typeof globalThis !== 'undefined') {
  setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of store.entries()) {
      if (now > entry.resetAt) store.delete(key);
    }
  }, 5 * 60 * 1000);
}
