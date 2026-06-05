#!/usr/bin/env node
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..');

function run(name, cmd, args) {
  const res = spawnSync(cmd, args, { encoding: 'utf8', shell: false, cwd: repoRoot });
  return {
    name,
    code: res.status ?? 1,
    output: `${res.stdout || ''}${res.stderr || ''}`.trim(),
  };
}

function readVerdict(path) {
  if (!existsSync(path)) return 'MISSING';
  const text = readFileSync(path, 'utf8');
  const m = text.match(/Verdict:\s*\*\*(.+?)\*\*/i);
  if (m) return m[1];
  const m2 = text.match(/Doctor verdict:\s*(\S+)/i);
  if (m2) return m2[1];
  return 'UNKNOWN';
}

const checks = [
  run('env:commercial:assert', 'npm', ['run', '-s', 'env:commercial:assert']),
  run('env:commercial:doctor', 'npm', ['run', '-s', 'env:commercial:doctor']),
  run('go-live:commercial', 'npm', ['run', '-s', 'go-live:commercial']),
  run('release-gate:commercial', 'npm', ['run', '-s', 'release-gate:commercial']),
  run('audit:objective:commercial', 'npm', ['run', '-s', 'audit:objective:commercial']),
];

const latestFiles = {
  envDoctor: path.join(repoRoot, 'docs/user/COMMERCIAL-ENV-DOCTOR-LATEST.md'),
  releaseGate: path.join(repoRoot, 'docs/user/COMMERCIAL-RELEASE-GATE-LATEST.md'),
  objectiveAudit: path.join(repoRoot, 'docs/user/COMMERCIAL-OBJECTIVE-AUDIT-LATEST.md'),
};

const lines = [];
lines.push('# Commercial Dashboard Latest');
lines.push('');
lines.push(`- Generated: ${new Date().toISOString()}`);
lines.push('');
lines.push('## Command Status');
for (const c of checks) {
  lines.push(`- ${c.name}: ${c.code === 0 ? 'PASS' : 'FAIL'}`);
}
lines.push('');
lines.push('## Latest Report Verdicts');
lines.push(`- Env Doctor: ${readVerdict(latestFiles.envDoctor)}`);
lines.push(`- Release Gate: ${readVerdict(latestFiles.releaseGate)}`);
lines.push(`- Objective Audit: ${readVerdict(latestFiles.objectiveAudit)}`);
lines.push('');
lines.push('## Blockers (from latest command output tails)');
for (const c of checks.filter((x) => x.code !== 0)) {
  lines.push(`- ${c.name}:`);
  lines.push('```text');
  lines.push(c.output.slice(-600));
  lines.push('```');
}
lines.push('');
lines.push('## Next Actions');
lines.push('1. 注入生产变量（PAYMENT_NOTIFY_URL / PAYMENT_NOTIFY_SECRET / ALLOWED_CALLBACK_IPS）。');
lines.push('2. 配置支付模板或SDK变量（微信+支付宝至少各一条路径）。');
lines.push('3. 重新执行: npm run -s release-gate:commercial');

const outDir = path.join(repoRoot, 'docs/user');
mkdirSync(outDir, { recursive: true });
const now = new Date();
const pad = (n) => String(n).padStart(2, '0');
const ts = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
const latest = path.join(outDir, 'COMMERCIAL-DASHBOARD-LATEST.md');
const archive = path.join(outDir, `COMMERCIAL-DASHBOARD-${ts}.md`);
writeFileSync(latest, `${lines.join('\n')}\n`, 'utf8');
writeFileSync(archive, `${lines.join('\n')}\n`, 'utf8');

process.stdout.write(`dashboard latest: ${path.relative(repoRoot, latest)}\n`);
process.stdout.write(`dashboard archive: ${path.relative(repoRoot, archive)}\n`);

const allPass = checks.every((c) => c.code === 0);
process.exit(allPass ? 0 : 1);
