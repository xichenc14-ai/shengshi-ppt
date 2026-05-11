// src/lib/ai/fallback-orchestrator.ts
// v10.50: MiniMax + DeepSeek 双 Provider Fallback（默认 DeepSeek）
//
// 架构决策: AI 服务支持 MiniMax（主） + DeepSeek（备）
// - 默认 DeepSeek 优先，失败后切换 MiniMax
// - 可通过 OUTLINE_PRIMARY_PROVIDER / AI_PRIMARY_PROVIDER 覆盖优先级

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

const BASE_TIMEOUT_MS = 30_000;
const PROVIDER_RETRIES = 2;

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

function normalizeProvider(raw: string | undefined): FallbackProvider | null {
  if (!raw) return null;
  const value = raw.toLowerCase().trim();
  if (value === 'minimax') return 'minimax';
  if (value === 'deepseek') return 'deepseek';
  return null;
}

function isProviderConfigured(provider: FallbackProvider): boolean {
  if (process.env.NODE_ENV === 'test' || process.env.VITEST) return true;
  if (provider === 'minimax') return Boolean((process.env.MINIMAX_API_KEY || '').trim());
  const singleDeepSeek = (process.env.DEEPSEEK_API_KEY || '').trim();
  const deepSeekPool = (process.env.DEEPSEEK_API_KEYS || '')
    .split(',')
    .map((k) => k.trim())
    .filter(Boolean);
  return Boolean(singleDeepSeek || deepSeekPool[0]);
}

function buildProviderOrder(): FallbackProvider[] {
  // 支持通过环境变量切换主模型：
  // OUTLINE_PRIMARY_PROVIDER=deepseek|minimax（推荐）
  // AI_PRIMARY_PROVIDER=deepseek|minimax（兼容别名）
  const preferred =
    normalizeProvider(process.env.OUTLINE_PRIMARY_PROVIDER)
    || normalizeProvider(process.env.AI_PRIMARY_PROVIDER)
    || 'deepseek'; // 默认改为 DeepSeek（用户要求）

  const secondary: FallbackProvider = preferred === 'deepseek' ? 'minimax' : 'deepseek';
  return [preferred, secondary, preferred];
}

// === Core Function ===

export async function callWithFallback(
  options: FallbackOptions
): Promise<FallbackResult> {
  const attempts: FallbackAttempt[] = [];
  const messages = buildMessages(options.systemPrompt, options.userPrompt);

  // 尝试顺序：主模型 → 备用模型 → 主模型重试
  const providers = buildProviderOrder();
  let lastError: unknown;
  let lastStatusCode: number | undefined;

  for (const provider of providers) {
    const attemptStart = Date.now();
    const timeoutMs = BASE_TIMEOUT_MS;

    if (!isProviderConfigured(provider)) {
      const msg = `${provider} API Key 未配置，跳过`;
      attempts.push({
        provider,
        success: false,
        durationMs: 0,
        errorClass: 'AuthError',
        error: msg,
      });
      lastError = new Error(msg);
      console.warn(`[fallback-orchestrator] ${msg}`);
      continue;
    }

    try {
      const data = provider === 'minimax'
        ? await callMiniMaxWithRetry(messages, { timeoutMs, maxRetries: PROVIDER_RETRIES })
        : await callDeepSeekWithRetry(messages, { timeoutMs, maxRetries: PROVIDER_RETRIES });

      const durationMs = Date.now() - attemptStart;
      const fallbackAttempt: FallbackAttempt = {
        provider,
        success: true,
        durationMs,
        data,
      };
      attempts.push(fallbackAttempt);

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
