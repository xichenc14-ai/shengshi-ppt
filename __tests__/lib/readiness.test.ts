import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { getKeyPoolStatus } = vi.hoisted(() => ({
  getKeyPoolStatus: vi.fn(),
}));

vi.mock('@/lib/gamma-key-pool', () => ({ getKeyPoolStatus }));
vi.mock('@/lib/payment/provider-adapter', () => ({
  getSupportedPaymentMethods: vi.fn(() => []),
  inspectProviderReadiness: vi.fn(),
}));

import { runReadinessChecks } from '@/lib/readiness';

describe('commercial dependency readiness', () => {
  beforeEach(() => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://database.example.com');
    vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'service-role-test-key');
    vi.stubEnv('SMS_PROVIDER', 'aliyun_auth');
    vi.stubEnv('ALIYUN_ACCESS_KEY_ID', 'aliyun-access-key');
    vi.stubEnv('ALIYUN_ACCESS_KEY_SECRET', 'aliyun-access-secret');
    vi.stubEnv('ALIYUN_SMS_SIGN_NAME', 'test-sign');
    vi.stubEnv('ALIYUN_SMS_TEMPLATE_CODE', '100001');
    vi.stubEnv('CRON_SECRET', '');
    vi.stubEnv('OPS_ALERT_WEBHOOK_URL', '');
    vi.stubEnv('TELEGRAM_BOT_TOKEN', '');
    vi.stubEnv('TELEGRAM_CHAT_ID', '');
    vi.stubEnv('OPS_ALERTS_REQUIRED', 'false');
    vi.stubEnv('DOWNLOAD_ACCELERATION_ENABLED', 'false');
    vi.stubEnv('R2_ACCOUNT_ID', '');
    vi.stubEnv('R2_ACCESS_KEY_ID', '');
    vi.stubEnv('R2_SECRET_ACCESS_KEY', '');
    vi.stubEnv('R2_BUCKET', '');
    getKeyPoolStatus.mockResolvedValue({ healthyCount: 1 });
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => (
      String(input).includes('dypnsapi.aliyuncs.com')
        ? new Response(JSON.stringify({ Code: 'isv.ValidateFail', Success: false }), { status: 400 })
        : new Response('[]', { status: 200 })
    ));
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
  });

  it('requires cron authentication but keeps external alert delivery optional', async () => {
    const result = await runReadinessChecks();
    expect(result.ready).toBe(false);
    expect(result.checks).toEqual(expect.arrayContaining([
      expect.objectContaining({ name: 'operational_alerting', ok: true, detail: 'optional_not_configured' }),
      expect.objectContaining({ name: 'scheduled_operations', ok: false }),
    ]));
  });

  it('passes operational configuration checks with a strong secret and alert channel', async () => {
    vi.stubEnv('CRON_SECRET', 'cron-secret-at-least-24-characters');
    vi.stubEnv('OPS_ALERT_WEBHOOK_URL', 'https://alerts.example.com/hook');
    const result = await runReadinessChecks();
    expect(result.ready).toBe(true);
  });

  it('accepts existing R2 download acceleration when its configuration is complete', async () => {
    vi.stubEnv('CRON_SECRET', 'cron-secret-at-least-24-characters');
    vi.stubEnv('DOWNLOAD_ACCELERATION_ENABLED', 'true');
    vi.stubEnv('R2_ACCOUNT_ID', 'account');
    vi.stubEnv('R2_ACCESS_KEY_ID', 'access');
    vi.stubEnv('R2_SECRET_ACCESS_KEY', 'secret');
    vi.stubEnv('R2_BUCKET', 'bucket');
    const result = await runReadinessChecks();
    expect(result.ready).toBe(true);
    expect(result.checks).toContainEqual(expect.objectContaining({
      name: 'artifact_delivery',
      ok: true,
      detail: 'r2_acceleration_ready',
    }));
  });

  it('rejects enabled R2 acceleration when required credentials are incomplete', async () => {
    vi.stubEnv('CRON_SECRET', 'cron-secret-at-least-24-characters');
    vi.stubEnv('DOWNLOAD_ACCELERATION_ENABLED', 'true');
    const result = await runReadinessChecks();
    expect(result.ready).toBe(false);
    expect(result.checks).toContainEqual(expect.objectContaining({
      name: 'artifact_delivery',
      ok: false,
      detail: 'r2_acceleration_incomplete',
    }));
  });

  it('fails readiness when the SMS provider endpoint is unreachable', async () => {
    vi.stubEnv('CRON_SECRET', 'cron-secret-at-least-24-characters');
    vi.mocked(globalThis.fetch).mockImplementation(async (input) => {
      if (String(input).includes('dypnsapi.aliyuncs.com')) {
        throw new DOMException('The operation timed out', 'TimeoutError');
      }
      return new Response('[]', { status: 200 });
    });
    const result = await runReadinessChecks();
    expect(result.ready).toBe(false);
    expect(result.checks).toContainEqual(expect.objectContaining({
      name: 'sms_provider',
      ok: false,
    }));
  });
});
