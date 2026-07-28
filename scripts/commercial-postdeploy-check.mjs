#!/usr/bin/env node

import { existsSync, readFileSync } from 'node:fs';

function loadEnvFile(file) {
  if (!existsSync(file)) return;
  for (const raw of readFileSync(file, 'utf8').split('\n')) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const separator = line.indexOf('=');
    if (separator <= 0) continue;
    const key = line.slice(0, separator).trim();
    if (!key || process.env[key]) continue;
    let value = line.slice(separator + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) value = value.slice(1, -1);
    process.env[key] = value;
  }
}

function fail(message) {
  process.stderr.write(`[postdeploy] FAIL: ${message}\n`);
  process.exit(1);
}

loadEnvFile('.env.production.local');
loadEnvFile('.env.local');

let origin;
try {
  const url = new URL(process.env.COMMERCIAL_BASE_URL || '');
  if (url.protocol !== 'https:' && process.env.ALLOW_INSECURE_POSTDEPLOY !== 'true') fail('COMMERCIAL_BASE_URL must use https');
  origin = url.origin;
} catch {
  fail('COMMERCIAL_BASE_URL must be a valid deployment URL');
}

const cronSecret = process.env.CRON_SECRET || '';
if (cronSecret.length < 24) fail('CRON_SECRET must be configured and at least 24 characters');

async function requestJson(path, options = {}) {
  const startedAt = Date.now();
  const response = await fetch(`${origin}${path}`, {
    ...options,
    cache: 'no-store',
    signal: AbortSignal.timeout(15_000),
  });
  const requestId = response.headers.get('x-request-id');
  const body = await response.json().catch(() => null);
  return { response, requestId, body, latencyMs: Date.now() - startedAt };
}

const liveness = await requestJson('/api/health');
if (!liveness.response.ok) fail(`liveness returned HTTP ${liveness.response.status}`);
if (!liveness.requestId) fail('liveness response is missing x-request-id');
process.stdout.write(`[postdeploy] PASS liveness (${liveness.latencyMs}ms, requestId=${liveness.requestId})\n`);

const readiness = await requestJson('/api/health/readiness');
if (!readiness.response.ok || readiness.body?.status !== 'ready') {
  const failed = readiness.body?.checks?.filter((check) => !check.ok).map((check) => check.name).join(',') || 'unknown';
  fail(`readiness returned HTTP ${readiness.response.status}; failed checks: ${failed}`);
}
if (!readiness.requestId) fail('readiness response is missing x-request-id');
process.stdout.write(`[postdeploy] PASS readiness (${readiness.latencyMs}ms, requestId=${readiness.requestId})\n`);

const authorization = { authorization: `Bearer ${cronSecret}` };
const scheduled = await requestJson('/api/cron/operational-check', { headers: authorization });
if (!scheduled.response.ok || scheduled.body?.ok !== true) {
  fail(`operational cron returned HTTP ${scheduled.response.status}`);
}
process.stdout.write(`[postdeploy] PASS operational cron (${scheduled.latencyMs}ms, requestId=${scheduled.requestId})\n`);

const alertConfigured = /^https:\/\//i.test(process.env.OPS_ALERT_WEBHOOK_URL || '')
  || Boolean(process.env.TELEGRAM_BOT_TOKEN && process.env.TELEGRAM_CHAT_ID);
const alertRequired = process.env.OPS_ALERTS_REQUIRED === 'true';
if (alertConfigured || alertRequired) {
  const alert = await requestJson('/api/cron/operational-check', { method: 'POST', headers: authorization });
  if (!alert.response.ok || alert.body?.delivery?.sent !== true) {
    fail(`alert delivery test failed: ${alert.body?.delivery?.reason || `HTTP ${alert.response.status}`}`);
  }
  process.stdout.write(`[postdeploy] PASS alert delivery (${alert.latencyMs}ms, requestId=${alert.requestId})\n`);
} else {
  process.stdout.write('[postdeploy] SKIP alert delivery (optional and not configured)\n');
}
process.stdout.write('[postdeploy] PASS: deployed liveness, dependency readiness, and cron authentication verified\n');
