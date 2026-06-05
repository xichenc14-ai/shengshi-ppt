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

loadEnvFile('.env.production.local');
loadEnvFile('.env.local');

const coreRequired = [
  'NEXT_PUBLIC_SUPABASE_URL',
  'SUPABASE_SERVICE_ROLE_KEY',
  'SESSION_PASSWORD',
  'PAYMENT_NOTIFY_URL',
];

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
const notifyUrl = process.env.PAYMENT_NOTIFY_URL || '';
const notifyHttps = /^https:\/\//i.test(notifyUrl);

const wechatReady = hasAny(wechatTemplate) || allPresent(wechatSdk);
const alipayReady = hasAny(alipayTemplate) || allPresent(alipaySdk);

process.stdout.write('\n=== Commercial Environment Readiness ===\n');
printRow('Core variables', coreReady, coreReady ? '' : `missing: ${missing(coreRequired).join(', ')}`);
printRow('PAYMENT_NOTIFY_URL is https', notifyHttps, notifyHttps ? '' : `value: ${notifyUrl || '(empty)'}`);
printRow('WeChat provider ready', wechatReady, wechatReady ? '' : `missing sdk: ${missing(wechatSdk).join(', ')}`);
printRow('Alipay provider ready', alipayReady, alipayReady ? '' : `missing sdk: ${missing(alipaySdk).join(', ')}`);

const ok = coreReady && notifyHttps && wechatReady && alipayReady;
process.stdout.write(`\nOverall: ${ok ? 'READY' : 'NOT_READY'}\n`);

process.exit(ok ? 0 : 1);
