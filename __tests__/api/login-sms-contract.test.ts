import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { NextRequest } from 'next/server';

vi.mock('@supabase/supabase-js', () => ({ createClient: vi.fn() }));
vi.mock('@/lib/rate-limit', () => ({
  checkSMSRateLimit: vi.fn(async () => ({ allowed: true })),
  distributedRateLimit: vi.fn(async () => ({ allowed: true })),
  rollbackSMSRateLimit: vi.fn(),
  rateLimit: vi.fn(() => ({ allowed: true })),
  getClientIP: () => '127.0.0.1', isIPBlocked: () => false,
  checkRegisterRateLimit: vi.fn(), isDevCleanupAllowed: () => false,
}));
vi.mock('@/lib/sms-client', async importOriginal => ({
  ...await importOriginal<typeof import('@/lib/sms-client')>(), sendSMS: vi.fn(),
}));
vi.mock('@/lib/gamma-key-pool', () => ({ getSharedKeyPoolRemaining: vi.fn() }));
vi.mock('@/lib/session', () => ({ getSession: vi.fn() }));

import { createClient } from '@supabase/supabase-js';
import { sendSMS, verifyStoredSMSCode } from '@/lib/sms-client';
import { checkSMSRateLimit } from '@/lib/rate-limit';
import { POST } from '@/app/api/user/route';
import { classifySMSSend } from '@/lib/login-request';

let rows: Array<Record<string, unknown>>;
let deleted: Array<Record<string, unknown>>;
let insertError: { message: string; code?: string } | null;
const request = () => new Request('http://localhost/api/user', {
  method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ action: 'send_code', phone: '13800138000' }),
}) as NextRequest;

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv('NODE_ENV', 'production');
  vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://example.supabase.co');
  vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'test-secret');
  vi.stubEnv('SMS_CODE_HASH_SECRET', 'test-code-secret');
  rows = []; deleted = []; insertError = null;
  vi.mocked(checkSMSRateLimit).mockResolvedValue({ allowed: true });
  vi.mocked(createClient).mockReturnValue({ from(table: string) {
    if (table === 'sms_send_attempts') return { upsert: async () => ({ error: null }) };
    if (table !== 'verification_codes') throw new Error(`Unexpected table ${table}`);
    return {
      insert: async (row: Record<string, unknown>) => {
        if (insertError) return { error: insertError };
        rows.push(row);
        return { error: null };
      },
      delete: () => {
        const filters: Record<string, unknown> = {};
        const builder = {
          eq(k: string, v: unknown) { filters[k] = v; return builder; },
          lt() { return builder; },
          then(resolve: (v: unknown) => unknown) {
            deleted.push(filters);
            if (filters.code) rows = rows.filter(row => row.code !== filters.code);
            return Promise.resolve({ error: null }).then(resolve);
          },
        };
        return builder;
      },
    };
  } } as unknown as ReturnType<typeof createClient>);
});
afterEach(() => { vi.unstubAllEnvs(); });

describe('登录短信前后端状态契约', () => {
  it('供应商超时保留预存挑战，202 在前端归为未确认，收到的验证码仍可验证', async () => {
    let sentCode = '';
    vi.mocked(sendSMS).mockImplementation(async (_phone, code) => {
      expect(rows).toHaveLength(1); // 必须先落库再发送
      sentCode = code!;
      return { success: false, errorCode: 'PROVIDER_TRANSPORT_ERROR' };
    });
    const response = await POST(request());
    const data = await response.json();
    expect(response.status).toBe(202);
    expect(data).toMatchObject({ success: true, deliveryState: 'unknown', retryAfter: 60, requestId: expect.any(String) });
    expect(classifySMSSend(response, data)).toBe('unknown');
    expect(rows).toHaveLength(1);
    expect(rows[0].code).not.toBe(sentCode);
    expect(await verifyStoredSMSCode('13800138000', String(rows[0].code), sentCode)).toEqual({ valid: true });
    expect(await verifyStoredSMSCode('13800138000', String(rows[0].code), '000000')).toMatchObject({ valid: false });
  });

  it('成功受理归为 accepted', async () => {
    vi.mocked(sendSMS).mockResolvedValue({ success: true });
    const response = await POST(request());
    expect(classifySMSSend(response, await response.json())).toBe('accepted');
  });

  it('验证码写入失败时不调用短信供应商', async () => {
    insertError = { message: 'database unavailable', code: '08006' };
    const response = await POST(request());
    expect(response.status).toBe(503);
    expect(await response.json()).toMatchObject({ error: '验证码服务暂时不可用，请稍后重试' });
    expect(sendSMS).not.toHaveBeenCalled();
    expect(rows).toHaveLength(0);
  });

  it('明确拒绝清除本次挑战，返回真实失败', async () => {
    vi.mocked(sendSMS).mockResolvedValue({ success: false, errorCode: 'INVALID_CONFIG' });
    const response = await POST(request());
    expect(response.status).toBe(503);
    expect(classifySMSSend(response, await response.json())).toBe('rejected');
    expect(rows).toHaveLength(0);
    expect(deleted.some(filter => Boolean(filter.code))).toBe(true);
  });

  it('限流拒绝不会再次调用供应商', async () => {
    vi.mocked(checkSMSRateLimit).mockResolvedValue({ allowed: false, reason: '请60秒后再试', retryAfter: 60 });
    const response = await POST(request());
    expect(response.status).toBe(429);
    expect(classifySMSSend(response, await response.json())).toBe('rejected');
    expect(sendSMS).not.toHaveBeenCalled();
  });
});
