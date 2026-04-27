import { describe, it, expect, vi, beforeAll } from 'vitest';

// Mock data must be defined inside vi.mock factory for hoisting
// Using vi.hoisted to share data between mock and tests
const { mockOutlineData } = vi.hoisted(() => ({
  mockOutlineData: JSON.stringify({
    title: '测试PPT', scene: '商务汇报', themeId: 'consultant',
    tone: 'professional', imageMode: 'theme-img',
    slides: [{ title: '封面', content: ['AI技术趋势'] }, { title: '技术概览', content: ['机器学习'] }],
  }),
}));

vi.mock('@/lib/kimi-client', () => ({
  callKimi: vi.fn().mockResolvedValue(mockOutlineData),
  callKimiWithSearch: vi.fn().mockResolvedValue(mockOutlineData),
}));

vi.mock('@/lib/minimax-client', () => ({
  callMiniMax: vi.fn().mockResolvedValue(mockOutlineData),
  callMiniMaxWithRetry: vi.fn().mockResolvedValue(mockOutlineData),
}));

vi.mock('@/lib/glm-client', () => ({
  callGLM: vi.fn().mockResolvedValue(mockOutlineData),
}));

import { POST } from '@/app/api/outline/route';
import { callKimi } from '@/lib/kimi-client';
import { callMiniMaxWithRetry } from '@/lib/minimax-client';
import { callGLM } from '@/lib/glm-client';

function mockRequest(body: Record<string, any> = {}) {
  return new Request('http://localhost/api/outline', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-forwarded-for': '127.0.0.1' },
    body: JSON.stringify(body),
  });
}

describe('POST /api/outline', () => {
  it('should return 400 when inputText is missing', async () => {
    const res = await POST(mockRequest({}));
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toBeDefined();
  });

  it('should return 400 when inputText is empty', async () => {
    const res = await POST(mockRequest({ inputText: '   ' }));
    expect(res.status).toBe(400);
  });

  it('should return 400 when inputText exceeds 10000 chars', async () => {
    const res = await POST(mockRequest({ inputText: 'a'.repeat(10001) }));
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toContain('过长');
  });

  it('should return 200 with valid inputText', async () => {
    const res = await POST(mockRequest({ inputText: '做一个关于AI的商务汇报PPT' }));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.title).toBe('测试PPT');
    expect(data.slides).toBeDefined();
    expect(Array.isArray(data.slides)).toBe(true);
  });

  it('should accept textMode generate/condense/preserve', async () => {
    for (const mode of ['generate', 'condense', 'preserve']) {
      const res = await POST(mockRequest({ inputText: '测试PPT内容', textMode: mode }));
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.title).toBeDefined();
    }
  });

  it('should respect slideCount parameter', async () => {
    const res = await POST(mockRequest({ inputText: '测试PPT主题内容', slideCount: 5 }));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.slides.length).toBeGreaterThanOrEqual(1);
  });

  it('should return 500 when all LLM providers fail', async () => {
    // Override mocks to throw errors
    vi.mocked(callKimi).mockRejectedValueOnce(new Error('Kimi error'));
    vi.mocked(callMiniMaxWithRetry).mockRejectedValueOnce(new Error('MiniMax error'));
    vi.mocked(callGLM).mockRejectedValueOnce(new Error('GLM error'));

    const res = await POST(mockRequest({ inputText: '测试内容' }));
    expect(res.status).toBe(500);
  });
});
