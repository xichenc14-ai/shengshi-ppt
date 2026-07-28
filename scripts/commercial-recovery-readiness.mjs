#!/usr/bin/env node

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
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) value = value.slice(1, -1);
    process.env[key] = value;
  }
}

function recentEnough(raw, maxAgeDays) {
  const time = new Date(String(raw || '')).getTime();
  return Number.isFinite(time) && Date.now() - time <= maxAgeDays * 24 * 60 * 60 * 1000;
}

loadEnvFile('.env.production.local');
loadEnvFile('.env.local');

const url = (process.env.NEXT_PUBLIC_SUPABASE_URL || '').replace(/\/$/, '');
const key = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
if (!url || !key) {
  process.stderr.write('[recovery-readiness] missing Supabase credentials\n');
  process.exit(1);
}

const headers = { apikey: key, Authorization: `Bearer ${key}` };
const requiredTables = [
  'users', 'orders', 'credit_transactions', 'verification_codes',
  'admin_audit_logs', 'admin_gamma_keys', 'refund_requests',
  'api_rate_limits', 'generation_requests',
  'temporary_attachment_leases',
  'generation_history', 'generation_artifacts',
];

const failed = [];
for (const table of requiredTables) {
  try {
    const response = await fetch(`${url}/rest/v1/${table}?select=*&limit=0`, {
      method: 'GET', headers, signal: AbortSignal.timeout(8_000), cache: 'no-store',
    });
    if (!response.ok) failed.push(`${table}:http_${response.status}`);
    else await response.arrayBuffer();
  } catch (error) {
    failed.push(`${table}:${error instanceof Error ? error.message : String(error)}`);
  }
}

if (process.env.BACKUP_READINESS_REQUIRED === 'true') {
  if (!recentEnough(process.env.SUPABASE_BACKUP_VERIFIED_AT, 30)) failed.push('supabase_backup_verification_stale');
  if (!recentEnough(process.env.RECOVERY_DRILL_VERIFIED_AT, 90)) failed.push('recovery_drill_verification_stale');
}

if (failed.length > 0) {
  process.stderr.write(`[recovery-readiness] FAIL: ${failed.join(', ')}\n`);
  process.exit(1);
}

process.stdout.write(`[recovery-readiness] PASS: ${requiredTables.length} critical tables reachable\n`);
