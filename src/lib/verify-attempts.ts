// 修复后的验证码防护：使用 Supabase 而非内存
// 修改 user/route.ts 中的 checkVerifyAttempts 调用

import { createClient } from '@supabase/supabase-js';

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key);
}

/**
 * 检查验证码尝试次数（Supabase版，支持多实例）
 */
export async function checkVerifyAttemptsDB(phone: string): Promise<{
  allowed: boolean;
  reason?: string;
  attemptsLeft: number;
}> {
  const sb = getSupabase();
  if (!sb) {
    // 降级到内存版（开发环境）
    const key = `verify_attempts:${phone}`;
    const entry = (global as any).__verifyAttempts?.[key];
    if (entry && Date.now() < entry.resetAt) {
      const left = 5 - entry.count;
      return { allowed: left > 0, attemptsLeft: Math.max(0, left), reason: left <= 0 ? '验证码错误次数过多，请10分钟后重试' : undefined };
    }
    return { allowed: true, attemptsLeft: 5 };
  }

  try {
    const { data: record } = await sb
      .from('verify_attempts')
      .select('*')
      .eq('phone', phone)
      .single();

    if (!record) return { allowed: true, attemptsLeft: 5 };

    // 检查是否被临时封禁
    if (record.blocked_until && new Date(record.blocked_until) > new Date()) {
      const left = Math.ceil((new Date(record.blocked_until).getTime() - Date.now()) / 1000);
      return { allowed: false, attemptsLeft: 0, reason: `请${left}秒后再试` };
    }

    // 检查是否超时（10分钟窗口）
    const windowMs = 10 * 60 * 1000;
    if (new Date(record.last_attempt_at).getTime() + windowMs < Date.now()) {
      // 窗口过期，重置
      await sb.from('verify_attempts').upsert({ phone, attempts: 0, last_attempt_at: new Date().toISOString(), blocked_until: null });
      return { allowed: true, attemptsLeft: 5 };
    }

    const left = Math.max(0, 5 - record.attempts);
    if (left <= 0) {
      // 封禁10分钟
      const blockedUntil = new Date(Date.now() + 10 * 60 * 1000).toISOString();
      await sb.from('verify_attempts').upsert({ phone, attempts: 5, blocked_until: blockedUntil, last_attempt_at: new Date().toISOString() });
      return { allowed: false, attemptsLeft: 0, reason: '验证码错误次数过多，请10分钟后重试' };
    }

    return { allowed: true, attemptsLeft: left };
  } catch {
    return { allowed: true, attemptsLeft: 5 };
  }
}

/**
 * 记录验证码尝试（失败时调用）
 */
export async function recordVerifyAttempt(phone: string): Promise<void> {
  const sb = getSupabase();
  if (!sb) {
    // 内存版
    if (!(global as any).__verifyAttempts) (global as any).__verifyAttempts = {};
    const key = `verify_attempts:${phone}`;
    const now = Date.now();
    const entry = (global as any).__verifyAttempts[key];
    if (!entry || now > entry.resetAt) {
      (global as any).__verifyAttempts[key] = { count: 1, resetAt: now + 10 * 60 * 1000 };
    } else {
      entry.count++;
    }
    return;
  }

  try {
    const { data: record } = await sb.from('verify_attempts').select('*').eq('phone', phone).single();
    if (!record) {
      await sb.from('verify_attempts').insert({ phone, attempts: 1, last_attempt_at: new Date().toISOString() });
    } else {
      await sb.from('verify_attempts').update({
        attempts: (record.attempts || 0) + 1,
        last_attempt_at: new Date().toISOString(),
      }).eq('phone', phone);
    }
  } catch {}
}

/**
 * 清除验证记录（成功时调用）
 */
export async function clearVerifyAttempts(phone: string): Promise<void> {
  const sb = getSupabase();
  if (!sb) {
    if ((global as any).__verifyAttempts) delete (global as any).__verifyAttempts[`verify_attempts:${phone}`];
    return;
  }

  try {
    await sb.from('verify_attempts').delete().eq('phone', phone);
  } catch {}
}
