import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';

const repoRoot = path.resolve(__dirname, '../..');
const isolatedCwd = mkdtempSync(path.join(tmpdir(), 'shengxin-ops-test-'));

afterAll(() => rmSync(isolatedCwd, { recursive: true, force: true }));

function run(script: string, env: Record<string, string>) {
  try {
    execFileSync(process.execPath, [path.join(repoRoot, 'scripts', script)], {
      cwd: isolatedCwd,
      env: { PATH: process.env.PATH || '', NODE_ENV: 'test', ...env },
      encoding: 'utf8',
      stdio: 'pipe',
    });
    return { ok: true, output: '' };
  } catch (error) {
    const result = error as { stdout?: string; stderr?: string };
    return { ok: false, output: `${result.stdout || ''}${result.stderr || ''}` };
  }
}

describe('commercial operations scripts safety rails', () => {
  it('refuses to inspect a recovery target without explicit isolation confirmation', () => {
    const result = run('commercial-restore-drill.mjs', {});
    expect(result.ok).toBe(false);
    expect(result.output).toContain('RECOVERY_DRILL_CONFIRM_ISOLATED=true');
  });

  it('refuses to use the production database as the recovery target', () => {
    const result = run('commercial-restore-drill.mjs', {
      RECOVERY_DRILL_CONFIRM_ISOLATED: 'true',
      RECOVERY_TEST_SUPABASE_URL: 'https://same-project.supabase.co',
      NEXT_PUBLIC_SUPABASE_URL: 'https://same-project.supabase.co',
    });
    expect(result.ok).toBe(false);
    expect(result.output).toContain('must not be the production');
  });

  it('refuses post-deploy verification with a weak cron secret', () => {
    const result = run('commercial-postdeploy-check.mjs', {
      COMMERCIAL_BASE_URL: 'https://example.com',
      CRON_SECRET: 'short',
    });
    expect(result.ok).toBe(false);
    expect(result.output).toContain('at least 24 characters');
  });
});
