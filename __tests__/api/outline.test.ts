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
      imageMode: 'webFreeToUseCommercially',
      slides: [{ title: '封面', content: ['测试'] }, { title: '结尾', content: ['完成'] }],
    }));
    const res = await POST(mockRequest({ inputText: '测试内容' }));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.imageMode).toBe('web');
  });

  it('should fallback noImages style aliases to theme-img', async () => {
    vi.mocked(callMiniMaxWithRetry).mockResolvedValueOnce(JSON.stringify({
      title: '无图回退',
      scene: '商务汇报',
      themeId: 'consultant',
      tone: 'professional',
      imageMode: 'noImages',
      slides: [{ title: '封面', content: ['测试'] }, { title: '结尾', content: ['完成'] }],
    }));
    const res = await POST(mockRequest({ inputText: '测试内容' }));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.imageMode).toBe('theme-img');
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

  it('should prefer coffee scene theme and keep smart default theme-img in smart mode even when AI suggests dark fallback theme', async () => {
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
    expect(data.themeId).toBe('finesse');
    expect(data.imageMode).toBe('theme-img');
  });

});
