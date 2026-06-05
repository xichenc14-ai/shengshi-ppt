#!/usr/bin/env node

import { spawnSync } from 'node:child_process';

function runStep(name, cmd, args) {
  process.stdout.write(`\n[go-live] ${name}\n`);
  const res = spawnSync(cmd, args, { stdio: 'inherit', shell: false });
  return res.status === 0;
}

const steps = [
  { name: 'Environment readiness', cmd: 'npm', args: ['run', '-s', 'env:commercial'] },
  { name: 'Preflight commercial', cmd: 'npm', args: ['run', '-s', 'preflight:commercial'] },
  { name: 'Audit commercial', cmd: 'npm', args: ['run', '-s', 'audit:commercial'] },
];

for (const step of steps) {
  const ok = runStep(step.name, step.cmd, step.args);
  if (!ok) {
    process.stderr.write(`\n[go-live] FAIL at: ${step.name}\n`);
    process.exit(1);
  }
}

process.stdout.write('\n[go-live] PASS: 商业化上线检查已全部通过。\n');
