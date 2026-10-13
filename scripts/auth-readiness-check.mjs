// Signed, read-only probes from the deployed runtime. Never sends an SMS.
import { spawn } from 'node:child_process';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { sealData } from 'iron-session';

const origin = process.argv[2];
if (!origin?.startsWith('https://')) throw new Error('Explicit deployment URL required');
try {
  const env = await readFile(resolve('.env.production.local'), 'utf8');
  for (const line of env.split(/\r?\n/)) {
    const match = line.match(/^([A-Z][A-Z0-9_]*)=(.*)$/);
    if (!match || process.env[match[1]]) continue;
    const value = match[2].trim();
    process.env[match[1]] = /^(["']).*\1$/.test(value) ? value.slice(1, -1) : value;
  }
} catch { /* CI may inject the credential instead. */ }
const adminId = (process.env.ADMIN_USER_IDS || '').split(',').map(v => v.trim()).find(Boolean);
const adminPhone = (process.env.ADMIN_USER_PHONES || '').split(',').map(v => v.trim()).find(Boolean);
const cookie = process.env.SESSION_PASSWORD && (adminId || adminPhone)
  ? await sealData({ isLoggedIn: true, user: { id: adminId || 'auth-readiness', phone: adminPhone || '', nickname: 'Auth Readiness', credits: 0, plan_type: 'free' } }, { password: process.env.SESSION_PASSWORD, ttl: 600 }) : undefined;
if (!process.env.ADMIN_DASHBOARD_KEY && !cookie) throw new Error('Admin readiness credential unavailable');
const paths = process.argv.includes('--matrix') ? ['/api/health/auth', '/api/health/auth-hkg', '/api/health/auth-sin'] : ['/api/health/auth'];
const samples = Math.min(5, Math.max(1, Number(process.argv.find(arg => arg.startsWith('--samples='))?.split('=')[1] || 1)));
const report = { origin, startedAt: new Date().toISOString(), probes: [] };
const output = resolve(process.env.EVIDENCE_DIR || 'docs/releases/sms-delivery-20261013-evidence');
await mkdir(output, { recursive: true });

async function probe(path) {
  const raw = await new Promise((done, reject) => {
    const child = spawn('vercel', ['curl', path, '--deployment', origin, '--', '--silent', '--show-error', '--include', '--max-time', '45', '--config', '-'], { stdio: ['pipe', 'pipe', 'pipe'] });
    let stdout = '';
    child.stdout.on('data', chunk => { stdout += chunk; });
    child.stderr.resume();
    child.on('error', reject);
    child.on('close', code => code ? reject(new Error(`probe_transport_${code}`)) : done(stdout));
    const headers = [];
    if (process.env.ADMIN_DASHBOARD_KEY) headers.push(`header = ${JSON.stringify(`x-admin-key: ${process.env.ADMIN_DASHBOARD_KEY}`)}`);
    if (cookie) headers.push(`header = ${JSON.stringify(`Cookie: shengxin_session=${cookie}`)}`);
    child.stdin.end(headers.join('\n') + '\n');
  });
  const blocks = raw.split(/\r?\n\r?\n/);
  const index = blocks.findLastIndex(block => /^HTTP\/\S+\s+\d+/.test(block));
  const status = Number(blocks[index]?.match(/^HTTP\/\S+\s+(\d+)/)?.[1]);
  return { path, httpStatus: status, ...JSON.parse(blocks.slice(index + 1).join('\n\n')) };
}
for (let sample = 0; sample < samples; sample += 1) {
  const results = await Promise.allSettled(paths.map(probe));
  for (let i = 0; i < results.length; i += 1) {
    const result = results[i];
    const row = result.status === 'fulfilled' ? { sample: sample + 1, ...result.value } : { sample: sample + 1, path: paths[i], error: result.reason.message };
    report.probes.push(row);
    console.log(JSON.stringify(row));
  }
  await writeFile(resolve(output, process.argv.includes('--matrix') ? 'region-comparison.json' : 'auth-readiness.json'), JSON.stringify(report, null, 2));
}
if (!process.argv.includes('--matrix') && report.probes.some(probe => !probe.ready || probe.region !== 'hnd1')) throw new Error('Authentication readiness failed; do not promote this deployment');
