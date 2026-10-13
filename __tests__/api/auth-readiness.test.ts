import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { NextRequest } from 'next/server';
const mocks = vi.hoisted(() => ({ admin: vi.fn(), sms: vi.fn(), fetch: vi.fn() }));
vi.mock('@/lib/admin-auth', () => ({ requireAdmin: mocks.admin }));
vi.mock('@/lib/sms-client', () => ({ inspectSMSProviderReadiness: mocks.sms }));
import { GET } from '@/app/api/health/auth/route';
const request = () => new Request('http://localhost/api/health/auth') as NextRequest;

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://example.supabase.co');
  vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'test-role');
  vi.stubEnv('VERCEL_REGION', 'hnd1');
  vi.stubGlobal('fetch', mocks.fetch);
  mocks.admin.mockResolvedValue({ ok: true });
  mocks.sms.mockResolvedValue({ ready: true, detail: 'aliyun_auth_rpc_isv.ValidateFail' });
  mocks.fetch.mockResolvedValue(new Response('[{"code":"private-challenge"}]', { status: 200 }));
});
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });

describe('authentication dependency readiness', () => {
  it('rejects unauthorized probes without touching database or SMS APIs', async () => {
    mocks.admin.mockResolvedValue({ ok: false });
    expect((await GET(request())).status).toBe(403);
    expect(mocks.fetch).not.toHaveBeenCalled();
    expect(mocks.sms).not.toHaveBeenCalled();
  });
  it('checks the real challenge schema and RPC path without exposing private rows', async () => {
    const response = await GET(request());
    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data).toMatchObject({ ready: true, region: 'hnd1' });
    expect(JSON.stringify(data)).not.toContain('private-challenge');
    expect(mocks.fetch.mock.calls[0][0]).toContain('verification_codes?select=id,code,phone,type,expires_at,verified');
    expect(mocks.fetch.mock.calls[0][1].method).toBeUndefined();
  });
  it('blocks readiness when only the SMS network fails despite healthy database', async () => {
    mocks.sms.mockResolvedValue({ ready: false, detail: 'aliyun_auth_rpc_transport_error' });
    const response = await GET(request());
    expect(response.status).toBe(503);
    expect(await response.json()).toMatchObject({ ready: false, checks: expect.arrayContaining([{ name: 'sms_provider', ok: false, detail: 'aliyun_auth_rpc_transport_error', latencyMs: expect.any(Number) }]) });
  });
  it('blocks readiness on an unavailable challenge database', async () => {
    mocks.fetch.mockRejectedValue(new Error('DNS failed'));
    expect((await GET(request())).status).toBe(503);
  });
});
