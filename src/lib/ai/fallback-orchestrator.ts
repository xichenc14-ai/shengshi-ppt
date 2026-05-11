// src/lib/ai/fallback-orchestrator.ts
// v10.48: MiniMax + DeepSeek 双 Provider Fallback
//
// 架构决策: AI 服务支持 MiniMax（主） + DeepSeek（备）
// - MiniMax 优先，失败后切换 DeepSeek
// - DeepSeek 失败后切换 MiniMax 重试

import { callMiniMaxWithRetry } from '@/lib/minimax-client';
import { callDeepSeekWithRetry } from '@/lib/deepseek-client';

// Minimal message type — matches OpenAI ChatCompletionMessageParam shape
type OpenAIMessage = {
  role: 'system' | 'user' | 'assistant';
  content: string;
};

// === Types ===

export type FallbackProvider = 'minimax' | 'deepseek';
export type FallbackErrorClass = 'Timeout' | 'RateLimit' | 'ServerError' | 'AuthError' | 'BadRequest' | 'NetworkError';
export type FallbackErrorCode = 'NETWORK_ERROR' | 'TIMEOUT' | 'RATE_LIMIT' | 'SERVER_ERROR' | 'ALL_PROVIDERS_FAILED';

export interface FallbackAttempt {
  provider: FallbackProvider;
  success: boolean;
  durationMs: number;
  errorClass?: FallbackErrorClass;
  statusCode?: number;
  data?: string;
  error?: unknown;
}

export interface FallbackResult {
  ok: boolean;
  provider?: FallbackProvider;
  data?: string;
  attempts: FallbackAttempt[];
  error?: {
    code: FallbackErrorCode;
    message: string;
  };
}

export interface FallbackOptions {
  systemPrompt: string;
  userPrompt: string;
  taskType: string;
  promptMessages?: never;
}

// === Constants ===

const MAX_RETRIES = 2;
const BASE_TIMEOUT_MS = 30_000;
const RETRY_DELAY_MS = 2_000;

// === Helper Functions ===

function buildMessages(systemPrompt: string, userPrompt: string): OpenAIMessage[] {
  return [
    { role: 'system', content: systemPrompt },
    { role: 'user',   content: userPrompt },
  ];
}

function classifyError(e: unknown, statusCode?: number): FallbackErrorClass {
  if (statusCode === 401 || statusCode === 403) return 'AuthError';
  if (statusCode === 400) return 'BadRequest';
  if (statusCode === 429) return 'RateLimit';
  if (statusCode && statusCode >= 500) return 'ServerError';
  if (e instanceof DOMException && e.name === 'AbortError') return 'Timeout';
  if (e instanceof Error && e.name === 'AbortError') return 'Timeout';
  return 'NetworkError';
}

function extractStatusCode(e: unknown): number | undefined {
  if (e instanceof Error) {
    const match = e.message.match(/\b(\d{3})\b/);
    if (match) return parseInt(match[1], 10);
  }
  return undefined;
}

function sanitizeAttempt(attempt: FallbackAttempt): FallbackAttempt {
  const { data: _data, error: _error, ...rest } = attempt;
  return rest;
}

// === Core Function ===

export async function callWithFallback(
  options: FallbackOptions
): Promise<FallbackResult> {
  const requestId = typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const startTime = Date.now();
  const attempts: FallbackAttempt[] = [];
  const messages = buildMessages(options.systemPrompt, options.userPrompt);

  // 尝试顺序：MiniMax → DeepSeek → MiniMax 重试
  const providers: FallbackProvider[] = ['minimax', 'deepseek', 'minimax'];
  let lastError: unknown;
  let lastStatusCode: number | undefined;
  let finalProvider: FallbackProvider | null = null;

  for (const provider of providers) {
    const attemptStart = Date.now();
    const timeoutMs = BASE_TIMEOUT_MS;

    try {
      const data = provider === 'minimax'
        ? await callMiniMaxWithRetry(messages, { timeoutMs, maxRetries: 0 })
        : await callDeepSeekWithRetry(messages, { timeoutMs, maxRetries: 0 });

      const durationMs = Date.now() - attemptStart;
      const fallbackAttempt: FallbackAttempt = {
        provider,
        success: true,
        durationMs,
        data,
      };
      attempts.push(fallbackAttempt);
      finalProvider = provider;

      console.log(`[fallback-orchestrator] ${provider} 成功，耗时 ${durationMs}ms`);

      return {
        ok: true,
        provider,
        data,
        attempts,
      };
    } catch (e: unknown) {
      lastError = e;
      const durationMs = Date.now() - attemptStart;
      const statusCode = extractStatusCode(e);
      lastStatusCode = statusCode;
      const errorClass = classifyError(e, statusCode);

      console.warn(`[fallback-orchestrator] ${provider} 失败:`, e instanceof Error ? e.message : String(e));

      attempts.push({
        provider,
        success: false,
        durationMs,
        errorClass,
        statusCode,
        error: e,
      });

      // 认证错误不重试
      if (errorClass === 'AuthError' || errorClass === 'BadRequest') {
        break;
      }
    }
  }

  // 全部失败
  const finalErrorCode: FallbackErrorCode =
    lastError instanceof Error && lastError.name === 'AbortError' ? 'TIMEOUT' :
    lastStatusCode === 429 ? 'RATE_LIMIT' :
    (lastStatusCode ?? 0) >= 500 ? 'SERVER_ERROR' : 'ALL_PROVIDERS_FAILED';

  return {
    ok: false,
    attempts,
    error: {
      code: finalErrorCode,
      message: lastError instanceof Error ? lastError.message : '抱歉，AI服务暂时繁忙，请稍后再试',
    },
  };
}
