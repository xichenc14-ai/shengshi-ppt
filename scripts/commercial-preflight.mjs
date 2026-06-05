#!/usr/bin/env node

import { existsSync, readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';

const requiredEnv = [
  'NEXT_PUBLIC_SUPABASE_URL',
  'SUPABASE_SERVICE_ROLE_KEY',
  'PAYMENT_NOTIFY_URL',
];

const wechatEnvFallback = ['WECHAT_PAY_MCH_ID', 'WECHAT_PAY_APP_ID', 'WECHAT_PAY_API_V3_KEY'];
const alipayEnvFallback = ['ALIPAY_APP_ID', 'ALIPAY_PRIVATE_KEY', 'ALIPAY_PUBLIC_KEY'];

const templateEnv = {
  wechat: ['PAYMENT_WECHAT_URL_TEMPLATE', 'PAYMENT_WECHAT_QRCODE_TEMPLATE', 'WECHAT_PAY_URL_TEMPLATE', 'WECHAT_QRCODE_URL_TEMPLATE'],
  alipay: ['PAYMENT_ALIPAY_URL_TEMPLATE', 'PAYMENT_ALIPAY_QRCODE_TEMPLATE', 'ALIPAY_PAY_URL_TEMPLATE', 'ALIPAY_QRCODE_URL_TEMPLATE'],
};

function hasAnyEnv(keys) {
  return keys.some((k) => Boolean(process.env[k]));
}

function missingEnv(keys) {
  return keys.filter((k) => !process.env[k]);
}

function runStep(name, cmd, args) {
  process.stdout.write(`\n[preflight] ${name}...\n`);
  const result = spawnSync(cmd, args, { stdio: 'inherit', shell: false });
  return result.status === 0;
}

function fail(msg) {
  process.stderr.write(`\n[preflight] FAIL: ${msg}\n`);
  process.exit(1);
}

function ok(msg) {
  process.stdout.write(`[preflight] OK: ${msg}\n`);
}

function loadEnvFile(path) {
  if (!existsSync(path)) return;
  const lines = readFileSync(path, 'utf8').split('\n');
  for (const rawLine of lines) {
    const line = rawLine.trim();
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

for (const key of requiredEnv) {
  if (!process.env[key]) fail(`缺少环境变量 ${key}`);
}
ok('基础环境变量完整');

if (!/^https:\/\//i.test(process.env.PAYMENT_NOTIFY_URL || '')) {
  fail('PAYMENT_NOTIFY_URL 必须是 https 地址');
}
ok('PAYMENT_NOTIFY_URL 为 https');

const wechatReady = hasAnyEnv(templateEnv.wechat) || missingEnv(wechatEnvFallback).length === 0;
const alipayReady = hasAnyEnv(templateEnv.alipay) || missingEnv(alipayEnvFallback).length === 0;

if (!wechatReady) {
  fail(`微信支付未就绪：模板变量为空且 SDK 环境缺失 [${missingEnv(wechatEnvFallback).join(', ')}]`);
}
if (!alipayReady) {
  fail(`支付宝支付未就绪：模板变量为空且 SDK 环境缺失 [${missingEnv(alipayEnvFallback).join(', ')}]`);
}
ok('支付提供方配置就绪');

const nextConfig = readFileSync('next.config.ts', 'utf8');
if (/ignoreBuildErrors\s*:\s*true/.test(nextConfig)) {
  fail('next.config.ts 中 ignoreBuildErrors 仍为 true');
}
ok('TypeScript 构建阻断已开启');

if (!runStep('lint', 'npm', ['run', '-s', 'lint'])) fail('lint 未通过');
if (!runStep('test', 'npm', ['run', '-s', 'test:run'])) fail('test 未通过');
if (!runStep('build', 'npm', ['run', '-s', 'build'])) fail('build 未通过');

process.stdout.write('\n[preflight] PASS: 商业化发布前体检通过。\n');
