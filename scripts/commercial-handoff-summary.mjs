#!/usr/bin/env node
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..');
const docsDir = path.join(repoRoot, 'docs/user');

function read(file) {
  const p = path.join(repoRoot, file);
  if (!existsSync(p)) return '';
  return readFileSync(p, 'utf8');
}

function readJson(file) {
  const txt = read(file);
  if (!txt) return null;
  try { return JSON.parse(txt); } catch { return null; }
}

function pickLine(text, re, fallback = 'N/A') {
  const m = text.match(re);
  return m?.[1]?.trim() || fallback;
}

const objectiveAudit = read('docs/user/COMMERCIAL-OBJECTIVE-AUDIT-LATEST.md');
const releaseGate = read('docs/user/COMMERCIAL-RELEASE-GATE-LATEST.md');
const envDoctor = read('docs/user/COMMERCIAL-ENV-DOCTOR-LATEST.md');
const dashboard = read('docs/user/COMMERCIAL-DASHBOARD-LATEST.md');
const envExport = readJson('docs/user/COMMERCIAL-ENV-EXPORT-LATEST.json');
const envMissing = read('docs/user/COMMERCIAL-ENV-MISSING-LATEST.env');

const objectiveVerdict = pickLine(objectiveAudit, /Verdict:\s*\*\*(.*?)\*\*/i);
const objectivePassRatio = pickLine(objectiveAudit, /Required checks passed:\s*(\d+\/\d+)/i);
const gateVerdict = pickLine(releaseGate, /Verdict:\s*\*\*(.*?)\*\*/i);
const gateFailedStep = pickLine(releaseGate, /Failed Step:\s*(.*)/i, 'None');
const doctorVerdict = pickLine(envDoctor, /Verdict:\s*\*\*(.*?)\*\*/i);

const missingCore = envExport?.missing?.core || [];
const missingMinimal = envExport?.missing?.minimalTemplatePath || [];

const lines = [];
lines.push('# 商业化部署交接摘要（自动生成）');
lines.push('');
lines.push(`- 生成时间: ${new Date().toISOString()}`);
lines.push(`- 目标审计: **${objectiveVerdict}** (${objectivePassRatio})`);
lines.push(`- 发布门禁: **${gateVerdict}**`);
lines.push(`- 环境诊断: **${doctorVerdict}**`);
lines.push('');
lines.push('## 已完成（代码与流程）');
lines.push('- 上线前备份与标记已完成（v10.80.2 基线）。');
lines.push('- 手机端主题色卡/主题弹层/生成页主题组件已做紧凑化适配。');
lines.push('- 单次付费下载链路已支持 provider 下单、回调、领取下载。');
lines.push('- 商业化门禁链条已标准化：assert -> doctor -> go-live -> release-gate -> dashboard。');
lines.push('');
lines.push('## 当前阻断（外部环境）');
if (missingCore.length === 0) {
  lines.push('- 无 core 阻断。');
} else {
  for (const k of missingCore) lines.push(`- ${k}`);
}
lines.push('');
lines.push('## 最小可上线变量（Template 模式）');
if (missingMinimal.length === 0) {
  lines.push('- 最小路径变量已齐备。');
} else {
  for (const k of missingMinimal) lines.push(`- ${k}`);
}
lines.push('');
lines.push('## 失败步骤定位');
lines.push(`- release-gate 当前失败步骤: ${gateFailedStep}`);
lines.push('');
lines.push('## 执行命令（按顺序）');
lines.push('1. npm run -s env:commercial:export');
lines.push('2. npm run -s env:commercial:assert');
lines.push('3. npm run -s env:commercial:doctor');
lines.push('4. npm run -s release-gate:commercial');
lines.push('5. npm run -s dashboard:commercial');
lines.push('');
lines.push('## 缺失变量片段（可粘贴）');
lines.push('```env');
lines.push((envMissing || '# no missing env snippet').trim());
lines.push('```');
lines.push('');
lines.push('## 关键报告入口');
lines.push('- docs/user/COMMERCIAL-DASHBOARD-LATEST.md');
lines.push('- docs/user/COMMERCIAL-RELEASE-GATE-LATEST.md');
lines.push('- docs/user/COMMERCIAL-OBJECTIVE-AUDIT-LATEST.md');
lines.push('- docs/user/COMMERCIAL-ENV-DOCTOR-LATEST.md');
lines.push('- docs/user/COMMERCIAL-ENV-EXPORT-LATEST.json');

mkdirSync(docsDir, { recursive: true });
const now = new Date();
const pad = (n) => String(n).padStart(2, '0');
const ts = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
const latest = path.join(docsDir, 'COMMERCIAL-HANDOFF-SUMMARY-LATEST.md');
const archive = path.join(docsDir, `COMMERCIAL-HANDOFF-SUMMARY-${ts}.md`);
const body = `${lines.join('\n')}\n`;
writeFileSync(latest, body, 'utf8');
writeFileSync(archive, body, 'utf8');

process.stdout.write(`handoff latest: ${path.relative(repoRoot, latest)}\n`);
process.stdout.write(`handoff archive: ${path.relative(repoRoot, archive)}\n`);
