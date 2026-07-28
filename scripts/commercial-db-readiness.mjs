#!/usr/bin/env node

import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';

function loadEnvFile(path) {
  if (!existsSync(path)) return;
  for (const raw of readFileSync(path, 'utf8').split('\n')) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const idx = line.indexOf('=');
    if (idx <= 0) continue;
    const key = line.slice(0, idx).trim();
    if (!key || process.env[key]) continue;
    let value = line.slice(idx + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    process.env[key] = value;
  }
}

loadEnvFile('.env.production.local');
loadEnvFile('.env.local');

const url = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
if (!url || !serviceKey) {
  process.stderr.write('[db-readiness] missing Supabase production credentials\n');
  process.exit(1);
}

const keyHash = createHash('sha256')
  .update(`commercial-preflight:${Date.now()}:${Math.random()}`)
  .digest('hex');

async function callRpc(name, body) {
  const response = await fetch(`${url.replace(/\/$/, '')}/rest/v1/rpc/${name}`, {
    method: 'POST',
    headers: {
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(10_000),
  });
  const raw = await response.text();
  if (!response.ok) throw new Error(`${name} RPC ${response.status}: ${raw.slice(0, 300)}`);
  return JSON.parse(raw);
}

try {
  const data = await callRpc('consume_rate_limit', {
    p_key_hash: keyHash,
    p_window_seconds: 60,
    p_limit: 2,
  });
  const row = Array.isArray(data) ? data[0] : data;
  if (!row || row.allowed !== true || Number(row.remaining) !== 1 || !row.reset_at) {
    throw new Error('consume_rate_limit returned an invalid result');
  }
  const released = await callRpc('release_rate_limit', { p_key_hash: keyHash });
  if (released !== true) throw new Error('release_rate_limit returned an invalid result');
  process.stdout.write('[db-readiness] PASS: consume/release rate-limit RPCs are operational\n');
} catch (error) {
  process.stderr.write(`[db-readiness] FAIL: ${error instanceof Error ? error.message : String(error)}\n`);
  process.exit(1);
}
