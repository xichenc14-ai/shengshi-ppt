#!/usr/bin/env node
import { existsSync, readFileSync } from 'node:fs';

function loadEnvFile(path) {
  if (!existsSync(path)) return;
  const lines = readFileSync(path, 'utf8').split('\n');
  for (const raw of lines) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const idx = line.indexOf('=');
    if (idx <= 0) continue;
    const key = line.slice(0, idx).trim();
    if (!key || process.env[key]) continue;
    let val = line.slice(idx + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    process.env[key] = val;
  }
}

function normalizeProvider(value) {
  return String(value || 'aliyun_auth').replace(/^['"]|['"]$/g, '');
}

function maskPresent(value) {
  return value ? `set (${String(value).length} chars)` : 'missing';
}

loadEnvFile('.env.production.local');
loadEnvFile('.env.local');

const provider = normalizeProvider(process.env.SMS_PROVIDER);
const allowedProviders = new Set(['aliyun_auth', 'luosimao', 'tencent']);
const failures = [];

if (!allowedProviders.has(provider)) {
  failures.push(`SMS_PROVIDER 非法: ${provider || '(empty)'}`);
}

if (provider === 'aliyun_auth') {
  const required = [
    'ALIYUN_ACCESS_KEY_ID',
    'ALIYUN_ACCESS_KEY_SECRET',
    'ALIYUN_SMS_SIGN_NAME',
    'ALIYUN_SMS_TEMPLATE_CODE',
  ];
  for (const key of required) {
    if (!process.env[key]) failures.push(`缺失 ${key}`);
  }
  const templateCode = String(process.env.ALIYUN_SMS_TEMPLATE_CODE || '');
  if (templateCode && !/^\d+$/.test(templateCode)) {
    failures.push('ALIYUN_SMS_TEMPLATE_CODE 应为数字模板号');
  }
}

process.stdout.write('\n=== SMS Environment Check ===\n');
process.stdout.write(`SMS_PROVIDER: ${provider}\n`);
process.stdout.write(`ALIYUN_ACCESS_KEY_ID: ${maskPresent(process.env.ALIYUN_ACCESS_KEY_ID)}\n`);
process.stdout.write(`ALIYUN_ACCESS_KEY_SECRET: ${maskPresent(process.env.ALIYUN_ACCESS_KEY_SECRET)}\n`);
process.stdout.write(`ALIYUN_SMS_SIGN_NAME: ${process.env.ALIYUN_SMS_SIGN_NAME || '(missing)'}\n`);
process.stdout.write(`ALIYUN_SMS_TEMPLATE_CODE: ${process.env.ALIYUN_SMS_TEMPLATE_CODE || '(missing)'}\n`);

if (failures.length > 0) {
  for (const failure of failures) process.stderr.write(`FAIL ${failure}\n`);
  process.exit(1);
}

process.stdout.write('PASS SMS provider configuration is ready\n');
