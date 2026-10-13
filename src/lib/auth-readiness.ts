import { inspectSMSProviderReadiness } from '@/lib/sms-client';
import { APP_VERSION } from '@/lib/version';

export async function inspectAuthReadiness() {
  const checks = await Promise.all([
    (async () => {
      const started = Date.now();
      const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
      const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
      if (!url || !key) return { name: 'database', ok: false, detail: 'not_configured', latencyMs: 0 };
      try {
        // Read exactly the columns required by the login challenge. Never return rows.
        const response = await fetch(`${url.replace(/\/$/, '')}/rest/v1/verification_codes?select=id,code,phone,type,expires_at,verified&limit=1`, {
          headers: { apikey: key, Authorization: `Bearer ${key}` },
          cache: 'no-store', signal: AbortSignal.timeout(8000),
        });
        await response.arrayBuffer();
        return { name: 'database', ok: response.ok, detail: response.ok ? 'challenge_schema_ready' : `http_${response.status}`, latencyMs: Date.now() - started };
      } catch {
        return { name: 'database', ok: false, detail: 'transport_error', latencyMs: Date.now() - started };
      }
    })(),
    (async () => {
      const started = Date.now();
      const result = await inspectSMSProviderReadiness();
      return { name: 'sms_provider', ok: result.ready, detail: result.detail, latencyMs: Date.now() - started };
    })(),
  ]);
  return { ready: checks.every(check => check.ok), version: APP_VERSION, region: process.env.VERCEL_REGION || 'local', checkedAt: new Date().toISOString(), checks };
}
