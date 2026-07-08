#!/usr/bin/env node
import { existsSync, readFileSync } from 'node:fs';
import {
  getTemplateUrlProblems,
  inspectEnabledPaymentProviders,
  parseSupportedPaymentMethods,
} from './commercial-payment-readiness.mjs';

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

loadEnvFile('.env.production.local');
loadEnvFile('.env.local');

function parseCsv(value) {
  return String(value || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

function isValidIpToken(token) {
  if (token === 'localhost') return true;
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(token)) {
    return token.split('.').every((part) => {
      const n = Number(part);
      return Number.isInteger(n) && n >= 0 && n <= 255;
    });
  }
  if (/^\d{1,3}(\.\d{1,3}){3}\/\d{1,2}$/.test(token)) {
    const [ip, maskRaw] = token.split('/');
    const mask = Number(maskRaw);
    if (!Number.isInteger(mask) || mask < 0 || mask > 32) return false;
    return ip.split('.').every((part) => {
      const n = Number(part);
      return Number.isInteger(n) && n >= 0 && n <= 255;
    });
  }
  return false;
}

const required = [
  'NEXT_PUBLIC_SUPABASE_URL',
  'SUPABASE_SERVICE_ROLE_KEY',
  'SESSION_PASSWORD',
  'PAYMENT_NOTIFY_URL',
  'PAYMENT_NOTIFY_SECRET',
  'ALLOWED_CALLBACK_IPS',
];

const missing = required.filter((k) => !process.env[k]);
if (missing.length > 0) {
  console.error('[ASSERT] 缺失必填变量:', missing.join(', '));
  process.exit(1);
}

if (!/^https:\/\//i.test(process.env.PAYMENT_NOTIFY_URL || '')) {
  console.error('[ASSERT] PAYMENT_NOTIFY_URL 必须为 https');
  process.exit(1);
}

const notifySecret = process.env.PAYMENT_NOTIFY_SECRET || '';
if (notifySecret.length < 24) {
  console.error('[ASSERT] PAYMENT_NOTIFY_SECRET 长度至少 24 位');
  process.exit(1);
}

const callbackIpTokens = parseCsv(process.env.ALLOWED_CALLBACK_IPS || '');
if (callbackIpTokens.length === 0) {
  console.error('[ASSERT] ALLOWED_CALLBACK_IPS 不能为空');
  process.exit(1);
}
const invalidIpTokens = callbackIpTokens.filter((token) => !isValidIpToken(token));
if (invalidIpTokens.length > 0) {
  console.error('[ASSERT] ALLOWED_CALLBACK_IPS 包含非法条目:', invalidIpTokens.join(', '));
  process.exit(1);
}

const templateUrlProblems = getTemplateUrlProblems();
if (templateUrlProblems.length > 0) {
  console.error('[ASSERT] 支付模板 URL 必须为 https:', templateUrlProblems.map((p) => p.key).join(', '));
  process.exit(1);
}

const providerReadiness = inspectEnabledPaymentProviders();
const notReady = providerReadiness.filter((item) => !item.ready);
if (notReady.length > 0) {
  console.error('[ASSERT] 已启用支付渠道未就绪:', notReady.map((item) => `${item.provider} missing ${item.missing.join(', ')}`).join('; '));
  process.exit(1);
}

console.log(`[ASSERT] 最小上线路径变量已就绪；支付渠道: ${parseSupportedPaymentMethods().join(', ')}`);
