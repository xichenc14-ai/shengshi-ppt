import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { NextRequest } from 'next/server';

const { exportPptxGetMock, convertPptxToPdfMock, renderSlidesPdfBufferMock } = vi.hoisted(() => ({
  exportPptxGetMock: vi.fn(),
  convertPptxToPdfMock: vi.fn(),
  renderSlidesPdfBufferMock: vi.fn(),
}));

vi.mock('@/app/api/export-pptx/route', () => ({
  GET: exportPptxGetMock,
}));

vi.mock('@/lib/pdf-converter', () => ({
  convertPptxToPdf: convertPptxToPdfMock,
}));

vi.mock('@/lib/slides-pdf', () => ({
  renderSlidesPdfBuffer: renderSlidesPdfBufferMock,
}));

import { GET, POST } from '@/app/api/export-pdf/route';

function mockRequest(url: string) {
  return new Request(url, { method: 'GET' }) as unknown as NextRequest;
}

function mockPostRequest(body: unknown) {
  return new Request('http://localhost/api/export-pdf', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  }) as unknown as NextRequest;
}

describe('GET /api/export-pdf', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should convert an internal pptx response into pdf', async () => {
    exportPptxGetMock.mockResolvedValueOnce(new Response(new Uint8Array([1, 2, 3]), {
      status: 200,
      headers: { 'Content-Type': 'application/vnd.openxmlformats-officedocument.presentationml.presentation' },
    }));
    convertPptxToPdfMock.mockResolvedValueOnce(Buffer.from([4, 5, 6]));

    const res = await GET(mockRequest('http://localhost/api/export-pdf?generationId=gen_1&name=demo.pdf'));

    expect(res.status).toBe(200);
    expect(res.headers.get('Content-Type')).toBe('application/pdf');
    expect(convertPptxToPdfMock).toHaveBeenCalledTimes(1);
    expect(exportPptxGetMock).toHaveBeenCalledTimes(1);
  });

  it('should forward upstream pptx export errors', async () => {
    exportPptxGetMock.mockResolvedValueOnce(Response.json({ error: 'PPTX unavailable' }, { status: 409 }));

    const res = await GET(mockRequest('http://localhost/api/export-pdf?generationId=gen_1'));
    const data = await res.json();

    expect(res.status).toBe(409);
    expect(data.error).toBe('PPTX unavailable');
    expect(convertPptxToPdfMock).not.toHaveBeenCalled();
  });
});

describe('POST /api/export-pdf', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should generate a PDF from slide payload in-app', async () => {
    renderSlidesPdfBufferMock.mockResolvedValueOnce(Buffer.from([9, 8, 7]));

    const res = await POST(mockPostRequest({
      title: '演示文稿',
      themeId: 'consultant',
      name: '演示文稿.pdf',
      slides: [
        { id: '1', title: '封面', content: ['要点 1', '要点 2'] },
      ],
    }));

    expect(res.status).toBe(200);
    expect(res.headers.get('Content-Type')).toBe('application/pdf');
    expect(renderSlidesPdfBufferMock).toHaveBeenCalledWith({
      title: '演示文稿',
      themeId: 'consultant',
      slides: [
        { id: '1', title: '封面', content: ['要点 1', '要点 2'], notes: '' },
      ],
    });
  });

  it('should reject missing slides payload', async () => {
    const res = await POST(mockPostRequest({
      title: '空文稿',
      slides: [],
    }));
    const data = await res.json();

    expect(res.status).toBe(400);
    expect(data.error).toContain('slides');
    expect(renderSlidesPdfBufferMock).not.toHaveBeenCalled();
  });
});
