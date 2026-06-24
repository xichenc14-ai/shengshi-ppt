import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { NextRequest } from 'next/server';
import { GET } from '@/app/api/export-pptx/route';

vi.mock('@/lib/gamma-key-pool', () => ({
  selectBestKey: vi.fn().mockReturnValue({
    key: 'mock-key',
    label: '测试key',
    remaining: 1000,
  }),
}));

const mockFetch = vi.fn();
global.fetch = mockFetch;

function request() {
  return new Request(
    'http://localhost/api/export-pptx?generationId=gen-1&name=test.pptx',
  ) as unknown as NextRequest;
}

function validPptxBytes(): ArrayBuffer {
  const bytes = new Uint8Array(2048);
  bytes.set([0x50, 0x4b, 0x03, 0x04], 0);
  bytes.set(new TextEncoder().encode('[Content_Types].xml'), 64);
  bytes.set(new TextEncoder().encode('ppt/presentation.xml'), 256);
  return bytes.buffer;
}

describe('/api/export-pptx', () => {
  beforeEach(() => {
    mockFetch.mockReset();
  });

  it('returns a validated PPTX package', async () => {
    mockFetch
      .mockResolvedValueOnce(new Response(JSON.stringify({
        status: 'completed',
        exportUrl: 'https://example.com/result.pptx',
      }), { status: 200, headers: { 'Content-Type': 'application/json' } }))
      .mockResolvedValueOnce(new Response(validPptxBytes(), {
        status: 200,
        headers: { 'Content-Type': 'application/octet-stream' },
      }));

    const response = await GET(request());

    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toContain(
      'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    );
    expect(new Uint8Array(await response.arrayBuffer()).slice(0, 4)).toEqual(
      new Uint8Array([0x50, 0x4b, 0x03, 0x04]),
    );
  });

  it('rejects HTML or truncated content instead of downloading a broken .pptx', async () => {
    mockFetch
      .mockResolvedValueOnce(new Response(JSON.stringify({
        status: 'completed',
        exportUrl: 'https://example.com/result.pptx',
      }), { status: 200, headers: { 'Content-Type': 'application/json' } }))
      .mockResolvedValueOnce(new Response('<html>temporary error</html>', {
        status: 200,
        headers: { 'Content-Type': 'text/html' },
      }))
      .mockResolvedValueOnce(new Response('<html>temporary error</html>', {
        status: 200,
        headers: { 'Content-Type': 'text/html' },
      }));

    const response = await GET(request());
    const data = await response.json();

    expect(response.status).toBe(502);
    expect(data.error.code).toBe('INVALID_PPTX');
  });
});
