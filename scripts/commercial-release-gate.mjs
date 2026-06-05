#!/usr/bin/env node
import { mkdirSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const steps = [
  { name: 'Assert minimal env', cmd: 'npm', args: ['run', '-s', 'env:commercial:assert'] },
  { name: 'Doctor env', cmd: 'npm', args: ['run', '-s', 'env:commercial:doctor'] },
  { name: 'Environment readiness', cmd: 'npm', args: ['run', '-s', 'env:commercial'] },
  { name: 'Preflight commercial', cmd: 'npm', args: ['run', '-s', 'preflight:commercial'] },
  { name: 'Audit commercial', cmd: 'npm', args: ['run', '-s', 'audit:commercial'] },
  { name: 'Go-live commercial', cmd: 'npm', args: ['run', '-s', 'go-live:commercial'] },
];

const logs = [];
const now = new Date();
const pad = (n) => String(n).padStart(2, '0');
const ts = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..');

function saveReport(verdict, failedStep = '', failedOutput = '') {
  const lines = [];
  lines.push('# Commercial Release Gate Report');
  lines.push('');
  lines.push(`- Verdict: **${verdict}**`);
  lines.push(`- Timestamp: ${new Date().toISOString()}`);
  if (failedStep) lines.push(`- Failed Step: ${failedStep}`);
  lines.push('');
  lines.push('## Step Logs');
  for (const log of logs) {
    lines.push(`- ${log.name}: ${log.ok ? 'PASS' : 'FAIL'}`);
  }
  if (failedOutput) {
    lines.push('');
    lines.push('## Failure Output (tail)');
    lines.push('```text');
    lines.push(failedOutput);
    lines.push('```');
  }
  lines.push('');
  lines.push('## Next Actions');
  lines.push('- npm run -s env:commercial:doctor');
  lines.push('- npm run -s env:commercial:assert');
  lines.push('- npm run -s go-live:commercial');

  const outDir = path.join(repoRoot, 'docs/user');
  mkdirSync(outDir, { recursive: true });
  const latest = path.join(outDir, 'COMMERCIAL-RELEASE-GATE-LATEST.md');
  const archive = path.join(outDir, `COMMERCIAL-RELEASE-GATE-${ts}.md`);
  const body = `${lines.join('\n')}\n`;
  writeFileSync(latest, body, 'utf8');
  writeFileSync(archive, body, 'utf8');
  process.stdout.write(`[release-gate] report: ${path.relative(repoRoot, latest)}\n`);
  process.stdout.write(`[release-gate] archive: ${path.relative(repoRoot, archive)}\n`);
}

for (const step of steps) {
  process.stdout.write(`\n[release-gate] ${step.name}\n`);
  const res = spawnSync(step.cmd, step.args, { encoding: 'utf8', shell: false, cwd: repoRoot });
  const output = `${res.stdout || ''}${res.stderr || ''}`.trim();
  logs.push({ name: step.name, ok: res.status === 0 });
  process.stdout.write(output ? `${output}\n` : '');
  if (res.status !== 0) {
    const tail = output.slice(-1400);
    process.stderr.write(`\n[release-gate] FAIL at: ${step.name}\n`);
    saveReport('FAIL', step.name, tail);
    process.exit(res.status ?? 1);
  }
}

saveReport('PASS');
process.stdout.write('\n[release-gate] PASS: 商业化发布门禁全部通过。\n');
