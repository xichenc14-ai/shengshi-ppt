#!/usr/bin/env node

import { existsSync, readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import {
  inspectEnabledPaymentProviders,
  parseSupportedPaymentMethods,
} from './commercial-payment-readiness.mjs';

const requiredEnv = [
  'NEXT_PUBLIC_SUPABASE_URL',
  'SUPABASE_SERVICE_ROLE_KEY',
  'PAYMENT_NOTIFY_URL',
];

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

const providerReadiness = inspectEnabledPaymentProviders();
const notReadyProviders = providerReadiness.filter((item) => !item.ready);
if (notReadyProviders.length > 0) {
  fail(`支付渠道未就绪：${notReadyProviders.map((item) => `${item.provider} missing [${item.missing.join(', ')}]`).join('; ')}`);
}
ok(`支付提供方配置就绪：${parseSupportedPaymentMethods().join(', ')}`);

const nextConfig = readFileSync('next.config.ts', 'utf8');
if (/ignoreBuildErrors\s*:\s*true/.test(nextConfig)) {
  fail('next.config.ts 中 ignoreBuildErrors 仍为 true');
}
ok('TypeScript 构建阻断已开启');

const p0BaselinePath = 'supabase-migrations/00-commercial-base-schema.sql';
if (!existsSync(p0BaselinePath)) fail(`缺少 P0 数据库基线 ${p0BaselinePath}`);
const p0Baseline = readFileSync(p0BaselinePath, 'utf8');
if (!/consume_rate_limit/i.test(p0Baseline) || !/release_rate_limit/i.test(p0Baseline) || !/api_rate_limits/i.test(p0Baseline)) {
  fail('P0 数据库基线缺少跨实例限流表或 RPC');
}
ok('P0 数据库基线与跨实例限流 RPC 已纳入发布包');

const rateLimitSource = readFileSync('src/lib/rate-limit.ts', 'utf8');
if (!/source:\s*'fail-closed'/.test(rateLimitSource) || !/consume_rate_limit/.test(rateLimitSource) || !/release_rate_limit/.test(rateLimitSource)) {
  fail('生产跨实例限流未启用 fail-closed');
}
ok('生产跨实例限流 fail-closed 已启用');

const legacyExportSource = readFileSync('src/app/api/export/route.ts', 'utf8');
if (/fetch\(externalUrl/.test(legacyExportSource)) fail('旧导出接口仍允许抓取任意外部 URL');
ok('旧导出 SSRF 入口已关闭');

const pptxExportSource = readFileSync('src/app/api/export-pptx/route.ts', 'utf8');
if (!/isArtifactAccelerationEnabled/.test(pptxExportSource) || !/putArtifactObject/.test(pptxExportSource)) {
  fail('既有 PPTX 下载加速与回退逻辑被意外改变');
}
const historySource = readFileSync('src/app/api/history/route.ts', 'utf8');
if (!/generation_history/.test(historySource) || !/action === 'save'/.test(historySource)) {
  fail('既有生成历史业务链路被意外改变');
}
ok('既有下载加速、代理回退与生成历史业务逻辑保持完整');

if (!runStep('distributed database limiter', 'npm', ['run', '-s', 'db:commercial:check'])) {
  fail('生产数据库跨实例限流 RPC 未就绪');
}
if (!runStep('commercial recovery readiness', 'npm', ['run', '-s', 'ops:recovery:check'])) {
  fail('商业核心数据恢复前置条件未就绪');
}

if (!runStep('lint', 'npm', ['run', '-s', 'lint'])) fail('lint 未通过');
if (!runStep('test and coverage gate', 'npm', ['run', '-s', 'test:coverage'])) fail('测试或覆盖率门禁未通过');
if (!runStep('build', 'npm', ['run', '-s', 'build'])) fail('build 未通过');

process.stdout.write('\n[preflight] PASS: 商业化发布前体检通过。\n');
