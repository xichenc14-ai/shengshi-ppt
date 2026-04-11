// Kimi API 客户端 — 支持 K2.5(多模态+长上下文) + K2-thinking(深度推理)
// API 兼容 OpenAI 格式
// 文档: https://platform.kimi.ai/docs

const KIMI_API_KEY = process.env.KIMI_API_KEY || '';
const KIMI_BASE = process.env.KIMI_API_BASE || 'https://api.moonshot.ai/v1';

export type KimiModel = 'kimi-k2-0711' | 'kimi-k2-thinking' | 'kimi-k2.5';

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
  model?: KimiModel | string;
  maxTokens?: number;
  temperature?: number;
  system?: string;
  timeoutMs?: number;
  thinking?: boolean; // 启用 thinking 模式（仅 kimi-k2-thinking）
}

export interface KimiResult {
  content: string;
  reasoning?: string; // thinking 模式的推理过程
}

/**
 * Kimi 文本调用
 * - kimi-k2-0711: 标准模型，128K上下文，速度快
 * - kimi-k2-thinking: 深度推理，适合复杂需求分析、大纲结构规划
 * - kimi-k2.5: 最新多模态模型
 */
export async function callKimi(
  messages: KimiMessage[],
  options: KimiOptions = {}
): Promise<KimiResult> {
  const {
    model = 'kimi-k2-0711',
    maxTokens = 8192,
    temperature = 0.7,
    system,
    timeoutMs = 120000, // thinking 模型需要更长时间
  } = options;

  if (!KIMI_API_KEY) {
    throw new Error('Kimi API Key 未配置（KIMI_API_KEY）');
  }

  const apiMessages: KimiMessage[] = [];
  if (system) {
    apiMessages.push({ role: 'system', content: system });
  }
  apiMessages.push(...messages);

  // thinking 模型固定 temperature=1.0
  const finalTemp = model.includes('thinking') ? 1.0 : temperature;

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
        temperature: finalTemp,
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
    const choice = data.choices?.[0];
    const content = choice?.message?.content;
    const reasoning = choice?.message?.reasoning_content;

    if (!content) throw new Error('Kimi 返回内容为空');

    return { content, reasoning };
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
  options: { maxTokens?: number; temperature?: number; model?: string } = {}
): Promise<string> {
  const { maxTokens = 4096, temperature = 0.7, model = 'kimi-k2.5' } = options;

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
      model,
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
 * Kimi 联网搜索（通过上下文注入搜索结果）
 */
export async function callKimiWithSearch(
  prompt: string,
  searchContext: string,
  options: { maxTokens?: number; temperature?: number; system?: string; model?: KimiModel } = {}
): Promise<KimiResult> {
  const { maxTokens = 8192, temperature = 0.7, system, model } = options;

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

  return callKimi(messages, { maxTokens, temperature, model });
}
