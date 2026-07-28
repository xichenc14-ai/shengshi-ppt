import { afterEach, describe, expect, it, vi } from 'vitest';
import type { NextRequest } from 'next/server';
import { GET as legacyExport } from '@/app/api/export/route';
import { POST as localPpt } from '@/app/api/ppt-local/route';

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe('P0 legacy route hardening', () => {
  it('disables the entire legacy export route in production', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    const response = await legacyExport(new Request(
      'http://localhost/api/export?file=legacy-file',
    ) as unknown as NextRequest);
    const body = await response.json();

    expect(response.status).toBe(410);
    expect(body.code).toBe('LEGACY_EXPORT_DISABLED');
  });

  it('never fetches a caller-provided external URL', async () => {
    vi.stubEnv('NODE_ENV', 'test');
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    const response = await legacyExport(new Request(
      'http://localhost/api/export?url=http%3A%2F%2F169.254.169.254%2Flatest%2Fmeta-data',
    ) as unknown as NextRequest);
    const body = await response.json();

    expect(response.status).toBe(410);
    expect(body.code).toBe('EXTERNAL_EXPORT_PROXY_DISABLED');
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('disables the local Python generator in production before reading input', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    const response = await localPpt(new Request('http://localhost/api/ppt-local', {
      method: 'POST',
      body: JSON.stringify({ title: 'test', slides: [{ title: 'slide' }] }),
    }) as unknown as NextRequest);
    const body = await response.json();

    expect(response.status).toBe(410);
    expect(body.code).toBe('LOCAL_PPT_DISABLED');
  });
});
