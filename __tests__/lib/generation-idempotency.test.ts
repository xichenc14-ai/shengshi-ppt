import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { single, updateResult, deleteResult } = vi.hoisted(() => ({
  single: vi.fn(),
  updateResult: vi.fn(),
  deleteResult: vi.fn(),
}));

vi.mock('@supabase/supabase-js', () => {
  const query: Record<string, unknown> = {};
  for (const method of ['insert', 'select', 'eq', 'update', 'delete', 'lt']) {
    query[method] = vi.fn(() => query);
  }
  query.single = single;
  query.then = (resolve: (value: unknown) => unknown) => resolve(
    updateResult.mock.calls.length > 0 ? updateResult() : deleteResult(),
  );
  return { createClient: vi.fn(() => ({ from: vi.fn(() => query) })) };
});

import { claimGenerationRequest, normalizeGenerationRequestId } from '@/lib/generation-idempotency';

describe('generation idempotency', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv('NODE_ENV', 'test');
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://db.example.com');
    vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'service-key');
    updateResult.mockResolvedValue({ error: null });
    deleteResult.mockResolvedValue({ data: [], error: null });
  });

  afterEach(() => vi.unstubAllEnvs());

  it('rejects invalid idempotency keys without touching storage', async () => {
    expect(normalizeGenerationRequestId('bad id')).toBe('');
    expect(await claimGenerationRequest('user-1', 'bad id', 'gamma')).toEqual({ kind: 'disabled' });
    expect(single).not.toHaveBeenCalled();
  });

  it('claims a new request atomically', async () => {
    single.mockResolvedValueOnce({ data: { id: 'request-1' }, error: null });
    await expect(claimGenerationRequest('user-1', 'request-key-1234', 'gamma')).resolves.toEqual({
      kind: 'claimed', id: 'request-1', key: 'request-key-1234',
    });
  });

  it('replays an existing provider task instead of creating a duplicate', async () => {
    single
      .mockResolvedValueOnce({ data: null, error: { code: '23505', message: 'duplicate' } })
      .mockResolvedValueOnce({
        data: {
          id: 'request-1', user_id: 'user-1', idempotency_key: 'request-key-1234',
          route: 'gamma', provider_generation_id: 'gamma-1', status: 'processing', attempts: 1,
          created_at: new Date().toISOString(), updated_at: new Date().toISOString(), expires_at: new Date().toISOString(),
        },
        error: null,
      });
    await expect(claimGenerationRequest('user-1', 'request-key-1234', 'gamma')).resolves.toEqual({
      kind: 'replay', generationId: 'gamma-1', key: 'request-key-1234',
    });
  });
});
