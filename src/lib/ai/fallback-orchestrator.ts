// src/lib/ai/fallback-orchestrator.ts
// P1-C Cross-Provider Fallback Orchestrator
// Chain: GLM(15s) → MiniMax(8s) → Kimi(30s)

import { callGLM } from '@/lib/glm-client';
import type { TaskType } from '@/lib/glm-client';
import { callMiniMaxWithRetry } from '@/lib/minimax-client';
import { callKimi } from '@/lib/kimi-client';
// Minimal message type — matches OpenAI ChatCompletionMessageParam shape
// No external openai dependency required
type OpenAIMessage = {
  role: 'system' | 'user' | 'assistant';
  content: string;
};

export type FallbackProvider = 'glm' | 'minimax' | 'kimi';

export type FallbackErrorClass =
  | 'Timeout'
  | 'RateLimit'
  | 'ServerError'
  | 'AuthError'
  | 'BadRequest'
  | 'NetworkError';

export type FallbackErrorCode =
  | 'NETWORK_ERROR'
  | 'TIMEOUT'
  | 'RATE_LIMIT'
  | 'SERVER_ERROR'
  | 'ALL_PROVIDERS_FAILED';

export interface FallbackAttempt {
  provider: FallbackProvider;
  success: boolean;
  durationMs: number;
  errorClass?: FallbackErrorClass;
  statusCode?: number;
  data?: string; // only present when success=true
  error?: unknown; // internal only — NOT exposed to user or logged
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
  taskType: TaskType;
  promptMessages?: never; // explicitly forbidden
}

interface ProviderConfig {
  provider: FallbackProvider;
  timeoutMs: number;
}

interface FallbackLogEvent {
  timestamp: string;
  requestId: string;
  attempts: FallbackAttempt[];
  finalProvider: FallbackProvider | null;
  ok: boolean;
  totalLatencyMs: number;
}

const FALLBACK_CHAIN: readonly ProviderConfig[] = [
  { provider: 'glm',     timeoutMs: 15_000 },
  { provider: 'minimax', timeoutMs: 8_000  },
  { provider: 'kimi',    timeoutMs: 30_000  },
] as const;

// === Helper Functions ===

function buildMessages(systemPrompt: string, userPrompt: string): OpenAIMessage[] {
  return [
    { role: 'system', content: systemPrompt },
    { role: 'user',   content: userPrompt },
  ];
}

function extractStatusCode(e: unknown): number | undefined {
  if (e && typeof e === 'object') {
    if ('status' in e && typeof (e as Record<string, unknown>).status === 'number') {
      return (e as { status: number }).status;
    }
    if ('error' in e && e.error && typeof e.error === 'object') {
      const err = e.error as Record<string, unknown>;
      if (typeof err.status === 'number') return err.status as number;
    }
  }
  return undefined;
}

function classifyError(
  e: unknown,
  statusCode?: number
): { errorClass: FallbackErrorClass; doFallback: boolean } {
  if (statusCode === 401 || statusCode === 403) {
    return { errorClass: 'AuthError', doFallback: false };
  }
  if (statusCode === 400) {
    return { errorClass: 'BadRequest', doFallback: false };
  }
  if (statusCode === 429) {
    return { errorClass: 'RateLimit', doFallback: true };
  }
  if (statusCode && statusCode >= 500) {
    return { errorClass: 'ServerError', doFallback: true };
  }
  if (e instanceof DOMException && e.name === 'AbortError') {
    return { errorClass: 'Timeout', doFallback: true };
  }
  if (e instanceof Error && e.name === 'AbortError') {
    return { errorClass: 'Timeout', doFallback: true };
  }
  return { errorClass: 'NetworkError', doFallback: true };
}

function shouldFallback(errorClass: FallbackErrorClass): boolean {
  return errorClass !== 'AuthError' && errorClass !== 'BadRequest';
}

function deriveFinalErrorCode(attempts: FallbackAttempt[]): FallbackErrorCode {
  const last = attempts[attempts.length - 1];
  if (!last) return 'ALL_PROVIDERS_FAILED';

  switch (last.errorClass) {
    case 'Timeout':    return 'TIMEOUT';
    case 'RateLimit':  return 'RATE_LIMIT';
    case 'ServerError':
    case 'NetworkError':
    case 'BadRequest':
      return 'SERVER_ERROR';
    case 'AuthError':
      return 'NETWORK_ERROR';
    default:
      return 'ALL_PROVIDERS_FAILED';
  }
}

function sanitizeAttempt(attempt: FallbackAttempt): FallbackAttempt {
  // Strip data (contains upstream AI content) and error (contains raw upstream error)
  // Both could leak sensitive context — neither is needed in logs
  const { data: _data, error: _error, ...rest } = attempt;
  return rest;
}

function logFallbackEvent(event: FallbackLogEvent): void {
  console.log('[fallback-orchestrator]', JSON.stringify(event));
}

// === Core Functions ===

async function invokeProvider(
  config: ProviderConfig,
  options: FallbackOptions
): Promise<FallbackAttempt> {
  const start = Date.now();

  try {
    let data: string;

    if (config.provider === 'glm') {
      data = await callGLM(
        options.systemPrompt,
        options.userPrompt,
        options.taskType,
        1,
        config.timeoutMs
      );
    } else if (config.provider === 'minimax') {
      data = await callMiniMaxWithRetry(
        buildMessages(options.systemPrompt, options.userPrompt),
        {
          timeoutMs: config.timeoutMs,
          maxRetries: 1,
          retryDelayMs: 1000,
        }
      );
    } else {
      // kimi
      const result = await callKimi(
        buildMessages(options.systemPrompt, options.userPrompt),
        { timeoutMs: config.timeoutMs }
      );
      data = result.content;
    }

    return {
      provider: config.provider,
      success: true,
      durationMs: Date.now() - start,
      data,
    };
  } catch (e: unknown) {
    const durationMs = Date.now() - start;
    const statusCode = extractStatusCode(e);
    const { errorClass } = classifyError(e, statusCode);

    return {
      provider: config.provider,
      success: false,
      durationMs,
      errorClass,
      statusCode,
      error: e,  // captured for classifyError, stripped before any output
    };
  }
}

export async function callWithFallback(
  options: FallbackOptions
): Promise<FallbackResult> {
  const requestId =
    typeof crypto !== 'undefined' && crypto.randomUUID
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const startTime = Date.now();
  const attempts: FallbackAttempt[] = [];

  for (const config of FALLBACK_CHAIN) {
    const attempt = await invokeProvider(config, options);
    attempts.push(attempt);

    if (attempt.success) {
      logFallbackEvent({
        timestamp: new Date().toISOString(),
        requestId,
        attempts: attempts.map(sanitizeAttempt),
        finalProvider: config.provider,
        ok: true,
        totalLatencyMs: Date.now() - startTime,
      });

      return {
        ok: true,
        provider: config.provider,
        data: attempt.data,
        attempts,
      };
    }

    const { errorClass } = classifyError(attempt.error, attempt.statusCode);
    if (!shouldFallback(errorClass)) {
      break;
    }
  }

  const finalErrorCode = deriveFinalErrorCode(attempts);

  logFallbackEvent({
    timestamp: new Date().toISOString(),
    requestId,
    attempts: attempts.map(sanitizeAttempt),
    finalProvider: null,
    ok: false,
    totalLatencyMs: Date.now() - startTime,
  });

  return {
    ok: false,
    attempts,
    error: {
      code: finalErrorCode,
      message: '抱歉，AI服务暂时繁忙，请稍后再试',
    },
  };
}
