// Kimi K2.5 API 客户端 — 默认首选模型
// 多模态 + 长上下文（128K），适合大纲生成、内容分析
// API 兼容 OpenAI 格式
// 文档: https://platform.moonshot.cn/docs

const KIMI_API_KEY = process.env.KIMI_API_KEY || '';
const KIMI_BASE = 'https://api.moonshot.cn/v1';

export interface KimiMessage {
  role: 'user' | 'assistant' | 'system';
  content: string | KimiContentPart[];
}

export interface KimiContentPart {
  type: 'text' | 'image_url';
  text?: string;
  image_url?: { url: string };
}

export interface KimiOptions {
  model?: string;
  maxTokens?: number;
  temperature?: number;
  system?: string;
  timeoutMs?: number;
}

/**
 * Kimi 文本调用（默认 K2.5）
 * - 128K 长上下文，适合长文档分析
 * - 多模态：支持图片理解（vision）
 */
export async function callKimi(
  messages: KimiMessage[],
  options: KimiOptions = {}
): Promise<string> {
  const {
    model = 'kimi-k2-0711',
    maxTokens = 8192,
    temperature = 0.7,
    system,
    timeoutMs = 60000,
  } = options;

  if (!KIMI_API_KEY) {
    throw new Error('Kimi API Key 未配置（KIMI_API_KEY）');
  }

  const apiMessages: KimiMessage[] = [];
  if (system) {
    apiMessages.push({ role: 'system', content: system });
  }
  apiMessages.push(...messages);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(`${KIMI_BASE}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${KIMI_API_KEY}`,
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
      console.error('Kimi API error:', response.status, errText);
      throw new Error(`Kimi API 调用失败: ${response.status}`);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;
    if (!content) throw new Error('Kimi 返回内容为空');
    return content;
  } catch (e: any) {
    clearTimeout(timeout);
    if (e.name === 'AbortError') throw new Error('Kimi 请求超时');
    throw e;
  }
}

/**
 * Kimi 图片理解（vision）
 */
export async function callKimiVision(
  imageBase64: string,
  mimeType: string,
  prompt: string,
  options: { maxTokens?: number; temperature?: number } = {}
): Promise<string> {
  const { maxTokens = 4096, temperature = 0.7 } = options;

  if (!KIMI_API_KEY) {
    throw new Error('Kimi API Key 未配置（KIMI_API_KEY）');
  }

  const response = await fetch(`${KIMI_BASE}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${KIMI_API_KEY}`,
    },
    body: JSON.stringify({
      model: 'kimi-k2-0711',
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
    console.error('Kimi Vision error:', response.status, errText);
    throw new Error(`Kimi Vision 调用失败: ${response.status}`);
  }

  const data = await response.json();
  return data.choices?.[0]?.message?.content || '';
}

/**
 * Kimi 联网搜索（通过 web_search tool）
 */
export async function callKimiWithSearch(
  prompt: string,
  searchContext: string,
  options: { maxTokens?: number; temperature?: number; system?: string } = {}
): Promise<string> {
  const { maxTokens = 8192, temperature = 0.7, system } = options;

  const messages: KimiMessage[] = [];
  if (system) {
    messages.push({ role: 'system', content: system });
  }

  if (searchContext) {
    messages.push({
      role: 'user',
      content: `${prompt}\n\n【搜索结果】\n${searchContext}\n\n请基于以上搜索结果回答。`,
    });
  } else {
    messages.push({ role: 'user', content: prompt });
  }

  return callKimi(messages, { maxTokens, temperature });
}
