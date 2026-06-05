import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { NextRequest } from 'next/server';

vi.mock('@/lib/gamma-key-pool', () => ({
  selectBestKey: vi.fn(() => ({ key: 'test-key', label: 'key1' })),
}));

import { GET } from '@/app/api/preview/file/route';

function mockRequest(url: string) {
  return new Request(url, { method: 'GET' }) as unknown as NextRequest;
}

describe('GET /api/preview/file', () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  it('should reuse the existing pptx export url when requesting pptx', async () => {
    fetchMock
      .mockResolvedValueOnce(new Response(JSON.stringify({
        status: 'completed',
        exportUrl: 'https://assets.api.gamma.app/export/pptx/demo/demo.pptx',
      }), { status: 200, headers: { 'Content-Type': 'application/json' } }))
      .mockResolvedValueOnce(new Response(new Uint8Array([1, 2, 3]), {
        status: 200,
        headers: { 'Content-Type': 'application/vnd.openxmlformats-officedocument.presentationml.presentation' },
      }));

    const res = await GET(mockRequest('http://localhost/api/preview/file?generationId=gen_1&format=pptx'));

    expect(res.status).toBe(200);
    expect(res.headers.get('Content-Type')).toContain('presentationml.presentation');
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[1]?.[0]).toBe('https://assets.api.gamma.app/export/pptx/demo/demo.pptx');
  });

  it('should reject requesting a second export format from the same generation', async () => {
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({
      status: 'completed',
      exportUrl: 'https://assets.api.gamma.app/export/pptx/demo/demo.pptx',
    }), { status: 200, headers: { 'Content-Type': 'application/json' } }));

    const res = await GET(mockRequest('http://localhost/api/preview/file?generationId=gen_1&format=pdf'));
    const data = await res.json();

    expect(res.status).toBe(501);
    expect(String(data.error)).toContain('不支持');
    expect(data.requestedFormat).toBe('pdf');
    expect(data.availableFormat).toBe('pptx');
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
