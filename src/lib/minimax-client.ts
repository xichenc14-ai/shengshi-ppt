// MiniMax API 客户端 - 设为默认模型（支持图片理解 + 联网搜索）
// Base URL: https://api.minimaxi.com (与 OpenClaw 共用 key)

const MINIMAX_API_KEY = process.env.MINIMAX_API_KEY || '';

// MiniMax 的 API 格式兼容 OpenAI，同时支持 vision
const MINIMAX_BASE = 'https://api.minimaxi.com/v1';

export interface MiniMaxMessage {
  role: 'user' | 'assistant' | 'system';
  content: string | MiniMaxContentPart[];
}

export interface MiniMaxContentPart {
  type: 'text' | 'image_url';
  text?: string;
  image_url?: { url: string };
}

export interface MiniMaxOptions {
  model?: string;
  maxTokens?: number;
  temperature?: number;
  system?: string;
  timeoutMs?: number;
}

/**
 * MiniMax 文本+图片 统一调用
 * - 支持纯文本对话
 * - 支持图片理解（vision）
 * - 支持联网搜索（通过 enhanced_parameters）
 */
export async function callMiniMax(
  messages: MiniMaxMessage[],
  options: MiniMaxOptions = {}
): Promise<string> {
  const {
    model = 'MiniMax-M2.7',
    maxTokens = 8192,
    temperature = 0.7,
    system,
    timeoutMs = 60000,
  } = options;

  if (!MINIMAX_API_KEY) {
    throw new Error('MiniMax API Key 未配置（MINIMAX_API_KEY）');
  }

  // 构建 messages（支持 vision）
  const apiMessages: MiniMaxMessage[] = [];
  if (system) {
    apiMessages.push({ role: 'system', content: system });
  }
  apiMessages.push(...messages);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(`${MINIMAX_BASE}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${MINIMAX_API_KEY}`,
      },
      body: JSON.stringify({
        model,
        messages: apiMessages,
        max_tokens: maxTokens,
        temperature,
      }),
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (!response.ok) {
      const errText = await response.text();
      console.error('MiniMax API error:', response.status, errText);
      throw new Error(`MiniMax API 调用失败: ${response.status}`);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;
    if (!content) throw new Error('MiniMax 返回内容为空');
    return content;
  } catch (e: any) {
    clearTimeout(timeout);
    if (e.name === 'AbortError') throw new Error('MiniMax 请求超时');
    throw e;
  }
}

/**
 * MiniMax 图片理解（vision）
 */
export async function callMiniMaxVision(
  imageBase64: string,
  mimeType: string,
  prompt: string,
  options: { maxTokens?: number; temperature?: number } = {}
): Promise<string> {
  const { maxTokens = 4096, temperature = 0.7 } = options;

  if (!MINIMAX_API_KEY) {
    throw new Error('MiniMax API Key 未配置（MINIMAX_API_KEY）');
  }

  const response = await fetch(`${MINIMAX_BASE}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${MINIMAX_API_KEY}`,
    },
    body: JSON.stringify({
      model: 'MiniMax-VL-01',
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'image_url',
              image_url: {
                url: `data:${mimeType};base64,${imageBase64}`,
              },
            },
            { type: 'text', text: prompt },
          ],
        },
      ],
      max_tokens: maxTokens,
      temperature,
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    console.error('MiniMax Vision error:', response.status, errText);
    throw new Error(`MiniMax Vision 调用失败: ${response.status}`);
  }

  const data = await response.json();
  return data.choices?.[0]?.message?.content || '';
}

/**
 * MiniMax 联网搜索（通过 enhanced_parameters）
 * 使用 MiniMax 内置的联网搜索能力
 */
export async function callMiniMaxWithSearch(
  prompt: string,
  searchContext: string,
  options: { maxTokens?: number; temperature?: number; system?: string } = {}
): Promise<string> {
  const { maxTokens = 8192, temperature = 0.7, system } = options;

  if (!MINIMAX_API_KEY) {
    throw new Error('MiniMax API Key 未配置（MINIMAX_API_KEY）');
  }

  const messages: MiniMaxMessage[] = [];
  if (system) {
    messages.push({ role: 'system', content: system });
  }

  // 将搜索结果作为上下文注入
  if (searchContext) {
    messages.push({
      role: 'user',
      content: `${prompt}\n\n【搜索结果】\n${searchContext}\n\n请基于以上搜索结果回答。`,
    });
  } else {
    messages.push({ role: 'user', content: prompt });
  }

  return callMiniMax(messages, { maxTokens, temperature });
}

export { MINIMAX_API_KEY };
