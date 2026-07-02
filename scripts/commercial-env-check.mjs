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

const wechatTemplate = [
  'PAYMENT_WECHAT_URL_TEMPLATE',
  'PAYMENT_WECHAT_QRCODE_TEMPLATE',
  'WECHAT_PAY_URL_TEMPLATE',
  'WECHAT_QRCODE_URL_TEMPLATE',
];

const alipayTemplate = [
  'PAYMENT_ALIPAY_URL_TEMPLATE',
  'PAYMENT_ALIPAY_QRCODE_TEMPLATE',
  'ALIPAY_PAY_URL_TEMPLATE',
  'ALIPAY_QRCODE_URL_TEMPLATE',
];

const wechatSdk = ['WECHAT_PAY_MCH_ID', 'WECHAT_PAY_APP_ID', 'WECHAT_PAY_API_V3_KEY'];
const alipaySdk = ['ALIPAY_APP_ID', 'ALIPAY_PRIVATE_KEY', 'ALIPAY_PUBLIC_KEY'];

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
const wxTemplateUrl = process.env.PAYMENT_WECHAT_URL_TEMPLATE || process.env.WECHAT_PAY_URL_TEMPLATE || '';
const aliTemplateUrl = process.env.PAYMENT_ALIPAY_URL_TEMPLATE || process.env.ALIPAY_PAY_URL_TEMPLATE || '';
const wxTemplateHttps = !wxTemplateUrl || /^https:\/\//i.test(wxTemplateUrl);
const aliTemplateHttps = !aliTemplateUrl || /^https:\/\//i.test(aliTemplateUrl);

const wechatReady = hasAny(wechatTemplate) || allPresent(wechatSdk);
const alipayReady = hasAny(alipayTemplate) || allPresent(alipaySdk);

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
printRow('WeChat template URL is https', wxTemplateHttps, wxTemplateHttps ? '' : `value: ${wxTemplateUrl}`);
printRow('Alipay template URL is https', aliTemplateHttps, aliTemplateHttps ? '' : `value: ${aliTemplateUrl}`);
printRow('WeChat provider ready', wechatReady, wechatReady ? '' : `missing sdk: ${missing(wechatSdk).join(', ')}`);
printRow('Alipay provider ready', alipayReady, alipayReady ? '' : `missing sdk: ${missing(alipaySdk).join(', ')}`);
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
  && wxTemplateHttps
  && aliTemplateHttps
  && wechatReady
  && alipayReady;
process.stdout.write(`\nOverall: ${ok ? 'READY' : 'NOT_READY'}\n`);

process.exit(ok ? 0 : 1);
