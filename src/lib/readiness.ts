import { getKeyPoolStatus } from '@/lib/gamma-key-pool';
import { getSupportedPaymentMethods, inspectProviderReadiness } from '@/lib/payment/provider-adapter';
import { inspectSMSProviderReadiness } from '@/lib/sms-client';

export type ReadinessCheck = {
  name: string;
  ok: boolean;
  latencyMs: number;
  detail?: string;
};

export type ReadinessResult = {
  ready: boolean;
  checkedAt: string;
  checks: ReadinessCheck[];
};

async function timedCheck(name: string, check: () => Promise<{ ok: boolean; detail?: string }>): Promise<ReadinessCheck> {
  const startedAt = Date.now();
  try {
    const result = await check();
    return { name, ...result, latencyMs: Date.now() - startedAt };
  } catch (error) {
    return {
      name,
      ok: false,
      latencyMs: Date.now() - startedAt,
      detail: error instanceof Error ? error.message.slice(0, 200) : 'unknown_error',
    };
  }
}

async function checkDatabase(): Promise<{ ok: boolean; detail?: string }> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
  if (!url || !serviceKey) return { ok: false, detail: 'supabase_not_configured' };
  const response = await fetch(`${url.replace(/\/$/, '')}/rest/v1/users?select=id&limit=1`, {
    headers: {
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`,
    },
    cache: 'no-store',
    signal: AbortSignal.timeout(5_000),
  });
  if (!response.ok) return { ok: false, detail: `supabase_http_${response.status}` };
  await response.arrayBuffer();
  return { ok: true };
}

async function checkGamma(): Promise<{ ok: boolean; detail?: string }> {
  const status = await getKeyPoolStatus();
  return status.healthyCount > 0
    ? { ok: true, detail: `${status.healthyCount}_healthy_keys` }
    : { ok: false, detail: 'no_healthy_gamma_key' };
}

async function checkPayment(): Promise<{ ok: boolean; detail?: string }> {
  const methods = getSupportedPaymentMethods();
  const statuses = methods.map(inspectProviderReadiness);
  const failed = statuses.filter((item) => !item.ready);
  return failed.length === 0
    ? { ok: true, detail: methods.join(',') }
    : { ok: false, detail: failed.map((item) => `${item.provider}:${item.missing.join('|')}`).join(',') };
}

async function checkSMS(): Promise<{ ok: boolean; detail?: string }> {
  const result = await inspectSMSProviderReadiness();
  return { ok: result.ready, detail: result.detail };
}

async function checkArtifactDelivery(): Promise<{ ok: boolean; detail?: string }> {
  const accelerationEnabled = process.env.DOWNLOAD_ACCELERATION_ENABLED === 'true';
  const r2Configured = [
    'R2_ACCOUNT_ID',
    'R2_ACCESS_KEY_ID',
    'R2_SECRET_ACCESS_KEY',
    'R2_BUCKET',
  ].every((key) => Boolean(process.env[key]));
  return {
    ok: !accelerationEnabled || r2Configured,
    detail: accelerationEnabled
      ? (r2Configured ? 'r2_acceleration_ready' : 'r2_acceleration_incomplete')
      : 'direct_proxy_delivery',
  };
}

async function checkAlerting(): Promise<{ ok: boolean; detail?: string }> {
  const webhookConfigured = /^https:\/\//i.test(process.env.OPS_ALERT_WEBHOOK_URL || '');
  const telegramConfigured = Boolean(process.env.TELEGRAM_BOT_TOKEN && process.env.TELEGRAM_CHAT_ID);
  const configured = webhookConfigured || telegramConfigured;
  const required = process.env.OPS_ALERTS_REQUIRED === 'true';
  return {
    ok: configured || !required,
    detail: webhookConfigured ? 'webhook' : telegramConfigured ? 'telegram' : (required ? 'required_but_missing' : 'optional_not_configured'),
  };
}

async function checkScheduledOperations(): Promise<{ ok: boolean; detail?: string }> {
  const secretLength = String(process.env.CRON_SECRET || '').length;
  const required = process.env.NODE_ENV === 'production';
  return {
    ok: secretLength >= 24 || !required,
    detail: secretLength >= 24 ? 'configured' : (required ? 'missing_or_weak' : 'optional_not_configured'),
  };
}

export async function runReadinessChecks(): Promise<ReadinessResult> {
  const checks = await Promise.all([
    timedCheck('database', checkDatabase),
    timedCheck('gamma_key_pool', checkGamma),
    timedCheck('payment_provider', checkPayment),
    timedCheck('sms_provider', checkSMS),
    timedCheck('artifact_delivery', checkArtifactDelivery),
    timedCheck('operational_alerting', checkAlerting),
    timedCheck('scheduled_operations', checkScheduledOperations),
  ]);
  return {
    ready: checks.every((check) => check.ok),
    checkedAt: new Date().toISOString(),
    checks,
  };
}
