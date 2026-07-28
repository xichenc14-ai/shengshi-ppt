#!/usr/bin/env node

import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

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
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    process.env[key] = value;
  }
}

function fail(message) {
  process.stderr.write(`[restore-drill] FAIL: ${message}\n`);
  process.exit(1);
}

function normalizedOrigin(value, name) {
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:' && process.env.ALLOW_INSECURE_RECOVERY_TARGET !== 'true') {
      fail(`${name} must use https`);
    }
    return url.origin.replace(/\/$/, '');
  } catch {
    fail(`${name} is not a valid URL`);
  }
}

function parseCount(contentRange) {
  const match = String(contentRange || '').match(/\/(\d+|\*)$/);
  return match && match[1] !== '*' ? Number(match[1]) : null;
}

function parseMinimumCounts() {
  const raw = process.env.RECOVERY_EXPECTED_MIN_COUNTS || '{}';
  try {
    const parsed = JSON.parse(raw);
    if (!parsed || Array.isArray(parsed) || typeof parsed !== 'object') throw new Error('not an object');
    return Object.fromEntries(Object.entries(parsed).map(([table, count]) => {
      const numeric = Number(count);
      if (!Number.isInteger(numeric) || numeric < 0) throw new Error(`invalid count for ${table}`);
      return [table, numeric];
    }));
  } catch (error) {
    fail(`RECOVERY_EXPECTED_MIN_COUNTS must be a JSON object: ${error instanceof Error ? error.message : String(error)}`);
  }
}

loadEnvFile('.env.recovery.local');
loadEnvFile('.env.production.local');
loadEnvFile('.env.local');

if (process.env.RECOVERY_DRILL_CONFIRM_ISOLATED !== 'true') {
  fail('set RECOVERY_DRILL_CONFIRM_ISOLATED=true only after confirming the target is an isolated recovery project');
}

const targetOrigin = normalizedOrigin(process.env.RECOVERY_TEST_SUPABASE_URL || '', 'RECOVERY_TEST_SUPABASE_URL');
const productionOrigin = normalizedOrigin(process.env.NEXT_PUBLIC_SUPABASE_URL || '', 'NEXT_PUBLIC_SUPABASE_URL');
if (targetOrigin === productionOrigin) fail('recovery target must not be the production Supabase project');

const serviceKey = process.env.RECOVERY_TEST_SUPABASE_SERVICE_ROLE_KEY || '';
if (serviceKey.length < 20) fail('RECOVERY_TEST_SUPABASE_SERVICE_ROLE_KEY is missing or invalid');

const backupAt = new Date(process.env.RECOVERY_SOURCE_BACKUP_AT || '');
if (!Number.isFinite(backupAt.getTime())) fail('RECOVERY_SOURCE_BACKUP_AT must be a valid timestamp');
if (backupAt.getTime() > Date.now() + 5 * 60 * 1000) fail('RECOVERY_SOURCE_BACKUP_AT cannot be in the future');
if (Date.now() - backupAt.getTime() > 30 * 24 * 60 * 60 * 1000) fail('recovery source backup is older than 30 days');

const tables = {
  users: 'id,credits,plan_type,created_at',
  orders: 'id,order_no,user_id,amount,status,created_at',
  credit_transactions: 'id,user_id,amount,balance_after,created_at',
  verification_codes: 'id,phone,type,verified,expires_at,created_at',
  admin_audit_logs: 'id,action,target_type,created_at',
  admin_gamma_keys: 'id,label,status,created_at',
  refund_requests: 'id,order_no,amount,status,created_at',
  api_rate_limits: 'key_hash,request_count,expires_at',
  generation_requests: 'id,user_id,status,attempts,expires_at',
  temporary_attachment_leases: 'id,user_id,storage_path,expires_at,delete_after,created_at',
  generation_history: 'id,user_id,title,page_count,created_at',
  generation_artifacts: 'id,user_id,generation_id,format,status,created_at',
};
const minimumCounts = parseMinimumCounts();
for (const table of Object.keys(minimumCounts)) {
  if (!tables[table]) fail(`minimum count references unknown table: ${table}`);
}

const headers = {
  apikey: serviceKey,
  Authorization: `Bearer ${serviceKey}`,
  Prefer: 'count=exact',
};
const checks = [];

async function query(table, params) {
  const response = await fetch(`${targetOrigin}/rest/v1/${table}?${params}`, {
    headers,
    cache: 'no-store',
    signal: AbortSignal.timeout(10_000),
  });
  const body = await response.text();
  return { response, body };
}

for (const [table, columns] of Object.entries(tables)) {
  try {
    const { response, body } = await query(table, `select=${encodeURIComponent(columns)}&limit=1`);
    const count = parseCount(response.headers.get('content-range'));
    const minimum = minimumCounts[table];
    const countOk = minimum === undefined || (count !== null && count >= minimum);
    const ok = response.ok && countOk;
    checks.push({
      name: `table:${table}`,
      ok,
      count,
      minimum: minimum ?? null,
      detail: response.ok ? (countOk ? 'schema_and_count_ok' : 'below_expected_minimum') : `http_${response.status}:${body.slice(0, 160)}`,
    });
  } catch (error) {
    checks.push({ name: `table:${table}`, ok: false, count: null, minimum: minimumCounts[table] ?? null, detail: error instanceof Error ? error.message : String(error) });
  }
}

const invariants = [
  { name: 'users_non_negative_credits', table: 'users', filter: 'credits=lt.0' },
  { name: 'orders_non_negative_amount', table: 'orders', filter: 'amount=lt.0' },
  { name: 'refunds_non_negative_amount', table: 'refund_requests', filter: 'amount=lt.0' },
  { name: 'generation_attempts_positive', table: 'generation_requests', filter: 'attempts=lte.0' },
];
for (const invariant of invariants) {
  try {
    const { response, body } = await query(invariant.table, `select=id&${invariant.filter}&limit=1`);
    const rows = response.ok ? JSON.parse(body) : null;
    checks.push({
      name: `invariant:${invariant.name}`,
      ok: response.ok && Array.isArray(rows) && rows.length === 0,
      detail: response.ok ? (rows.length === 0 ? 'ok' : 'violated') : `http_${response.status}:${body.slice(0, 160)}`,
    });
  } catch (error) {
    checks.push({ name: `invariant:${invariant.name}`, ok: false, detail: error instanceof Error ? error.message : String(error) });
  }
}

const completedAt = new Date().toISOString();
const evidence = {
  schemaVersion: 1,
  completedAt,
  sourceBackupAt: backupAt.toISOString(),
  targetHost: new URL(targetOrigin).hostname,
  productionHost: new URL(productionOrigin).hostname,
  readOnlyVerification: true,
  passed: checks.every((check) => check.ok),
  checks,
};
const digest = createHash('sha256').update(JSON.stringify(evidence)).digest('hex');
const output = { ...evidence, sha256: digest };
const outputDir = path.resolve('artifacts/restore-drills');
mkdirSync(outputDir, { recursive: true });
const stamp = completedAt.replace(/[:.]/g, '-');
const outputPath = path.join(outputDir, `restore-drill-${stamp}.json`);
writeFileSync(outputPath, `${JSON.stringify(output, null, 2)}\n`, { mode: 0o600 });

if (!output.passed) {
  fail(`restored snapshot verification failed; evidence: ${outputPath}`);
}
process.stdout.write(`[restore-drill] PASS: isolated restored snapshot verified; evidence: ${outputPath}\n`);
process.stdout.write(`[restore-drill] Set RECOVERY_DRILL_VERIFIED_AT=${completedAt}\n`);
