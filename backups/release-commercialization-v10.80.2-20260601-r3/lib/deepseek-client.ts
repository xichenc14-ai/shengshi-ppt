// DeepSeek API 客户端 - 备用方案
import { normalizeProviderKey, parseProviderKeyPool } from '@/lib/ai/provider-key';

function resolveDeepSeekApiKey(): string {
  const single = normalizeProviderKey(process.env.DEEPSEEK_API_KEY);
  if (single) return single;

  const pool = parseProviderKeyPool(process.env.DEEPSEEK_API_KEYS);
  return pool[0] || '';
}

const DEEPSEEK_API_KEY = resolveDeepSeekApiKey();
const DEEPSEEK_BASE = 'https://api.deepseek.com/v1';

export interface DeepSeekMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export async function callDeepSeek(
  messages: DeepSeekMessage[],
  options: {
    model?: string;
    maxTokens?: number;
    temperature?: number;
    timeoutMs?: number;
  } = {}
): Promise<string> {
  const {
    model = 'deepseek-chat',
    maxTokens = 8192,
    temperature = 0.7,
    timeoutMs = 60000,
  } = options;

  if (!DEEPSEEK_API_KEY) {
    throw new Error('DeepSeek API Key 未配置（DEEPSEEK_API_KEY）');
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(`${DEEPSEEK_BASE}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${DEEPSEEK_API_KEY}`,
      },
      body: JSON.stringify({
        model,
        messages,
        max_tokens: maxTokens,
        temperature,
      }),
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (!response.ok) {
      const errText = await response.text();
      console.error('DeepSeek API error:', response.status, errText);
      throw new Error(`DeepSeek API 失败: ${response.status}`);
    }

    const data = await response.json();
    return data.choices?.[0]?.message?.content || '';
  } finally {
    clearTimeout(timeout);
  }
}

export async function callDeepSeekWithRetry(
  messages: DeepSeekMessage[],
  options: {
    maxRetries?: number;
    retryDelayMs?: number;
    timeoutMs?: number;
    model?: string;
    maxTokens?: number;
    temperature?: number;
  } = {}
): Promise<string> {
  const { maxRetries = 3, retryDelayMs = 1000, timeoutMs = 30000, ...rest } = options;
  const startTime = Date.now();

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const result = await callDeepSeek(messages, { ...rest, timeoutMs });
      console.log(`[DeepSeek] 尝试 ${attempt}/${maxRetries} 成功，耗时 ${Date.now() - startTime}ms`);
      return result;
    } catch (e: unknown) {
      const elapsed = Date.now() - startTime;
      const errorMessage = getErrorMessage(e);
      const errorName = e instanceof Error ? e.name : '';
      console.error(`[DeepSeek] 尝试 ${attempt}/${maxRetries} 失败:`, errorMessage, `耗时 ${elapsed}ms`);

      if (errorMessage.includes('429') || errorMessage.includes('过载') || errorName === 'AbortError') {
        if (attempt < maxRetries) {
          const delay = retryDelayMs * attempt;
          console.log(`[DeepSeek] 等待 ${delay}ms 后重试...`);
          await new Promise(r => setTimeout(r, delay));
          continue;
        }
      }

      throw e;
    }
  }

  throw new Error('DeepSeek 所有重试均失败');
}
