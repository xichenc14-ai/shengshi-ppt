import { describe, it, expect, vi } from 'vitest';
import type { NextRequest } from 'next/server';

// Mock data must be defined inside vi.mock factory for hoisting
// Using vi.hoisted to share data between mock and tests
const { mockOutlineData } = vi.hoisted(() => ({
  mockOutlineData: JSON.stringify({
    title: '测试PPT', scene: '商务汇报', themeId: 'consultant',
    tone: 'professional', imageMode: 'theme-img',
    slides: [{ title: '封面', content: ['AI技术趋势'] }, { title: '技术概览', content: ['机器学习'] }],
  }),
}));

vi.mock('@/lib/minimax-client', () => ({
  callMiniMax: vi.fn().mockResolvedValue(mockOutlineData),
  callMiniMaxWithRetry: vi.fn().mockResolvedValue(mockOutlineData),
}));

vi.mock('@/lib/deepseek-client', () => ({
  callDeepSeekWithRetry: vi.fn().mockRejectedValue(new Error('DeepSeek error')),
}));

import { POST } from '@/app/api/outline/route';
import { callMiniMaxWithRetry } from '@/lib/minimax-client';
import { callDeepSeekWithRetry } from '@/lib/deepseek-client';
import { LIMITS } from '@/lib/input-validation';

function mockRequest(body: Record<string, unknown> = {}) {
  return new Request('http://localhost/api/outline', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-forwarded-for': '127.0.0.1' },
    body: JSON.stringify(body),
  }) as unknown as NextRequest;
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

  it('should return 400 when inputText exceeds limit', async () => {
    const res = await POST(mockRequest({ inputText: 'a'.repeat(LIMITS.MAX_TEXT_LENGTH + 1) }));
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

  it('should preserve user tone/imageMode/theme when AI output misses or returns invalid values', async () => {
    vi.mocked(callMiniMaxWithRetry).mockResolvedValueOnce(JSON.stringify({
      title: '用户参数优先',
      scene: '商务汇报',
      themeId: 'not-a-real-theme',
      slides: [{ title: '封面', content: ['测试'] }, { title: '结尾', content: ['完成'] }],
    }));

    const res = await POST(mockRequest({
      inputText: '用户输入内容',
      themeId: 'aurora',
      tone: 'bold',
      imageMode: 'web',
    }));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.themeId).toBe('aurora');
    expect(data.tone).toBe('bold');
    expect(data.imageMode).toBe('web');
  });

  it('should normalize ai imageMode aliases to canonical values', async () => {
    vi.mocked(callMiniMaxWithRetry).mockResolvedValueOnce(JSON.stringify({
      title: '图片模式规范化',
      scene: '商务汇报',
      themeId: 'consultant',
      tone: 'professional',
      imageMode: 'pexels',
      slides: [{ title: '封面', content: ['测试'] }, { title: '结尾', content: ['完成'] }],
    }));
    const res = await POST(mockRequest({ inputText: '测试内容' }));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.imageMode).toBe('web');
  });

  it('should preserve noImages style aliases', async () => {
    vi.mocked(callMiniMaxWithRetry).mockResolvedValueOnce(JSON.stringify({
      title: '无图保留',
      scene: '商务汇报',
      themeId: 'consultant',
      tone: 'professional',
      imageMode: 'noImages',
      slides: [{ title: '封面', content: ['测试'] }, { title: '结尾', content: ['完成'] }],
    }));
    const res = await POST(mockRequest({ inputText: '测试内容' }));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.imageMode).toBe('noImages');
  });

  it('should return fallback outline when all LLM providers fail', async () => {
    vi.mocked(callMiniMaxWithRetry).mockRejectedValue(new Error('MiniMax error'));
    vi.mocked(callDeepSeekWithRetry).mockRejectedValue(new Error('DeepSeek error'));

    const res = await POST(mockRequest({ inputText: '测试内容' }));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data._fallback).toBe(true);
    expect(Array.isArray(data.slides)).toBe(true);
    expect(data.slides.length).toBeGreaterThanOrEqual(3);
  });

  it('should prefer coffee scene theme and smart default image mode in smart mode even when AI suggests dark fallback theme', async () => {
    vi.mocked(callMiniMaxWithRetry).mockResolvedValueOnce(JSON.stringify({
      title: '咖啡介绍',
      scene: '通用',
      themeId: 'founder',
      tone: 'professional',
      imageMode: 'theme-img',
      slides: [{ title: '封面', content: ['测试'] }, { title: '结尾', content: ['完成'] }],
    }));

    const res = await POST(mockRequest({
      inputText: '请做一份咖啡文化介绍，5页',
      auto: true,
    }));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.scene).toBe('餐饮美食');
    expect(data.imageMode).toBe('web');
  });

  it('should recognize white minimal style and prefer howlite theme in smart mode', async () => {
    vi.mocked(callMiniMaxWithRetry).mockResolvedValueOnce(JSON.stringify({
      title: '省心PPT介绍',
      scene: '通用',
      themeId: 'consultant',
      tone: 'professional',
      imageMode: 'theme-img',
      slides: [{ title: '封面', content: ['测试'] }, { title: '结尾', content: ['完成'] }],
    }));

    const res = await POST(new Request('http://localhost/api/outline', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-forwarded-for': '127.0.0.9' },
      body: JSON.stringify({
        inputText: '介绍省心ppt 5页 白色简约风',
        auto: true,
      }),
    }) as unknown as NextRequest);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.themeId).toBe('howlite');
    expect(data.imageMode).toBe('theme-img');
  });

  it('should default to ai image mode for creative tech smart mode when user does not specify image source', async () => {
    vi.mocked(callMiniMaxWithRetry).mockResolvedValueOnce(JSON.stringify({
      title: 'AI 产品发布',
      scene: '通用',
      themeId: 'consultant',
      tone: 'professional',
      imageMode: 'theme-img',
      slides: [{ title: '封面', content: ['测试'] }, { title: '结尾', content: ['完成'] }],
    }));

    const res = await POST(new Request('http://localhost/api/outline', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-forwarded-for': '127.0.0.19' },
      body: JSON.stringify({
        inputText: '做一份 AI 新品发布介绍，5页，强调未来感',
        auto: true,
      }),
    }) as unknown as NextRequest);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.scene).toBe('科技AI');
    expect(data.imageMode).toBe('ai');
  });

  it('should honor smart mode requests from legacy mode=smart callers', async () => {
    vi.mocked(callMiniMaxWithRetry).mockResolvedValueOnce(JSON.stringify({
      title: '北京旅游完全指南',
      scene: '通用',
      themeId: 'consultant',
      tone: 'professional',
      imageMode: 'theme-img',
      slides: [{ title: '封面', content: ['测试'] }, { title: '结尾', content: ['完成'] }],
    }));

    const res = await POST(new Request('http://localhost/api/outline', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-forwarded-for': '127.0.0.29' },
      body: JSON.stringify({
        topic: '北京旅游完全指南',
        mode: 'smart',
        imageSource: 'smart',
        pages: 5,
      }),
    }) as unknown as NextRequest);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.scene).toBe('旅游出行');
    expect(data.themeId).toBe('finesse');
    expect(data.imageMode).toBe('web');
  });

  it('should treat explicit red theme requests as highest-priority smart mode intent', async () => {
    vi.mocked(callMiniMaxWithRetry).mockResolvedValueOnce(JSON.stringify({
      title: '北京文旅方案',
      scene: '旅游出行',
      themeId: 'howlite',
      tone: 'casual',
      imageMode: 'theme-img',
      slides: [{ title: '封面', content: ['测试'] }, { title: '结尾', content: ['完成'] }],
    }));

    const res = await POST(new Request('http://localhost/api/outline', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-forwarded-for': '127.0.0.39' },
      body: JSON.stringify({
        inputText: '做一份北京文旅推广方案，红色主题，8页',
        auto: true,
      }),
    }) as unknown as NextRequest);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.themeId).toBe('atmosphere');
    expect(data.meta.intent.themeLocked).toBe(true);
    expect(data.meta.intent.themeLabel).toBe('红色系');
  });

  it('should treat explicit blue theme requests as highest-priority smart mode intent', async () => {
    vi.mocked(callMiniMaxWithRetry).mockResolvedValueOnce(JSON.stringify({
      title: '城市发展方案',
      scene: '生活方式',
      themeId: 'howlite',
      tone: 'casual',
      imageMode: 'theme-img',
      slides: [{ title: '封面', content: ['测试'] }, { title: '结尾', content: ['完成'] }],
    }));

    const res = await POST(new Request('http://localhost/api/outline', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-forwarded-for': '127.0.0.49' },
      body: JSON.stringify({
        inputText: '做一份城市发展介绍，蓝色主题，5页',
        auto: true,
      }),
    }) as unknown as NextRequest);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.themeId).toBe('consultant');
    expect(data.meta.intent.themeLocked).toBe(true);
    expect(data.meta.intent.themeLabel).toBe('蓝色系');
  });

});
