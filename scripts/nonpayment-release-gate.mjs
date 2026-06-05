#!/usr/bin/env node

import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..');

function run(cmd, args) {
  const res = spawnSync(cmd, args, { encoding: 'utf8', shell: false, cwd: repoRoot });
  return {
    ok: (res.status ?? 1) === 0,
    out: `${res.stdout || ''}${res.stderr || ''}`.trim(),
  };
}

function runStep(name, cmd, args) {
  const r = run(cmd, args);
  return { name, ok: r.ok, tail: r.out.slice(-1000) };
}

const steps = [
  runStep('Unit tests', 'npm', ['run', '-s', 'test:run']),
  runStep('Production build', 'npm', ['run', '-s', 'build']),
  runStep('Mobile UI audit', 'npm', ['run', '-s', 'audit:mobile-ui']),
];

const paymentFlagClient = process.env.NEXT_PUBLIC_PAYMENT_FEATURE_ENABLED === 'true';
const paymentFlagServer = process.env.PAYMENT_FEATURE_ENABLED === 'true';
const paymentPaused = !paymentFlagClient && !paymentFlagServer;
steps.push({
  name: 'Payment paused mode',
  ok: paymentPaused,
  tail: paymentPaused
    ? 'PAYMENT_FEATURE_ENABLED=false and NEXT_PUBLIC_PAYMENT_FEATURE_ENABLED=false'
    : 'Set PAYMENT_FEATURE_ENABLED=false and NEXT_PUBLIC_PAYMENT_FEATURE_ENABLED=false for non-payment launch',
});

const allOk = steps.every((s) => s.ok);
const verdict = allOk ? 'PASS' : 'FAIL';
const now = new Date();
const pad = (n) => String(n).padStart(2, '0');
const ts = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;

const lines = [];
lines.push('# Non-Payment Release Gate');
lines.push('');
lines.push(`- Verdict: **${verdict}**`);
lines.push(`- Timestamp: ${now.toISOString()}`);
lines.push('');
lines.push('## Checks');
for (const s of steps) {
  lines.push(`- ${s.ok ? 'PASS' : 'FAIL'} ${s.name}`);
  if (!s.ok && s.tail) {
    lines.push('```text');
    lines.push(s.tail);
    lines.push('```');
  }
}

const outDir = path.join(repoRoot, 'docs/user');
mkdirSync(outDir, { recursive: true });
const latest = path.join(outDir, 'NONPAYMENT-RELEASE-GATE-LATEST.md');
const archive = path.join(outDir, `NONPAYMENT-RELEASE-GATE-${ts}.md`);
writeFileSync(latest, lines.join('\n') + '\n', 'utf8');
writeFileSync(archive, lines.join('\n') + '\n', 'utf8');

process.stdout.write(`nonpayment gate verdict: ${verdict}\n`);
process.stdout.write(`nonpayment gate latest: ${path.relative(repoRoot, latest)}\n`);
process.stdout.write(`nonpayment gate archive: ${path.relative(repoRoot, archive)}\n`);
process.exit(allOk ? 0 : 1);
