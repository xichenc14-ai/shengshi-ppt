// GLM API 多 Key 轮询 + 模型智能调度
// Key 从环境变量读取，逗号分隔：GLM_API_KEYS=key1,key2,key3

const API_KEYS = (process.env.GLM_API_KEYS || '').split(',').filter(Boolean);

const API_BASE = process.env.GLM_API_BASE || 'https://mydamoxing.cn/v1/chat/completions';

// Key 轮询计数器
let keyIndex = 0;

function getNextKey(): string {
  const key = API_KEYS[keyIndex % API_KEYS.length];
  keyIndex++;
  return key;
}

// 模型选择策略：
// glm-5: 最快(15s)，无reasoning，适合简单任务/需要速度的场景
// glm-5-turbo: 较快(19s)，有reasoning(743 tokens)，性价比最佳
// glm-5.1: 最强(53s)，有深度reasoning(1193 tokens)，适合复杂任务
type TaskType = 'outline' | 'search_judge' | 'simple';

const MODEL_MAP: Record<TaskType, { model: string; maxTokens: number; temperature: number }> = {
  // 大纲生成：用 turbo，速度快质量好
  outline: { model: 'glm-5', maxTokens: 8192, temperature: 0.7 },
  // AI 搜索判断：用 glm-5，最快，不需要深度推理
  search_judge: { model: 'glm-5', maxTokens: 2048, temperature: 0.3 },
  // 简单任务：用 glm-5
  simple: { model: 'glm-5', maxTokens: 2048, temperature: 0.7 },
};

export async function callGLM(
  systemPrompt: string,
  userPrompt: string,
  taskType: TaskType = 'outline',
  retries = 3,
  timeoutMs = 30000
): Promise<string> {
  const config = MODEL_MAP[taskType] || MODEL_MAP.outline;

  for (let attempt = 0; attempt < retries; attempt++) {
    const key = getNextKey();
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetch(API_BASE, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${key}`,
        },
        signal: controller.signal,
        body: JSON.stringify({
          model: config.model,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt },
          ],
          temperature: config.temperature,
          max_tokens: config.maxTokens,
        }),
      });
      clearTimeout(timeout);
      if (!response.ok) {
        const errText = await response.text();
        console.warn(`GLM ${config.model} attempt ${attempt + 1} failed: ${response.status} ${errText}`);
        if (attempt < retries - 1) await new Promise(r => setTimeout(r, 1000 * (attempt + 1)));
        continue;
      }

      const data = await response.json();
      const content = data.choices?.[0]?.message?.content;
      if (!content) {
        console.warn(`GLM ${config.model} returned empty content`);
        if (attempt < retries - 1) continue;
        throw new Error('AI返回内容为空');
      }

      return content;
    } catch (e) {
      clearTimeout(timeout);
      console.warn(`GLM ${config.model} attempt ${attempt + 1} error:`, e);
      if (attempt < retries - 1) await new Promise(r => setTimeout(r, 1000 * (attempt + 1)));
    }
  }

  throw new Error(`AI调用失败（已重试${retries}次）`);
}

// 导出配置供其他模块使用
export { API_KEYS, API_BASE, MODEL_MAP };
export type { TaskType };
