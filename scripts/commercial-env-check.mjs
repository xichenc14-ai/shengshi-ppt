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

function hasAny(keys) {
  return keys.some((k) => Boolean(process.env[k]));
}

function allPresent(keys) {
  return keys.every((k) => Boolean(process.env[k]));
}

function missing(keys) {
  return keys.filter((k) => !process.env[k]);
}

function printRow(label, ok, detail = '') {
  const mark = ok ? 'PASS' : 'FAIL';
  const suffix = detail ? ` - ${detail}` : '';
  process.stdout.write(`${mark.padEnd(5)} ${label}${suffix}\n`);
}

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

loadEnvFile('.env.production.local');
loadEnvFile('.env.local');

const coreRequired = [
  'NEXT_PUBLIC_SUPABASE_URL',
  'SUPABASE_SERVICE_ROLE_KEY',
  'SESSION_PASSWORD',
  'PAYMENT_NOTIFY_URL',
  'PAYMENT_NOTIFY_SECRET',
  'ALLOWED_CALLBACK_IPS',
];

const adminRequiredAny = ['ADMIN_USER_PHONES', 'ADMIN_USER_IDS'];
const adminRequired = ['ADMIN_SECRET_ENCRYPTION_KEY'];

const coreReady = allPresent(coreRequired);
const adminIdentityReady = hasAny(adminRequiredAny);
const adminSecretReady = allPresent(adminRequired);
const notifyUrl = process.env.PAYMENT_NOTIFY_URL || '';
const notifyHttps = /^https:\/\//i.test(notifyUrl);
const notifySecret = process.env.PAYMENT_NOTIFY_SECRET || '';
const notifySecretStrong = notifySecret.length >= 24;
const callbackIpTokens = parseCsv(process.env.ALLOWED_CALLBACK_IPS || '');
const callbackIpConfigured = callbackIpTokens.length > 0;
const callbackIpValid = callbackIpConfigured && callbackIpTokens.every((token) => isValidIpToken(token));
const invalidCallbackIpTokens = callbackIpTokens.filter((token) => !isValidIpToken(token));
const templateUrlProblems = getTemplateUrlProblems();
const templateUrlsHttps = templateUrlProblems.length === 0;
const r2Keys = ['R2_ACCOUNT_ID', 'R2_ACCESS_KEY_ID', 'R2_SECRET_ACCESS_KEY', 'R2_BUCKET'];
const downloadAccelerationConfigured = allPresent(r2Keys);
const downloadAccelerationDisabled = process.env.DOWNLOAD_ACCELERATION_ENABLED === 'false';
const providerReadiness = inspectEnabledPaymentProviders();
const providersReady = providerReadiness.every((item) => item.ready);

process.stdout.write('\n=== Commercial Environment Readiness ===\n');
printRow('Core variables', coreReady, coreReady ? '' : `missing: ${missing(coreRequired).join(', ')}`);
printRow('Admin identity allowlist', adminIdentityReady, adminIdentityReady ? '' : `missing one of: ${adminRequiredAny.join(', ')}`);
printRow('Admin Gamma Key encryption', adminSecretReady, adminSecretReady ? '' : `missing: ${missing(adminRequired).join(', ')}`);
printRow('PAYMENT_NOTIFY_URL is https', notifyHttps, notifyHttps ? '' : `value: ${notifyUrl || '(empty)'}`);
printRow('PAYMENT_NOTIFY_SECRET strength', notifySecretStrong, notifySecretStrong ? '' : `length: ${notifySecret.length}`);
printRow(
  'ALLOWED_CALLBACK_IPS format',
  callbackIpValid,
  callbackIpValid
    ? `${callbackIpTokens.length} entries`
    : (callbackIpConfigured ? `invalid: ${invalidCallbackIpTokens.join(', ')}` : 'value: (empty)')
);
printRow(
  'Payment template URLs are https',
  templateUrlsHttps,
  templateUrlsHttps ? '' : `invalid: ${templateUrlProblems.map((p) => p.key).join(', ')}`
);
printRow(
  'R2 download acceleration',
  true,
  downloadAccelerationConfigured
    ? 'configured'
    : (downloadAccelerationDisabled ? 'disabled' : `optional; missing: ${missing(r2Keys).join(', ')}`)
);
printRow(
  `Payment providers ready (${parseSupportedPaymentMethods().join(', ')})`,
  providersReady,
  providerReadiness.map((item) => `${item.provider}:${item.ready ? item.mode : `missing ${item.missing.join(', ')}`}`).join('; ')
);
printRow(
  'Automatic refund switch',
  true,
  process.env.PAYMENT_AUTO_REFUND_ENABLED === 'true'
    ? 'enabled; verify provider refund parameters before production traffic'
    : 'disabled; refunds enter manual_required/refund_pending workflow'
);

const ok = coreReady
  && adminIdentityReady
  && adminSecretReady
  && notifyHttps
  && notifySecretStrong
  && callbackIpValid
  && templateUrlsHttps
  && providersReady;
process.stdout.write(`\nOverall: ${ok ? 'READY' : 'NOT_READY'}\n`);

process.exit(ok ? 0 : 1);
