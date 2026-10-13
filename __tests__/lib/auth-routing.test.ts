import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

describe('authentication deployment invariants', () => {
  it('keeps send, reset and real readiness probes on the verified SMS region', () => {
    const config = JSON.parse(readFileSync(resolve('vercel.json'), 'utf8'));
    for (const path of ['src/app/api/user/route.ts', 'src/app/api/reset-password/route.ts', 'src/app/api/health/auth/route.ts']) {
      expect(config.functions[path].regions).toEqual(['hnd1']);
      expect(readFileSync(resolve(path), 'utf8')).toMatch(/export const preferredRegion = ['"]hnd1['"]/);
    }
    expect(config.regions).toEqual(['hkg1']);
  });
  it('requires authentication contract checks in every production build', () => {
    const pkg = JSON.parse(readFileSync(resolve('package.json'), 'utf8'));
    expect(pkg.scripts.build).toMatch(/^npm run test:auth && next build$/);
    for (const file of ['login-sms-contract.test.ts', 'sms-client.test.ts', 'auth-routing.test.ts', 'auth-readiness.test.ts', 'gamma-400-regression.test.ts']) {
      expect(pkg.scripts['test:auth']).toContain(file);
    }
  });
});
