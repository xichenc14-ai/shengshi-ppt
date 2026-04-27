import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';

// ===== MSW Mock Gamma API =====
// 注意：gamma route 内部使用 node-fetch/fetch，msw 能拦截原生 fetch
// 如果 mock 未生效，说明 route 用了其他 HTTP 库或直接读 env 跳过了 fetch
const mockGenerationId = 'test-gen-' + Math.random().toString(36).slice(2, 8);

const server = setupServer(
  // 拦截 Gamma 创建生成
  http.post('https://public-api.gamma.app/v1.0/generations', async ({ request }) => {
    const body = await request.json() as any;
    console.log('[MSW Mock] Gamma generations POST intercepted, inputText length:', (body?.inputText || '').length);
    return HttpResponse.json({
      generationId: mockGenerationId,
      id: mockGenerationId,
      status: 'pending',
      credits: { deducted: 10, remaining: 990 },
    });
  }),
  // 拦截 Gamma 查询状态
  http.get('https://public-api.gamma.app/v1.0/generations/:id', ({ params }) => {
    console.log('[MSW Mock] Gamma generations GET intercepted, id:', params.id);
    return HttpResponse.json({
      id: params.id,
      status: 'completed',
      credits: { deducted: 10, remaining: 990 },
    });
  }),
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
    const res = await POST(mockPostRequest({ inputText: '   ' }));
    expect(res.status).toBe(200);
  });

  it('should return 200 with valid short inputText (3 pages)', async () => {
    // 精简输入：只3页，用主题图，减少积分消耗
    const res = await POST(mockPostRequest({
      inputText: '# AI技术趋势\n\n---\n\n## 机器学习\n\n- 监督学习\n- 无监督学习',
      numCards: 3,
    }));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.generationId).toBeDefined();
  }, 30000);

  it('should return 200 with minimal slides array (2 pages)', async () => {
    const res = await POST(mockPostRequest({
      slides: [
        { title: '封面', content: ['AI技术报告'] },
        { title: '总结', content: ['谢谢观看'] },
      ],
      numCards: 2,
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
    const res = await GET(mockGetRequest(mockGenerationId) as any);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.id).toBe(mockGenerationId);
    expect(data.status).toBeDefined();
  });
});
