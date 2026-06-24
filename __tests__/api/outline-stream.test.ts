import { afterEach, describe, expect, it, vi } from 'vitest';
import type { NextRequest } from 'next/server';
import { POST } from '@/app/api/outline/stream/route';

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('POST /api/outline/stream', () => {
  it('forwards session cookies and completes the NDJSON stream cleanly', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      title: '测试大纲',
      slides: [{ id: 's1', title: '封面', content: ['要点'] }],
      themeId: 'consultant',
      tone: 'professional',
      imageMode: 'theme-img',
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    }));
    vi.stubGlobal('fetch', fetchMock);

    const request = new Request('http://localhost/api/outline/stream', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        cookie: 'shengxin_session=test-session',
        'x-forwarded-for': '127.0.0.1',
      },
      body: JSON.stringify({
        inputText: '生成8页商务汇报',
        userInstruction: '生成8页商务汇报',
        slideCount: 8,
      }),
    }) as unknown as NextRequest;

    const response = await POST(request);
    expect(response.status).toBe(200);
    const events = (await response.text())
      .trim()
      .split('\n')
      .map((line) => JSON.parse(line));

    expect(events.some((event) => event.type === 'complete')).toBe(true);
    expect(fetchMock).toHaveBeenCalledOnce();
    const options = fetchMock.mock.calls[0]?.[1] as RequestInit;
    expect((options.headers as Record<string, string>).cookie).toBe('shengxin_session=test-session');
  });

  it('emits an error instead of synthesizing an outline from internal prompt wrappers', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({
      error: 'AI 大纲服务暂时不可用，未生成任何大纲，请稍后重试',
      code: 'OUTLINE_AI_UNAVAILABLE',
    }), {
      status: 503,
      headers: { 'Content-Type': 'application/json' },
    })));

    const response = await POST(new Request('http://localhost/api/outline/stream', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        inputText: '【用户文本框声明｜最高优先级】\n商务年会\n【附件素材｜仅作为事实与内容参考】',
        userInstruction: '商务年会',
        slideCount: 3,
      }),
    }) as unknown as NextRequest);

    const events = (await response.text()).trim().split('\n').map((line) => JSON.parse(line));
    expect(events.some((event) => event.type === 'error')).toBe(true);
    expect(events.some((event) => event.type === 'complete')).toBe(false);
    expect(JSON.stringify(events)).not.toContain('主题聚焦');
  });
});
