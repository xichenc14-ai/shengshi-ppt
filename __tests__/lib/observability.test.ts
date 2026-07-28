import { afterEach, describe, expect, it, vi } from 'vitest';
import { getRequestId, logOperationalEvent, sendOperationalAlert } from '@/lib/observability';

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});

describe('observability', () => {
  it('preserves a valid request id and replaces an invalid one', () => {
    expect(getRequestId(new Request('http://localhost', {
      headers: { 'x-request-id': 'req-valid-1234' },
    }))).toBe('req-valid-1234');
    expect(getRequestId(new Request('http://localhost', {
      headers: { 'x-request-id': 'bad id' },
    }))).toMatch(/^[0-9a-f-]{36}$/);
  });

  it('writes structured logs while redacting secrets and personal fields', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    logOperationalEvent('error', 'payment.failed', {
      requestId: 'req-12345678',
      userId: '12345678-1234-1234-1234-123456789012',
      metadata: { apiKey: 'secret-value', phone: '13800138000', safe: 'visible' },
    });
    const payload = JSON.parse(String(spy.mock.calls[0]?.[0]));
    expect(payload.event).toBe('payment.failed');
    expect(payload.userId).not.toContain('12345678-1234-1234-1234-123456789012');
    expect(payload.metadata.apiKey).toBe('[redacted]');
    expect(payload.metadata.phone).toBe('[redacted]');
    expect(payload.metadata.safe).toBe('visible');
  });

  it('does not attempt a webhook when alerting is not configured', async () => {
    vi.stubEnv('OPS_ALERT_WEBHOOK_URL', '');
    vi.stubEnv('TELEGRAM_BOT_TOKEN', '');
    vi.stubEnv('TELEGRAM_CHAT_ID', '');
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    const result = await sendOperationalAlert('service.not_ready');
    expect(result).toEqual({ sent: false, reason: 'alert_channel_not_configured' });
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('falls back to Telegram when the primary webhook fails', async () => {
    vi.stubEnv('OPS_ALERT_WEBHOOK_URL', 'https://alerts.example.com/hook');
    vi.stubEnv('TELEGRAM_BOT_TOKEN', 'telegram-test-token');
    vi.stubEnv('TELEGRAM_CHAT_ID', 'chat-123');
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const fetchSpy = vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(new Response('failed', { status: 500 }))
      .mockResolvedValueOnce(new Response('{}', { status: 200 }));
    const result = await sendOperationalAlert('service.not_ready');
    expect(result.sent).toBe(true);
    expect(result.reason).toContain('telegram_fallback_after_webhook_http_500');
    expect(fetchSpy).toHaveBeenCalledTimes(2);
    expect(String(fetchSpy.mock.calls[1]?.[0])).toContain('api.telegram.org');
  });
});
