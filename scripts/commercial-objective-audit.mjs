#!/usr/bin/env node
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

function run(cmd, args) {
  const res = spawnSync(cmd, args, { encoding: 'utf8', shell: false, cwd: repoRoot });
  return { code: res.status ?? 1, out: `${res.stdout || ''}${res.stderr || ''}`.trim() };
}

function resolveRepoPath(targetPath) {
  return path.isAbsolute(targetPath) ? targetPath : path.join(repoRoot, targetPath);
}

function has(targetPath) {
  return existsSync(resolveRepoPath(targetPath));
}

function contains(targetPath, needle) {
  const full = resolveRepoPath(targetPath);
  if (!existsSync(full)) return false;
  return readFileSync(full, 'utf8').includes(needle);
}

const checks = [];
function add(name, ok, evidence, type = 'required') {
  checks.push({ name, ok, evidence, type });
}

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..');

// Requirement group A: backup + markers
add(
  '上线前备份目录存在',
  has('backups/release-commercial-v10.80.2-20260601-104718'),
  'backups/release-commercial-v10.80.2-20260601-104718'
);
add(
  '备份元信息存在',
  has('backups/release-commercial-v10.80.2-20260601-104718/BACKUP-META.md'),
  'backups/release-commercial-v10.80.2-20260601-104718/BACKUP-META.md'
);
add(
  '基线标记文档存在',
  has(path.join(repoRoot, 'docs/user/COMMERCIAL-BASELINE-MARK-20260601-v10.80.2.md')),
  'docs/user/COMMERCIAL-BASELINE-MARK-20260601-v10.80.2.md'
);

// Requirement group B: mobile UI adaptation evidence
add(
  '主题色卡移动端适配证据（ThemeSelector）',
  contains('src/components/ThemeSelector.tsx', 'grid-cols-5'),
  'src/components/ThemeSelector.tsx contains grid-cols-5'
);
add(
  '主题弹层移动端适配证据（ThemePickerModal）',
  contains('src/components/ThemePickerModal.tsx', 'grid-cols-5'),
  'src/components/ThemePickerModal.tsx contains grid-cols-5'
);
add(
  '生成页主题组件移动端适配证据',
  contains('src/components/generate/ThemeSelector.tsx', 'grid-cols-4'),
  'src/components/generate/ThemeSelector.tsx contains grid-cols-4'
);

// Requirement group C: commercial payment/download closure evidence
add(
  '单次下载 provider 下单能力',
  contains('src/app/api/pay-once/route.ts', "payMode === 'provider'"),
  "src/app/api/pay-once/route.ts has payMode === 'provider'"
);
add(
  '单次下载领取接口能力',
  contains('src/app/api/pay-once/route.ts', 'export async function GET'),
  'src/app/api/pay-once/route.ts exports GET for order polling'
);
add(
  '支付回调分流 download_once',
  contains('src/app/api/payment/route.ts', "productType === 'download_once'"),
  "src/app/api/payment/route.ts handles download_once"
);
add(
  '支付接口限流能力（订阅/单次）',
  contains('src/app/api/payment/route.ts', 'payment:create_order:')
    && contains('src/app/api/pay-once/route.ts', 'pay_once:create:'),
  'src/app/api/payment/route.ts + src/app/api/pay-once/route.ts include rate-limit keys'
);
add(
  '支付回调与轮询限流能力',
  contains('src/app/api/payment/route.ts', 'payment:callback:')
    && contains('src/app/api/pay-once/route.ts', 'pay_once:poll:'),
  'payment callback/polling rate-limit keys exist'
);

// Requirement group D: automated tests evidence
const t1 = run('npm', ['run', '-s', 'test:run', '--', '__tests__/api/pay-once-provider.test.ts', '__tests__/api/payment-callback-download-once.test.ts']);
add(
  '关键支付闭环测试通过',
  t1.code === 0,
  t1.code === 0 ? 'targeted tests pass' : t1.out.slice(-600)
);

// Requirement group E: go-live gate
const gate = run('npm', ['run', '-s', 'release-gate:commercial']);
add(
  '一键发布门禁通过',
  gate.code === 0,
  gate.code === 0 ? 'release-gate:commercial PASS' : gate.out.slice(-800)
);

const allRequired = checks.filter(c => c.type === 'required');
const passRequired = allRequired.filter(c => c.ok).length;
const verdict = passRequired === allRequired.length ? 'READY' : 'NOT_READY';

const now = new Date();
const pad = (n) => String(n).padStart(2, '0');
const ts = `${now.getFullYear()}${pad(now.getMonth()+1)}${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;

const lines = [];
lines.push('# Commercial Objective Audit');
lines.push('');
lines.push(`- Verdict: **${verdict}**`);
lines.push(`- Required checks passed: ${passRequired}/${allRequired.length}`);
lines.push(`- Timestamp: ${now.toISOString()}`);
lines.push('');
lines.push('## Checks');
for (const c of checks) {
  lines.push(`- [${c.ok ? 'x' : ' '}] ${c.name}`);
  lines.push(`  evidence: ${c.evidence}`);
}

const outDir = path.join(repoRoot, 'docs/user');
mkdirSync(outDir, { recursive: true });
const latest = path.join(outDir, 'COMMERCIAL-OBJECTIVE-AUDIT-LATEST.md');
const archive = path.join(outDir, `COMMERCIAL-OBJECTIVE-AUDIT-${ts}.md`);
writeFileSync(latest, lines.join('\n') + '\n', 'utf8');
writeFileSync(archive, lines.join('\n') + '\n', 'utf8');

process.stdout.write(`Objective audit verdict: ${verdict}\n`);
process.stdout.write(`Objective audit latest: ${path.relative(repoRoot, latest)}\n`);
process.stdout.write(`Objective audit archive: ${path.relative(repoRoot, archive)}\n`);
if (gate.code !== 0) {
  process.stdout.write('Release gate still blocked by external env/config.\n');
}
process.exit(verdict === 'READY' ? 0 : 1);
