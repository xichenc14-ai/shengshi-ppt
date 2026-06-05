#!/usr/bin/env node
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..');
const docsDir = path.join(repoRoot, 'docs/user');

function read(rel) {
  const p = path.join(repoRoot, rel);
  if (!existsSync(p)) return '';
  return readFileSync(p, 'utf8');
}

function has(text, pattern) {
  return text.includes(pattern);
}

const checks = [];
function add(name, ok, evidence) {
  checks.push({ name, ok, evidence });
}

const themeSelector = read('src/components/ThemeSelector.tsx');
const themePickerModal = read('src/components/ThemePickerModal.tsx');
const genThemeSelector = read('src/components/generate/ThemeSelector.tsx');
const homePage = read('src/app/page.tsx');

add(
  'ThemeSelector 移动端主题网格 >=5列',
  has(themeSelector, 'grid grid-cols-5'),
  'src/components/ThemeSelector.tsx contains grid-cols-5'
);
add(
  'ThemePickerModal 移动端主题网格 >=5列',
  has(themePickerModal, 'grid grid-cols-5'),
  'src/components/ThemePickerModal.tsx contains grid-cols-5'
);
add(
  '生成页 ThemeSelector 移动端网格 >=4列',
  has(genThemeSelector, 'grid grid-cols-4'),
  'src/components/generate/ThemeSelector.tsx contains grid-cols-4'
);
add(
  '主页按页付费弹层存在多支付方式（积分/微信/支付宝）',
  has(homePage, "setOneTimePayMethod('credits')") && has(homePage, "setOneTimePayMethod('wechat')") && has(homePage, "setOneTimePayMethod('alipay')"),
  'src/app/page.tsx contains one-time payment method toggles'
);
add(
  '单次下载 provider 轮询领取逻辑存在',
  has(homePage, 'pollOneTimeOrder') && has(homePage, 'payMode === \'provider\''),
  'src/app/page.tsx contains pollOneTimeOrder + provider mode flow'
);

const passed = checks.filter(c => c.ok).length;
const verdict = passed === checks.length ? 'PASS' : 'FAIL';

const lines = [];
lines.push('# Mobile UI Audit Report');
lines.push('');
lines.push(`- Verdict: **${verdict}**`);
lines.push(`- Passed: ${passed}/${checks.length}`);
lines.push(`- Generated: ${new Date().toISOString()}`);
lines.push('');
lines.push('## Checks');
for (const c of checks) {
  lines.push(`- [${c.ok ? 'x' : ' '}] ${c.name}`);
  lines.push(`  evidence: ${c.evidence}`);
}

mkdirSync(docsDir, { recursive: true });
const now = new Date();
const pad = (n) => String(n).padStart(2, '0');
const ts = `${now.getFullYear()}${pad(now.getMonth()+1)}${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
const latest = path.join(docsDir, 'MOBILE-UI-AUDIT-LATEST.md');
const archive = path.join(docsDir, `MOBILE-UI-AUDIT-${ts}.md`);
const body = `${lines.join('\n')}\n`;
writeFileSync(latest, body, 'utf8');
writeFileSync(archive, body, 'utf8');

process.stdout.write(`mobile ui audit latest: ${path.relative(repoRoot, latest)}\n`);
process.stdout.write(`mobile ui audit archive: ${path.relative(repoRoot, archive)}\n`);
process.stdout.write(`mobile ui verdict: ${verdict}\n`);
process.exit(verdict === 'PASS' ? 0 : 1);
