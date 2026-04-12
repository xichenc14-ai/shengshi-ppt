// Rate Limiter - 支持多层限流策略
// L1: 内存级（适合单实例/Vercel单实例）
// L2: Supabase DB级（跨实例共享，适合生产环境）
// 
// 安全策略：
// - 每IP基础限流（防滥用）
// - 每手机号短信限流（防短信轰炸）
// - 每用户生成限流（防并发滥用）
// - 验证码尝试次数限制（防暴力破解）

import { createClient } from '@supabase/supabase-js';

type RateLimitEntry = { count: number; resetAt: number };

// ===== 内存级存储 =====
const memoryStore = new Map<string, RateLimitEntry>();

// 定期清理过期条目
if (typeof globalThis !== 'undefined') {
  setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of memoryStore.entries()) {
      if (now > entry.resetAt) memoryStore.delete(key);
    }
  }, 5 * 60 * 1000);
}

// ===== Supabase 辅助 =====
function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key);
}

export interface RateLimitConfig {
  windowMs: number;
  maxRequests: number;
}

// ===== API 路由限流配置 =====
const ROUTE_CONFIGS: Record<string, RateLimitConfig> = {
  '/api/outline': { windowMs: 60 * 1000, maxRequests: 10 },
  '/api/gamma': { windowMs: 60 * 1000, maxRequests: 5 },
  '/api/gamma-direct': { windowMs: 60 * 1000, maxRequests: 5 },
  '/api/user': { windowMs: 60 * 1000, maxRequests: 15 },
  '/api/credits': { windowMs: 60 * 1000, maxRequests: 20 },
  '/api/payment': { windowMs: 60 * 1000, maxRequests: 10 },
  '/api/session': { windowMs: 60 * 1000, maxRequests: 30 },
};

const DEFAULT_CONFIG: RateLimitConfig = {
  windowMs: 60 * 1000,
  maxRequests: 30,
};

export function getRateLimitConfig(path: string): RateLimitConfig {
  for (const [route, cfg] of Object.entries(ROUTE_CONFIGS)) {
    if (path.startsWith(route)) return cfg;
  }
  return DEFAULT_CONFIG;
}

// ===== 内存级限流（基础） =====
export function rateLimit(key: string, config?: Partial<RateLimitConfig>): { allowed: boolean; remaining: number; resetAt: number } {
  const now = Date.now();
  const cfg = { ...DEFAULT_CONFIG, ...config };

  const entry = memoryStore.get(key);
  if (!entry || now > entry.resetAt) {
    const resetAt = now + cfg.windowMs;
    memoryStore.set(key, { count: 1, resetAt });
    return { allowed: true, remaining: cfg.maxRequests - 1, resetAt };
  }

  if (entry.count >= cfg.maxRequests) {
    return { allowed: false, remaining: 0, resetAt: entry.resetAt };
  }

  entry.count++;
  memoryStore.set(key, entry);
  return { allowed: true, remaining: cfg.maxRequests - entry.count, resetAt: entry.resetAt };
}

// ===== 短信发送限流（IP + 手机号双重限制） =====
export interface SMSRateLimitResult {
  allowed: boolean;
  reason?: string;
  retryAfter?: number; // 秒
}

export async function checkSMSRateLimit(ip: string, phone: string): Promise<SMSRateLimitResult> {
  // L1: IP 级别 - 同一IP每小时最多发送 10 条
  const ipResult = rateLimit(`sms_ip:${ip}`, { windowMs: 60 * 60 * 1000, maxRequests: 10 });
  if (!ipResult.allowed) {
    return { allowed: false, reason: '发送过于频繁，请稍后再试', retryAfter: Math.ceil((ipResult.resetAt - Date.now()) / 1000) };
  }

  // L2: IP 级别 - 同一IP每分钟最多 1 条（防快速重发）
  const ipMinuteResult = rateLimit(`sms_ip_min:${ip}`, { windowMs: 60 * 1000, maxRequests: 1 });
  if (!ipMinuteResult.allowed) {
    return { allowed: false, reason: '请60秒后再试', retryAfter: Math.ceil((ipMinuteResult.resetAt - Date.now()) / 1000) };
  }

  // L3: 手机号级别 - 同一手机号每小时最多 5 条
  const phoneResult = rateLimit(`sms_phone:${phone}`, { windowMs: 60 * 60 * 1000, maxRequests: 5 });
  if (!phoneResult.allowed) {
    return { allowed: false, reason: '该手机号今日发送次数已达上限', retryAfter: Math.ceil((phoneResult.resetAt - Date.now()) / 1000) };
  }

  // L4: 手机号级别 - 同一手机号每60秒最多 1 条
  const phoneMinuteResult = rateLimit(`sms_phone_min:${phone}`, { windowMs: 60 * 1000, maxRequests: 1 });
  if (!phoneMinuteResult.allowed) {
    return { allowed: false, reason: '请60秒后再试', retryAfter: Math.ceil((phoneMinuteResult.resetAt - Date.now()) / 1000) };
  }

  return { allowed: true };
}

// ===== 注册限流（IP + 手机号 + 全局） =====
export interface RegisterRateLimitResult {
  allowed: boolean;
  reason?: string;
}

export async function checkRegisterRateLimit(ip: string, phone?: string): Promise<RegisterRateLimitResult> {
  // IP 级别 - 同一IP每小时最多注册 5 个账号
  const ipResult = rateLimit(`register_ip:${ip}`, { windowMs: 60 * 60 * 1000, maxRequests: 5 });
  if (!ipResult.allowed) {
    return { allowed: false, reason: '注册过于频繁，请稍后再试' };
  }

  // 手机号级别 - 同一手机号每天最多注册 1 次
  if (phone) {
    const phoneResult = rateLimit(`register_phone:${phone}`, { windowMs: 24 * 60 * 60 * 1000, maxRequests: 1 });
    if (!phoneResult.allowed) {
      return { allowed: false, reason: '该手机号今日已注册过，请直接登录' };
    }
  }

  return { allowed: true };
}

// ===== 验证码尝试次数限制（防暴力破解） =====
export interface VerifyAttemptResult {
  allowed: boolean;
  reason?: string;
  attemptsLeft: number;
}

export function checkVerifyAttempts(phone: string): VerifyAttemptResult {
  const key = `verify_attempts:${phone}`;
  const result = rateLimit(key, { windowMs: 10 * 60 * 1000, maxRequests: 5 }); // 10分钟内最多5次
  return {
    allowed: result.allowed,
    attemptsLeft: result.remaining,
    reason: result.allowed ? undefined : '验证码错误次数过多，请10分钟后重试',
  };
}

// ===== 生成任务并发限制（每用户同时最多1个） =====
export interface GenerationLimitResult {
  allowed: boolean;
  reason?: string;
}

const activeGenerations = new Map<string, { startedAt: number }>();

export function checkGenerationLimit(userId: string): GenerationLimitResult {
  const active = activeGenerations.get(userId);
  if (active) {
    const elapsed = (Date.now() - active.startedAt) / 1000;
    if (elapsed > 180) {
      // 超过3分钟视为卡死，自动释放
      activeGenerations.delete(userId);
      return { allowed: true };
    }
    return { allowed: false, reason: '您有正在进行的生成任务，请等待完成' };
  }

  activeGenerations.set(userId, { startedAt: Date.now() });
  // 3分钟后自动释放（兜底）
  setTimeout(() => activeGenerations.delete(userId), 3 * 60 * 1000);
  return { allowed: true };
}

export function releaseGeneration(userId: string) {
  activeGenerations.delete(userId);
}

// ===== IP 黑名单（基础防御） =====
const BLOCKED_IPS = new Set<string>();

export function blockIP(ip: string, durationMs: number = 60 * 60 * 1000) {
  BLOCKED_IPS.add(ip);
  setTimeout(() => BLOCKED_IPS.delete(ip), durationMs);
}

export function isIPBlocked(ip: string): boolean {
  return BLOCKED_IPS.has(ip);
}

// ===== 统一 IP 提取 =====
export function getClientIP(request: Request): string {
  const headers = (request as any).headers;
  // Vercel / CF headers
  return headers.get('x-forwarded-for')?.split(',')[0]?.trim()
    || headers.get('x-real-ip')
    || headers.get('cf-connecting-ip')
    || 'unknown';
}

// ===== 清理测试数据（仅开发模式） =====
export function isDevCleanupAllowed(request: Request): boolean {
  if (process.env.NODE_ENV === 'production') return false;
  // 开发模式也需要 localhost
  const ip = getClientIP(request);
  return ip === '127.0.0.1' || ip === '::1' || ip === 'unknown';
}
