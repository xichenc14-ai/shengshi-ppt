// Rate Limiter - 支持多层限流策略
// L1: 内存级（适合单实例/Vercel单实例）
// L2: Supabase DB级（跨实例共享，适合生产环境）
// 
// 安全策略：
// - 每IP基础限流（防滥用）
// - 每手机号短信限流（防短信轰炸）
// - 每用户生成限流（防并发滥用）
// - 验证码尝试次数限制（防暴力破解）

import { createHash } from 'crypto';
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

export interface RateLimitConfig {
  windowMs: number;
  maxRequests: number;
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: number;
  source?: 'memory' | 'database' | 'fallback';
}

function distributedStoreConfigured(): boolean {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);
}

let distributedClient: ReturnType<typeof createClient> | null = null;

function getDistributedClient(): ReturnType<typeof createClient> {
  if (!distributedClient) {
    distributedClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL as string,
      process.env.SUPABASE_SERVICE_ROLE_KEY as string,
      { auth: { persistSession: false, autoRefreshToken: false } },
    );
  }
  return distributedClient;
}

function hashRateLimitKey(key: string): string {
  return createHash('sha256').update(`v1:${key}`).digest('hex');
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
export function rateLimit(key: string, config?: Partial<RateLimitConfig>): RateLimitResult {
  const now = Date.now();
  const cfg = { ...DEFAULT_CONFIG, ...config };

  const entry = memoryStore.get(key);
  if (!entry || now > entry.resetAt) {
    const resetAt = now + cfg.windowMs;
    memoryStore.set(key, { count: 1, resetAt });
    return { allowed: true, remaining: cfg.maxRequests - 1, resetAt, source: 'memory' };
  }

  if (entry.count >= cfg.maxRequests) {
    return { allowed: false, remaining: 0, resetAt: entry.resetAt, source: 'memory' };
  }

  entry.count++;
  memoryStore.set(key, entry);
  return { allowed: true, remaining: cfg.maxRequests - entry.count, resetAt: entry.resetAt, source: 'memory' };
}

/**
 * 跨实例原子限流。生产环境优先使用 Supabase RPC；RPC 短暂不可用时，
 * 降级到当前实例的更严格内存窗口并记录错误，避免一次数据库瞬断把所有
 * 登录、注册和找回密码用户一并拒绝。
 */
export async function distributedRateLimit(
  key: string,
  config?: Partial<RateLimitConfig>,
): Promise<RateLimitResult> {
  const cfg = { ...DEFAULT_CONFIG, ...config };
  if (process.env.NODE_ENV !== 'production') return rateLimit(key, cfg);
  const resetAt = Date.now() + cfg.windowMs;

  const fallback = (reason: string): RateLimitResult => {
    console.error('[RateLimit] distributed limiter unavailable; using local fallback:', reason);
    const fallbackConfig: RateLimitConfig = {
      windowMs: cfg.windowMs,
      // 多实例下仍保持保守，手机号一分钟一次的限制不会被放宽。
      maxRequests: Math.max(1, Math.floor(cfg.maxRequests / 2)),
    };
    const result = rateLimit(`fallback:${key}`, fallbackConfig);
    return { ...result, source: 'fallback' };
  };
  if (!distributedStoreConfigured()) {
    return fallback('distributed store is not configured in production');
  }

  try {
    const sb = getDistributedClient();
    // Supabase rpc 依赖客户端实例上下文，不能解构后以裸函数方式调用。
    const rpc = sb.rpc as unknown as (
      this: typeof sb,
      name: string,
      args: Record<string, string | number>,
    ) => Promise<{ data: unknown; error: { message?: string } | null }>;
    const { data, error } = await rpc.call(sb, 'consume_rate_limit', {
      p_key_hash: hashRateLimitKey(key),
      p_window_seconds: Math.max(1, Math.ceil(cfg.windowMs / 1000)),
      p_limit: Math.max(1, Math.floor(cfg.maxRequests)),
    });
    if (error) throw error;
    const row = Array.isArray(data) ? data[0] : data;
    if (!row || typeof row !== 'object') throw new Error('consume_rate_limit returned no result');
    const value = row as Record<string, unknown>;
    const parsedReset = new Date(String(value.reset_at || '')).getTime();
    return {
      allowed: value.allowed === true,
      remaining: Math.max(0, Number(value.remaining || 0)),
      resetAt: Number.isFinite(parsedReset) ? parsedReset : resetAt,
      source: 'database',
    };
  } catch (error) {
    return fallback(error instanceof Error ? error.message : String(error));
  }
}

// ===== 短信发送限流（IP + 手机号双重限制） =====
export interface SMSRateLimitResult {
  allowed: boolean;
  reason?: string;
  retryAfter?: number; // 秒
}

function rollbackRateLimit(key: string) {
  const entry = memoryStore.get(key);
  if (!entry) return;
  if (entry.count <= 1) {
    memoryStore.delete(key);
    return;
  }
  memoryStore.set(key, { ...entry, count: entry.count - 1 });
}

export async function releaseRateLimitReservation(key: string): Promise<void> {
  // 无论使用了数据库还是本机降级窗口，都尝试释放本机预留。
  rollbackRateLimit(`fallback:${key}`);
  if (process.env.NODE_ENV !== 'production') {
    rollbackRateLimit(key);
    return;
  }
  if (!distributedStoreConfigured()) {
    console.error('[RateLimit] cannot release reservation: distributed store is not configured');
    return;
  }
  try {
    const sb = getDistributedClient();
    const rpc = sb.rpc as unknown as (
      this: typeof sb,
      name: string,
      args: Record<string, string>,
    ) => Promise<{ data: unknown; error: { message?: string } | null }>;
    const { error } = await rpc.call(sb, 'release_rate_limit', {
      p_key_hash: hashRateLimitKey(key),
    });
    if (error) throw error;
  } catch (error) {
    console.error('[RateLimit] distributed reservation release failed:', error instanceof Error ? error.message : String(error));
  }
}

export async function rollbackSMSRateLimit(ip: string, phone: string): Promise<void> {
  await Promise.all([
    releaseRateLimitReservation(`sms_phone_min:${phone}`),
    releaseRateLimitReservation(`sms_phone:${phone}`),
    releaseRateLimitReservation(`sms_ip_min:${ip}`),
    releaseRateLimitReservation(`sms_ip:${ip}`),
  ]);
}

export async function checkSMSRateLimit(ip: string, phone: string): Promise<SMSRateLimitResult> {
  const gates: Array<{
    key: string;
    config: RateLimitConfig;
    reason: string;
  }> = [
    // 共享移动网络、公司和校园网络的用户会共用公网 IP；IP 只作为次级防护，
    // 手机号限制才是防短信轰炸的主门槛。
    { key: `sms_ip:${ip}`, config: { windowMs: 60 * 60 * 1000, maxRequests: 30 }, reason: '当前网络请求过于频繁，请稍后再试' },
    { key: `sms_ip_min:${ip}`, config: { windowMs: 60 * 1000, maxRequests: 5 }, reason: '当前网络请求过于频繁，请稍后再试' },
    { key: `sms_phone:${phone}`, config: { windowMs: 60 * 60 * 1000, maxRequests: 5 }, reason: '该手机号本小时发送次数已达上限' },
    { key: `sms_phone_min:${phone}`, config: { windowMs: 60 * 1000, maxRequests: 1 }, reason: '请60秒后再试' },
  ];
  // 四个独立 key 并行预留，避免跨区域数据库的四次串行往返。
  const results = await Promise.all(gates.map((gate) => distributedRateLimit(gate.key, gate.config)));
  const failedIndex = results.findIndex((result) => !result.allowed);
  if (failedIndex >= 0) {
    await Promise.all(results.map((result, index) => (
      result.allowed ? releaseRateLimitReservation(gates[index].key) : Promise.resolve()
    )));
    const failed = results[failedIndex];
    return {
      allowed: false,
      reason: gates[failedIndex].reason,
      retryAfter: Math.max(1, Math.ceil((failed.resetAt - Date.now()) / 1000)),
    };
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
  const ipResult = await distributedRateLimit(`register_ip:${ip}`, { windowMs: 60 * 60 * 1000, maxRequests: 5 });
  if (!ipResult.allowed) {
    return { allowed: false, reason: '注册过于频繁，请稍后再试' };
  }

  // 手机号级别 - 同一手机号每天最多注册 1 次
  if (phone) {
    const phoneResult = await distributedRateLimit(`register_phone:${phone}`, { windowMs: 24 * 60 * 60 * 1000, maxRequests: 1 });
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
  const headers = request.headers;
  // 优先使用托管平台写入的来源头，最后才读取通用 x-forwarded-for。
  return headers.get('x-vercel-forwarded-for')?.split(',')[0]?.trim()
    || headers.get('cf-connecting-ip')
    || headers.get('x-real-ip')
    || headers.get('x-forwarded-for')?.split(',')[0]?.trim()
    || 'unknown';
}

// ===== 清理测试数据（仅开发模式） =====
export function isDevCleanupAllowed(request: Request): boolean {
  if (process.env.NODE_ENV === 'production') return false;
  // 开发模式也需要 localhost
  const ip = getClientIP(request);
  return ip === '127.0.0.1' || ip === '::1' || ip === 'unknown';
}
