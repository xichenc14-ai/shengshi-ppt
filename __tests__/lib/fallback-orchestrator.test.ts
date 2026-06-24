import { beforeEach, describe, expect, it, vi } from 'vitest';

const { callMiniMaxWithRetry, callDeepSeekWithRetry } = vi.hoisted(() => ({
  callMiniMaxWithRetry: vi.fn(),
  callDeepSeekWithRetry: vi.fn(),
}));

vi.mock('@/lib/minimax-client', () => ({
  callMiniMaxWithRetry,
}));

vi.mock('@/lib/deepseek-client', () => ({
  callDeepSeekWithRetry,
}));

import { callWithFallback } from '@/lib/ai/fallback-orchestrator';

describe('fallback-orchestrator', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.MINIMAX_API_KEY = 'mini-key';
    process.env.DEEPSEEK_API_KEY = 'deep-key';
    delete process.env.DEEPSEEK_API_KEYS;
    delete process.env.OUTLINE_PRIMARY_PROVIDER;
    delete process.env.AI_PRIMARY_PROVIDER;
  });

  it('uses minimax as default primary provider', async () => {
    callMiniMaxWithRetry.mockResolvedValueOnce('minimax ok');

    const result = await callWithFallback({
      systemPrompt: 'sys',
      userPrompt: 'user',
      taskType: 'outline',
    });

    expect(result.ok).toBe(true);
    expect(result.provider).toBe('minimax');
    expect(callMiniMaxWithRetry).toHaveBeenCalledTimes(1);
    expect(callDeepSeekWithRetry).not.toHaveBeenCalled();

    const options = callMiniMaxWithRetry.mock.calls[0][1];
    expect(options.maxRetries).toBe(2);
    expect(options.timeoutMs).toBe(30000);
  });

  it('accepts deepseek key from DEEPSEEK_API_KEYS pool when explicitly selected', async () => {
    delete process.env.DEEPSEEK_API_KEY;
    process.env.DEEPSEEK_API_KEYS = 'pool-key-1,pool-key-2';
    process.env.OUTLINE_PRIMARY_PROVIDER = 'deepseek';
    callDeepSeekWithRetry.mockResolvedValueOnce('deepseek pool ok');

    const result = await callWithFallback({
      systemPrompt: 'sys',
      userPrompt: 'user',
      taskType: 'outline',
    });

    expect(result.ok).toBe(true);
    expect(result.provider).toBe('deepseek');
    expect(callDeepSeekWithRetry).toHaveBeenCalledTimes(1);
  });

  it('falls back to minimax when explicitly selected deepseek fails', async () => {
    process.env.OUTLINE_PRIMARY_PROVIDER = 'deepseek';
    callDeepSeekWithRetry.mockRejectedValueOnce(new Error('DeepSeek API 失败: 500'));
    callMiniMaxWithRetry.mockResolvedValueOnce('minimax ok');

    const result = await callWithFallback({
      systemPrompt: 'sys',
      userPrompt: 'user',
      taskType: 'outline',
    });

    expect(result.ok).toBe(true);
    expect(result.provider).toBe('minimax');
    expect(callDeepSeekWithRetry).toHaveBeenCalledTimes(1);
    expect(callMiniMaxWithRetry).toHaveBeenCalledTimes(1);
  });

  it('still tries backup provider on auth error', async () => {
    process.env.OUTLINE_PRIMARY_PROVIDER = 'deepseek';
    callDeepSeekWithRetry.mockRejectedValueOnce(new Error('DeepSeek API 失败: 401'));
    callMiniMaxWithRetry.mockResolvedValueOnce('minimax ok');

    const result = await callWithFallback({
      systemPrompt: 'sys',
      userPrompt: 'user',
      taskType: 'outline',
    });

    expect(result.ok).toBe(true);
    expect(result.provider).toBe('minimax');
    expect(callDeepSeekWithRetry).toHaveBeenCalledTimes(1);
    expect(callMiniMaxWithRetry).toHaveBeenCalledTimes(1);
  });

  it('skips unconfigured provider and uses configured one', async () => {
    const env = process.env as Record<string, string | undefined>;
    const oldNodeEnv = process.env.NODE_ENV;
    const oldVitest = process.env.VITEST;
    env.NODE_ENV = 'production';
    delete env.VITEST;
    delete env.DEEPSEEK_API_KEY;
    env.MINIMAX_API_KEY = 'mini-key';
    callMiniMaxWithRetry.mockResolvedValueOnce('minimax ok');

    try {
      const result = await callWithFallback({
        systemPrompt: 'sys',
        userPrompt: 'user',
        taskType: 'outline',
      });

      expect(result.ok).toBe(true);
      expect(result.provider).toBe('minimax');
      expect(callDeepSeekWithRetry).not.toHaveBeenCalled();
      expect(callMiniMaxWithRetry).toHaveBeenCalledTimes(1);
    } finally {
      env.NODE_ENV = oldNodeEnv;
      if (oldVitest === undefined) {
        delete env.VITEST;
      } else {
        env.VITEST = oldVitest;
      }
    }
  });
});
