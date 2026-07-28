import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { NextRequest } from 'next/server';

const {
  runReadinessChecks,
  cleanupExpiredGenerationRequests,
  cleanupExpiredTemporaryAttachments,
  logOperationalEvent,
  sendOperationalAlert,
} = vi.hoisted(() => ({
  runReadinessChecks: vi.fn(),
  cleanupExpiredGenerationRequests: vi.fn(),
  cleanupExpiredTemporaryAttachments: vi.fn(),
  logOperationalEvent: vi.fn(),
  sendOperationalAlert: vi.fn(),
}));

vi.mock('@/lib/readiness', () => ({ runReadinessChecks }));
vi.mock('@/lib/generation-idempotency', () => ({ cleanupExpiredGenerationRequests }));
vi.mock('@/lib/temporary-attachments', () => ({ cleanupExpiredTemporaryAttachments }));
vi.mock('@/lib/observability', () => ({
  getRequestId: vi.fn(() => 'req-cron-1234'),
  logOperationalEvent,
  sendOperationalAlert,
}));

import { GET, POST } from '@/app/api/cron/operational-check/route';

function request(secret?: string) {
  return new Request('http://localhost/api/cron/operational-check', {
    headers: secret ? { authorization: `Bearer ${secret}` } : {},
  }) as unknown as NextRequest;
}

describe('GET /api/cron/operational-check', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.CRON_SECRET = 'cron-test-secret';
    cleanupExpiredGenerationRequests.mockResolvedValue(2);
    cleanupExpiredTemporaryAttachments.mockResolvedValue(3);
    sendOperationalAlert.mockResolvedValue({ sent: true });
  });

  it('rejects requests without the cron secret', async () => {
    const response = await GET(request());
    expect(response.status).toBe(401);
    expect(runReadinessChecks).not.toHaveBeenCalled();
  });

  it('returns operational status and cleans expired control records', async () => {
    runReadinessChecks.mockResolvedValue({
      ready: true,
      checkedAt: '2026-07-13T00:00:00.000Z',
      checks: [{ name: 'database', ok: true, latencyMs: 5 }],
    });
    const response = await GET(request('cron-test-secret'));
    const body = await response.json();
    expect(response.status).toBe(200);
    expect(body.expiredTaskRecordsDeleted).toBe(2);
    expect(body.expiredAttachmentsDeleted).toBe(3);
    expect(logOperationalEvent).toHaveBeenCalledWith('info', 'operational_check.ready', expect.any(Object));
  });

  it('alerts and returns 503 when dependencies are unavailable', async () => {
    runReadinessChecks.mockResolvedValue({
      ready: false,
      checkedAt: '2026-07-13T00:00:00.000Z',
      checks: [{ name: 'database', ok: false, latencyMs: 5, detail: 'unavailable' }],
    });
    const response = await GET(request('cron-test-secret'));
    expect(response.status).toBe(503);
    expect(sendOperationalAlert).toHaveBeenCalledWith('service.not_ready', expect.any(Object));
  });

  it('verifies delivery through the configured alert channel', async () => {
    const response = await POST(request('cron-test-secret'));
    expect(response.status).toBe(200);
    expect((await response.json()).delivery.sent).toBe(true);
    expect(sendOperationalAlert).toHaveBeenCalledWith(
      'operational_alert.delivery_test',
      expect.objectContaining({ requestId: 'req-cron-1234' }),
    );
  });

  it('fails the delivery test when the alert provider rejects it', async () => {
    sendOperationalAlert.mockResolvedValue({ sent: false, reason: 'webhook_http_500' });
    const response = await POST(request('cron-test-secret'));
    expect(response.status).toBe(503);
    expect((await response.json()).delivery.reason).toBe('webhook_http_500');
  });
});
