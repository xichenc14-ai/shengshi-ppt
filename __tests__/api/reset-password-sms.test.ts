import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { NextRequest } from 'next/server';

vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(),
}));

vi.mock('@/lib/sms-client', () => {
  const marker = '__REMOTE_SMS_PROVIDER_VERIFY__';
  return {
    REMOTE_SMS_CODE_MARKER: marker,
    sendSMS: vi.fn(),
    getStorableSMSCode: vi.fn((result: { code?: string; remoteVerify?: boolean }, fallbackCode: string) => (
      result.remoteVerify === true ? marker : `__LOCAL_SMS_CODE_HASH__:mock:${result.code || fallbackCode}`
    )),
    verifyStoredSMSCode: vi.fn(),
  };
});

import { createClient } from '@supabase/supabase-js';
import { POST } from '@/app/api/reset-password/route';
import { REMOTE_SMS_CODE_MARKER, sendSMS, verifyStoredSMSCode } from '@/lib/sms-client';

function asNextRequest(request: Request): NextRequest {
  return request as unknown as NextRequest;
}

function mockPost(payload: Record<string, unknown>, ip = '127.0.0.1') {
  return asNextRequest(new Request('http://localhost/api/reset-password', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-forwarded-for': ip,
    },
    body: JSON.stringify(payload),
  }));
}

function createSupabaseMock(options?: {
  users?: Array<Record<string, unknown>>;
  codeRows?: Array<Record<string, unknown>>;
}) {
  const insertedCodes: Array<Record<string, unknown>> = [];
  const userUpdates: Array<Record<string, unknown>> = [];
  const deletedFilters: Array<Record<string, unknown>> = [];
  const users = options?.users ?? [{ id: 'user-1' }];
  let codeRows = [...(options?.codeRows ?? [])];

  function filterBuilder(onDone: () => Promise<Record<string, unknown>> | Record<string, unknown>) {
    const filters: Record<string, unknown> = {};
    const builder = {
      eq(field: string, value: unknown) {
        filters[field] = value;
        return builder;
      },
      then(resolve: (value: unknown) => unknown) {
        deletedFilters.push(filters);
        return Promise.resolve(onDone()).then(resolve);
      },
    };
    return builder;
  }

  const client = {
    from(table: string) {
      if (table === 'users') {
        return {
          select: () => ({
            eq: () => ({
              limit: async () => ({ data: users, error: null }),
            }),
          }),
          update: (payload: Record<string, unknown>) => ({
            eq: async () => {
              userUpdates.push(payload);
              return { error: null };
            },
          }),
        };
      }

      if (table === 'verification_codes') {
        return {
          delete: () => filterBuilder(() => {
            codeRows = [];
            return { error: null };
          }),
          insert: async (payload: Record<string, unknown>) => {
            insertedCodes.push(payload);
            codeRows = [payload];
            return { error: null };
          },
          select: () => {
            const builder = {
              eq: () => builder,
              order: () => builder,
              limit: async () => ({ data: codeRows, error: null }),
            };
            return builder;
          },
        };
      }

      throw new Error(`unexpected table: ${table}`);
    },
  };

  return { client, insertedCodes, userUpdates, deletedFilters };
}

describe('/api/reset-password SMS verification contract', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://example.supabase.co';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role-key';
  });

  it('stores a local reset challenge before sending the fixed code to Aliyun', async () => {
    const supabase = createSupabaseMock();
    (createClient as unknown as ReturnType<typeof vi.fn>).mockReturnValue(supabase.client);
    (sendSMS as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      success: true,
      code: '123456',
    });

    const res = await POST(mockPost({
      action: 'send_reset_code',
      phone: '13800138001',
    }, '10.0.0.1'));
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.success).toBe(true);
    expect(sendSMS).toHaveBeenCalledWith('13800138001', expect.stringMatching(/^\d{6}$/), {
      outId: expect.any(String),
    });
    expect(supabase.insertedCodes[0]).toMatchObject({
      phone: '13800138001',
      code: expect.stringMatching(/^__LOCAL_SMS_CODE_HASH__:/),
      type: 'reset_password',
    });
  });

  it('verifies reset codes through the shared remote-marker verifier before updating password', async () => {
    const supabase = createSupabaseMock({
      codeRows: [{
        phone: '13800138002',
        code: REMOTE_SMS_CODE_MARKER,
        type: 'reset_password',
        expires_at: new Date(Date.now() + 60_000).toISOString(),
      }],
    });
    (createClient as unknown as ReturnType<typeof vi.fn>).mockReturnValue(supabase.client);
    (verifyStoredSMSCode as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({ valid: true });

    const res = await POST(mockPost({
      action: 'reset_password',
      phone: '13800138002',
      code: '123456',
      newPassword: 'abc12345',
    }, '10.0.0.2'));
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.success).toBe(true);
    expect(verifyStoredSMSCode).toHaveBeenCalledWith('13800138002', REMOTE_SMS_CODE_MARKER, '123456');
    expect(supabase.userUpdates[0]?.password_hash).toEqual(expect.any(String));
  });
});
