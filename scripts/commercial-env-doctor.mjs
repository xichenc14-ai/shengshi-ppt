#!/usr/bin/env node

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
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

function isPresent(key) {
  return Boolean(process.env[key]);
}

const reportLines = [];

function print(title, lines) {
  process.stdout.write(`\n${title}\n`);
  reportLines.push(`\n## ${title}`);
  for (const line of lines) process.stdout.write(`${line}\n`);
  for (const line of lines) reportLines.push(line);
}

function vercelCmd(key, placeholder) {
  return `- printf '%s' '${placeholder}' | vercel env add ${key} production`;
}

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..');

loadEnvFile(path.join(repoRoot, '.env.production.local'));
loadEnvFile(path.join(repoRoot, '.env.local'));

const core = [
  'NEXT_PUBLIC_SUPABASE_URL',
  'SUPABASE_SERVICE_ROLE_KEY',
  'SESSION_PASSWORD',
  'PAYMENT_NOTIFY_URL',
  'PAYMENT_NOTIFY_SECRET',
  'ALLOWED_CALLBACK_IPS',
];
const missingCore = core.filter((k) => !isPresent(k));
const notifyHttps = /^https:\/\//i.test(process.env.PAYMENT_NOTIFY_URL || '');
const providerReadiness = inspectEnabledPaymentProviders();
const providersReady = providerReadiness.every((item) => item.ready);
const supportedProviders = parseSupportedPaymentMethods();
const minimalTemplateKeys = [
  ...core,
  ...supportedProviders.map((provider) => provider === 'wechat' ? 'PAYMENT_WECHAT_URL_TEMPLATE' : 'PAYMENT_ALIPAY_URL_TEMPLATE'),
];
const missingMinimalTemplate = minimalTemplateKeys.filter((k) => !isPresent(k));

print('=== Commercial Env Doctor ===', [
  `Core ready: ${missingCore.length === 0 ? 'YES' : 'NO'}`,
  `Notify URL https: ${notifyHttps ? 'YES' : 'NO'}`,
  `Payment methods: ${supportedProviders.join(', ')}`,
  `Payment providers ready: ${providersReady ? 'YES' : 'NO'}`,
  ...providerReadiness.map((item) => `- ${item.provider}: ${item.ready ? item.mode : `missing ${item.missing.join(', ')}`}`),
]);

if (missingCore.length > 0) {
  print('Fix Core', missingCore.map((k) => `- export ${k}=<value>`));
  print('Fix Core (Vercel CLI)', missingCore.map((k) => vercelCmd(k, `<${k}>`)));
  print('Fix Core (.env.production.local snippet)', missingCore.map((k) => `${k}=`));
}
if (!notifyHttps) {
  print('Fix Notify URL', ['- PAYMENT_NOTIFY_URL must start with https://']);
}
for (const provider of providerReadiness.filter((item) => !item.ready)) {
  if (provider.provider === 'wechat') {
    print('Fix WeChat (choose one path)', [
      '- XunhuPay path: set XUNHU_PAY_APPID and XUNHU_PAY_SECRET',
      '- Template path: set PAYMENT_WECHAT_URL_TEMPLATE or PAYMENT_WECHAT_QRCODE_TEMPLATE',
      `- Missing candidates: ${provider.missing.join(', ')}`,
    ]);
    print('Fix WeChat (Vercel CLI examples)', [
      vercelCmd('XUNHU_PAY_APPID', '<XUNHU_PAY_APPID>'),
      vercelCmd('XUNHU_PAY_SECRET', '<XUNHU_PAY_SECRET>'),
      vercelCmd('PAYMENT_WECHAT_URL_TEMPLATE', 'https://pay.example.com/wx?order={orderNo}&amount={amountFen}'),
    ]);
  } else {
    print('Fix Alipay (choose one path)', [
      '- Template path: set PAYMENT_ALIPAY_URL_TEMPLATE or PAYMENT_ALIPAY_QRCODE_TEMPLATE',
      '- SDK path: set ALIPAY_APP_ID, ALIPAY_PRIVATE_KEY, ALIPAY_PUBLIC_KEY',
      `- Missing candidates: ${provider.missing.join(', ')}`,
    ]);
    print('Fix Alipay (Vercel CLI examples)', [
      vercelCmd('PAYMENT_ALIPAY_URL_TEMPLATE', 'https://pay.example.com/ali?order={orderNo}&amount={amountFen}'),
      ...provider.missing.map((k) => vercelCmd(k, `<${k}>`)),
    ]);
  }
}

if (!providersReady && missingMinimalTemplate.length > 0) {
  print('Minimal Go-Live Path (Template mode)', [
    '- Fastest production path: fill core + one template per enabled payment method',
    `- Missing for minimal path: ${missingMinimalTemplate.join(', ')}`,
  ]);
  print('Minimal Path (Vercel CLI)', missingMinimalTemplate.map((k) => {
    if (k === 'PAYMENT_WECHAT_URL_TEMPLATE') {
      return vercelCmd(k, 'https://pay.example.com/wx?order={orderNo}&amount={amountFen}');
    }
    if (k === 'PAYMENT_ALIPAY_URL_TEMPLATE') {
      return vercelCmd(k, 'https://pay.example.com/ali?order={orderNo}&amount={amountFen}');
    }
    return vercelCmd(k, `<${k}>`);
  }));
}

const ok = missingCore.length === 0 && notifyHttps && providersReady;
print('Next Commands', [
  '- npm run -s env:commercial',
  '- npm run -s preflight:commercial',
  '- npm run -s go-live:commercial',
]);

const verdict = ok ? 'READY' : 'NOT_READY';
process.stdout.write(`\nDoctor verdict: ${verdict}\n`);
reportLines.unshift(`# Commercial Env Doctor Report`, ``, `- Verdict: **${verdict}**`);

const now = new Date();
const pad = (n) => String(n).padStart(2, '0');
const ts = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
const outDir = path.join(repoRoot, 'docs/user');
mkdirSync(outDir, { recursive: true });
const latestPath = path.join(outDir, 'COMMERCIAL-ENV-DOCTOR-LATEST.md');
const archivePath = path.join(outDir, `COMMERCIAL-ENV-DOCTOR-${ts}.md`);
const reportBody = `${reportLines.join('\n')}\n`;
writeFileSync(latestPath, reportBody, 'utf8');
writeFileSync(archivePath, reportBody, 'utf8');
process.stdout.write(`Doctor report: ${path.relative(repoRoot, latestPath)}\n`);
process.stdout.write(`Doctor archive: ${path.relative(repoRoot, archivePath)}\n`);

process.exit(ok ? 0 : 1);
