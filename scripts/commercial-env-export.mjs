#!/usr/bin/env node
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

function loadEnvFile(filePath) {
  if (!existsSync(filePath)) return;
  const lines = readFileSync(filePath, 'utf8').split('\n');
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
const wechatSdk = ['WECHAT_PAY_MCH_ID', 'WECHAT_PAY_APP_ID', 'WECHAT_PAY_API_V3_KEY'];
const alipaySdk = ['ALIPAY_APP_ID', 'ALIPAY_PRIVATE_KEY', 'ALIPAY_PUBLIC_KEY'];
const wechatTemplate = ['PAYMENT_WECHAT_URL_TEMPLATE', 'PAYMENT_WECHAT_QRCODE_TEMPLATE'];
const alipayTemplate = ['PAYMENT_ALIPAY_URL_TEMPLATE', 'PAYMENT_ALIPAY_QRCODE_TEMPLATE'];

const present = (k) => Boolean(process.env[k]);
const missingCore = core.filter((k) => !present(k));
const missingWechatSdk = wechatSdk.filter((k) => !present(k));
const missingAlipaySdk = alipaySdk.filter((k) => !present(k));
const notifyHttps = /^https:\/\//i.test(process.env.PAYMENT_NOTIFY_URL || '');
const wechatReady = wechatTemplate.some(present) || wechatSdk.every(present);
const alipayReady = alipayTemplate.some(present) || alipaySdk.every(present);

const minimalTemplateKeys = [...core, 'PAYMENT_WECHAT_URL_TEMPLATE', 'PAYMENT_ALIPAY_URL_TEMPLATE'];
const missingMinimalTemplate = minimalTemplateKeys.filter((k) => !present(k));

const payload = {
  generatedAt: new Date().toISOString(),
  readiness: {
    coreReady: missingCore.length === 0,
    notifyHttps,
    wechatReady,
    alipayReady,
    overallReady: missingCore.length === 0 && notifyHttps && wechatReady && alipayReady,
  },
  missing: {
    core: missingCore,
    wechatSdk: missingWechatSdk,
    alipaySdk: missingAlipaySdk,
    minimalTemplatePath: missingMinimalTemplate,
  },
  suggestions: {
    nextCommands: [
      'npm run -s env:commercial:assert',
      'npm run -s env:commercial:doctor',
      'npm run -s release-gate:commercial',
    ],
  },
};

const envSnippet = [
  '# Auto-generated missing env snippet',
  ...missingCore.map((k) => `${k}=`),
  ...(missingMinimalTemplate.includes('PAYMENT_WECHAT_URL_TEMPLATE') ? ['PAYMENT_WECHAT_URL_TEMPLATE='] : []),
  ...(missingMinimalTemplate.includes('PAYMENT_ALIPAY_URL_TEMPLATE') ? ['PAYMENT_ALIPAY_URL_TEMPLATE='] : []),
  '',
].join('\n');

const outDir = path.join(repoRoot, 'docs/user');
mkdirSync(outDir, { recursive: true });
const now = new Date();
const pad = (n) => String(n).padStart(2, '0');
const ts = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;

const jsonLatest = path.join(outDir, 'COMMERCIAL-ENV-EXPORT-LATEST.json');
const jsonArchive = path.join(outDir, `COMMERCIAL-ENV-EXPORT-${ts}.json`);
const envLatest = path.join(outDir, 'COMMERCIAL-ENV-MISSING-LATEST.env');
const envArchive = path.join(outDir, `COMMERCIAL-ENV-MISSING-${ts}.env`);

writeFileSync(jsonLatest, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
writeFileSync(jsonArchive, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
writeFileSync(envLatest, envSnippet, 'utf8');
writeFileSync(envArchive, envSnippet, 'utf8');

process.stdout.write(`export json latest: ${path.relative(repoRoot, jsonLatest)}\n`);
process.stdout.write(`export json archive: ${path.relative(repoRoot, jsonArchive)}\n`);
process.stdout.write(`missing env latest: ${path.relative(repoRoot, envLatest)}\n`);
process.stdout.write(`missing env archive: ${path.relative(repoRoot, envArchive)}\n`);
process.stdout.write(`overall ready: ${payload.readiness.overallReady ? 'YES' : 'NO'}\n`);
process.exit(payload.readiness.overallReady ? 0 : 1);
