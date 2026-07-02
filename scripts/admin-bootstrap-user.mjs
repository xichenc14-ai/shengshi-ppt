#!/usr/bin/env node

import { existsSync, readFileSync } from 'node:fs';
import { randomBytes, scryptSync } from 'node:crypto';
import { spawnSync } from 'node:child_process';

function loadEnvFile(path) {
  if (!existsSync(path)) return;
  const lines = readFileSync(path, 'utf8').split('\n');
  for (const raw of lines) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const idx = line.indexOf('=');
    if (idx <= 0) continue;
    const key = line.slice(0, idx).trim();
    if (process.env[key]) continue;
    let val = line.slice(idx + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    process.env[key] = val;
  }
}

function sqlString(value) {
  return `'${String(value).replace(/'/g, "''")}'`;
}

function hashPasswordSecure(password) {
  const n = 16384;
  const r = 8;
  const p = 1;
  const salt = randomBytes(16).toString('hex');
  const derived = scryptSync(password, salt, 64, { N: n, r, p }).toString('hex');
  return `scrypt$${n}$${r}$${p}$${salt}$${derived}`;
}

loadEnvFile('.env.production.local');
loadEnvFile('.env.local');

const phone = process.env.ADMIN_BOOTSTRAP_PHONE || '';
const password = process.env.ADMIN_BOOTSTRAP_PASSWORD || '';
const dbUrl = process.env.DATABASE_URL || '';

if (!/^1[3-9]\d{9}$/.test(phone)) {
  console.error('ADMIN_BOOTSTRAP_PHONE must be a valid mainland China mobile number.');
  process.exit(1);
}
if (password.length < 8 || !/[A-Za-z]/.test(password) || !/\d/.test(password)) {
  console.error('ADMIN_BOOTSTRAP_PASSWORD must be at least 8 chars and contain letters and numbers.');
  process.exit(1);
}
if (!dbUrl) {
  console.error('DATABASE_URL is required.');
  process.exit(1);
}

const passwordHash = hashPasswordSecure(password);
const now = new Date().toISOString();
const sql = `
WITH updated AS (
  UPDATE users
  SET
    password_hash = ${sqlString(passwordHash)},
    plan_type = CASE WHEN plan_type IN ('advanced','standard','pro','vip','supreme') THEN plan_type ELSE 'pro' END,
    is_active = true,
    last_login_at = ${sqlString(now)}
  WHERE phone = ${sqlString(phone)}
  RETURNING id
)
INSERT INTO users (id, phone, nickname, credits, plan_type, password_hash, is_active, created_at, last_login_at)
SELECT gen_random_uuid(), ${sqlString(phone)}, '管理员', 0, 'pro', ${sqlString(passwordHash)}, true, ${sqlString(now)}, ${sqlString(now)}
WHERE NOT EXISTS (SELECT 1 FROM updated);
`;

const result = spawnSync('supabase', ['db', 'query', sql, '--db-url', dbUrl, '-o', 'table'], {
  stdio: 'inherit',
});

if ((result.status ?? 1) !== 0) {
  process.exit(result.status ?? 1);
}

console.log(`Admin bootstrap complete for phone ${phone.slice(0, 3)}****${phone.slice(-4)}.`);
