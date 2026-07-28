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

function recentEnough(value, maxAgeDays) {
  const timestamp = new Date(String(value || '')).getTime();
  return Number.isFinite(timestamp) && Date.now() - timestamp <= maxAgeDays * 24 * 60 * 60 * 1000;
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
const downloadAccelerationEnabled = process.env.DOWNLOAD_ACCELERATION_ENABLED === 'true';
const downloadAccelerationConfigured = allPresent(r2Keys);
const artifactDeliveryReady = !downloadAccelerationEnabled || downloadAccelerationConfigured;
const providerReadiness = inspectEnabledPaymentProviders();
const providersReady = providerReadiness.every((item) => item.ready);
const cronSecret = process.env.CRON_SECRET || '';
const cronSecretStrong = cronSecret.length >= 24;
const alertWebhook = process.env.OPS_ALERT_WEBHOOK_URL || '';
const alertWebhookReady = /^https:\/\//i.test(alertWebhook);
const alertTelegramReady = Boolean(process.env.TELEGRAM_BOT_TOKEN && process.env.TELEGRAM_CHAT_ID);
const alertChannelReady = alertWebhookReady || alertTelegramReady;
const alertsRequired = process.env.OPS_ALERTS_REQUIRED === 'true';
const alertGateReady = !alertsRequired || alertChannelReady;
const backupGateRequired = process.env.BACKUP_READINESS_REQUIRED === 'true';
const backupVerified = recentEnough(process.env.SUPABASE_BACKUP_VERIFIED_AT, 30);
const recoveryDrillVerified = recentEnough(process.env.RECOVERY_DRILL_VERIFIED_AT, 90);
const backupGateReady = !backupGateRequired || (backupVerified && recoveryDrillVerified);
const commercialBaseUrl = process.env.COMMERCIAL_BASE_URL || '';
const commercialBaseUrlReady = /^https:\/\//i.test(commercialBaseUrl);

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
  'Download delivery configuration',
  artifactDeliveryReady,
  downloadAccelerationEnabled
    ? (downloadAccelerationConfigured ? 'R2 acceleration configured' : `missing: ${missing(r2Keys).join(', ')}`)
    : 'direct proxy delivery'
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
printRow('CRON_SECRET strength', cronSecretStrong, cronSecretStrong ? '' : `length: ${cronSecret.length}`);
printRow('Operational alert channel', alertGateReady, alertChannelReady ? (alertWebhookReady ? 'webhook' : 'telegram') : 'optional; structured platform logs remain enabled');
printRow('Alerting gate', true, alertsRequired ? 'required' : 'optional by product decision');
printRow('Backup / restore evidence', backupGateReady, backupGateRequired
  ? `backup=${backupVerified ? 'current' : 'missing'}, restore=${recoveryDrillVerified ? 'current' : 'missing'}`
  : 'optional for this release');
printRow('Commercial deployment URL', commercialBaseUrlReady, commercialBaseUrlReady ? commercialBaseUrl : 'must be an https URL');

const ok = coreReady
  && adminIdentityReady
  && adminSecretReady
  && notifyHttps
  && notifySecretStrong
  && callbackIpValid
  && artifactDeliveryReady
  && templateUrlsHttps
  && providersReady
  && cronSecretStrong
  && alertGateReady
  && backupGateReady
  && commercialBaseUrlReady;
process.stdout.write(`\nOverall: ${ok ? 'READY' : 'NOT_READY'}\n`);

process.exit(ok ? 0 : 1);
