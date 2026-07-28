import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { createClient, client, rpc } = vi.hoisted(() => {
  const client: { rpc?: ReturnType<typeof vi.fn> } = {};
  const rpc = vi.fn(function (this: unknown, _name: string, _args: Record<string, string | number>) {
    if (this !== client) throw new Error('rpc lost Supabase client context');
    return Promise.resolve({
      data: [{ allowed: true, remaining: 4, reset_at: new Date(Date.now() + 60_000).toISOString() }],
      error: null,
    });
  });
  client.rpc = rpc;
  return { createClient: vi.fn(() => client), client, rpc };
});

vi.mock('@supabase/supabase-js', () => ({ createClient }));

describe('distributedRateLimit production client binding', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://database.example.com');
    vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'service-role-key');
  });

  afterEach(() => vi.unstubAllEnvs());

  it('calls Supabase rpc with its client context intact', async () => {
    const { distributedRateLimit } = await import('@/lib/rate-limit');
    const result = await distributedRateLimit('production:bound-rpc', {
      maxRequests: 5,
      windowMs: 60_000,
    });
    expect(result).toMatchObject({ allowed: true, remaining: 4, source: 'database' });
    expect(rpc).toHaveBeenCalledWith('consume_rate_limit', expect.objectContaining({
      p_limit: 5,
      p_window_seconds: 60,
    }));
  });

  it('releases all distributed SMS reservations after a failed provider send', async () => {
    const { rollbackSMSRateLimit } = await import('@/lib/rate-limit');
    await rollbackSMSRateLimit('203.0.113.8', '13800138000');

    const releases = rpc.mock.calls.filter(([name]) => name === 'release_rate_limit');
    expect(releases).toHaveLength(4);
    expect(releases.every(([, args]) => /^[a-f0-9]{64}$/.test(String(args.p_key_hash)))).toBe(true);
  });
});
