import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { NextRequest } from 'next/server';

const { getSession, distributedRateLimit, from, query } = vi.hoisted(() => {
  const query = {
    select: vi.fn(),
    eq: vi.fn(),
    order: vi.fn(),
    limit: vi.fn(),
    insert: vi.fn(),
    single: vi.fn(),
    delete: vi.fn(),
  };
  return {
    getSession: vi.fn(),
    distributedRateLimit: vi.fn(),
    from: vi.fn(() => query),
    query,
  };
});

vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => ({ from })),
}));
vi.mock('@/lib/session', () => ({ getSession }));
vi.mock('@/lib/rate-limit', () => ({
  getClientIP: vi.fn(() => '127.0.0.1'),
  distributedRateLimit,
}));

import { GET, POST } from '@/app/api/history/route';

function request(path = '/api/history', init?: RequestInit) {
  return new Request(`http://localhost${path}`, init) as unknown as NextRequest;
}

describe('/api/history security and existing behavior', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://database.example.com');
    vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'service-role-key');
    distributedRateLimit.mockResolvedValue({ allowed: true, remaining: 10, resetAt: Date.now() + 60_000 });
    query.select.mockReturnValue(query);
    query.eq.mockReturnValue(query);
    query.order.mockReturnValue(query);
    query.insert.mockReturnValue(query);
    query.delete.mockReturnValue(query);
  });

  it('does not accept a raw user id in a Bearer header as authentication', async () => {
    getSession.mockResolvedValue({ isLoggedIn: false, user: null });
    const response = await GET(request('/api/history', {
      headers: { authorization: 'Bearer another-user-id' },
    }));
    expect(response.status).toBe(401);
    expect(from).not.toHaveBeenCalled();
  });

  it('keeps authenticated history listing behavior', async () => {
    getSession.mockResolvedValue({ isLoggedIn: true, user: { id: 'user-1' } });
    query.limit.mockResolvedValue({
      data: [{ id: 'history-1', title: '季度汇报' }],
      error: null,
    });
    const response = await GET(request('/api/history?limit=999'));
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ count: 1 });
    expect(query.eq).toHaveBeenCalledWith('user_id', 'user-1');
    expect(query.limit).toHaveBeenCalledWith(50);
  });

  it('keeps authenticated history saves and compacts slide previews by default', async () => {
    getSession.mockResolvedValue({ isLoggedIn: true, user: { id: 'user-1' } });
    query.single.mockResolvedValue({ data: { id: 'history-1' }, error: null });
    const response = await POST(request('/api/history', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        action: 'save',
        title: '季度汇报',
        slides: [{ id: 's1', title: '开场' }],
        downloadUrl: '/api/export-pptx?generationId=g1',
      }),
    }));
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ success: true });
    expect(query.insert).toHaveBeenCalledWith(expect.objectContaining({
      user_id: 'user-1',
      slides: [{ id: 's1', title: '开场' }],
      download_url: '/api/export-pptx?generationId=g1',
    }));
  });
});
