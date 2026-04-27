import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';

// Mock Gamma API
const server = setupServer(
  http.post('https://public-api.gamma.app/v1.0/generations', () =>
    HttpResponse.json({
      generationId: 'test-gen-123',
      id: 'test-gen-123',
      credits: { deducted: 10, remaining: 990 },
    })
  ),
  http.get('https://public-api.gamma.app/v1.0/generations/:id', () =>
    HttpResponse.json({
      id: 'test-gen-123',
      status: 'completed',
      credits: { deducted: 10, remaining: 990 },
    })
  ),
);

beforeAll(() => server.listen({ onUnhandledRequest: 'bypass' }));
afterAll(() => server.close());

import { POST, GET } from '@/app/api/gamma/route';

function mockPostRequest(body: Record<string, any> = {}) {
  return new Request('http://localhost/api/gamma', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-forwarded-for': '127.0.0.1' },
    body: JSON.stringify(body),
  });
}

function mockGetRequest(id?: string) {
  const url = id ? `http://localhost/api/gamma?id=${id}` : 'http://localhost/api/gamma';
  return new Request(url, { headers: { 'x-forwarded-for': '127.0.0.1' } });
}

describe('POST /api/gamma', () => {
  it('should return 400 when no inputText or slides', async () => {
    const res = await POST(mockPostRequest({}));
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toContain('内容');
  });

  it('should return 400 for empty string inputText', async () => {
    const res = await POST(mockPostRequest({ inputText: '' }));
    expect(res.status).toBe(400);
  });

  it('should auto-enhance short inputText and return 200', async () => {
    // Whitespace-only inputText gets auto-enhanced to '# \n\n---\n', so returns 200
    const res = await POST(mockPostRequest({ inputText: '   ' }));
    expect(res.status).toBe(200);
  });

  it('should return 200 with valid inputText', async () => {
    const res = await POST(mockPostRequest({
      inputText: '# AI技术趋势\n\n---\n\n## 机器学习\n\n- 监督学习\n- 无监督学习',
    }));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.generationId).toBeDefined();
  }, 30000);

  it('should return 200 with slides array', async () => {
    const res = await POST(mockPostRequest({
      slides: [
        { title: '封面', content: ['AI技术报告'] },
        { title: '第一章', content: ['要点1', '要点2'] },
      ],
    }));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.generationId).toBeDefined();
  }, 30000);
});

describe('GET /api/gamma', () => {
  it('should return 400 when generationId is missing', async () => {
    const res = await GET(mockGetRequest() as any);
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toContain('generationId');
  });

  it('should return generation status with valid id', async () => {
    const res = await GET(mockGetRequest('test-gen-123') as any);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.id).toBe('test-gen-123');
    expect(data.status).toBeDefined();
  });
});
