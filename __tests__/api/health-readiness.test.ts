import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { NextRequest } from 'next/server';

const { runReadinessChecks, logOperationalEvent } = vi.hoisted(() => ({
  runReadinessChecks: vi.fn(),
  logOperationalEvent: vi.fn(),
}));

vi.mock('@/lib/readiness', () => ({ runReadinessChecks }));
vi.mock('@/lib/observability', () => ({
  getRequestId: vi.fn(() => 'req-health-1234'),
  logOperationalEvent,
}));

import { GET } from '@/app/api/health/readiness/route';

describe('GET /api/health/readiness', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns 200 only when every dependency is ready', async () => {
    runReadinessChecks.mockResolvedValue({
      ready: true,
      checkedAt: '2026-07-13T00:00:00.000Z',
      checks: [{ name: 'database', ok: true, latencyMs: 5 }],
    });
    const response = await GET(new Request('http://localhost/api/health/readiness') as unknown as NextRequest);
    expect(response.status).toBe(200);
    expect(response.headers.get('x-request-id')).toBe('req-health-1234');
    expect((await response.json()).status).toBe('ready');
  });

  it('returns 503 when a dependency is unavailable', async () => {
    runReadinessChecks.mockResolvedValue({
      ready: false,
      checkedAt: '2026-07-13T00:00:00.000Z',
      checks: [{ name: 'database', ok: false, latencyMs: 5, detail: 'unavailable' }],
    });
    const response = await GET(new Request('http://localhost/api/health/readiness') as unknown as NextRequest);
    expect(response.status).toBe(503);
    expect((await response.json()).status).toBe('not_ready');
    expect(logOperationalEvent).toHaveBeenCalledWith('error', 'service.readiness', expect.any(Object));
  });
});
