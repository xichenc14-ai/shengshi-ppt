// Gamma API 客户端
// 文档: https://developers.gamma.app

const GAMMA_API_BASE = 'https://public-api.gamma.app/v1.0';

export interface GammaGenerationRequest {
  inputText: string;
  textMode: 'generate' | 'condense' | 'preserve';
  format: 'presentation' | 'document' | 'webpage' | 'social';
  numCards?: number;
  exportAs?: 'pdf' | 'pptx' | 'png';
  themeId?: string;
  imageOptions?: {
    source: 'aiGenerated' | 'webFreeToUseCommercially' | 'noImages';
  };
  textOptions?: {
    tone?: string;
    audience?: string;
    language?: string;
  };
  sharingOptions?: {
    accessLevel?: 'workspace' | 'anyone_with_link' | 'anyone_on_internet';
  };
  folderIds?: string[];
}

export interface GammaGeneration {
  id: string;
  status: 'processing' | 'completed' | 'failed';
  gammaUrl?: string;
  exportUrl?: string;
  title?: string;
  error?: string;
}

export interface GammaTheme {
  id: string;
  name: string;
  description?: string;
}

// 创建生成任务
export async function createGeneration(
  apiKey: string,
  params: GammaGenerationRequest
): Promise<string> {
  const response = await fetch(`${GAMMA_API_BASE}/generations`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-API-KEY': apiKey,
    },
    body: JSON.stringify(params),
  });

  if (!response.ok) {
    const errText = await response.text();
    console.error('Gamma API error:', response.status, errText);
    throw new Error(`Gamma API 调用失败: ${response.status} ${errText}`);
  }

  const data = await response.json();
  return data.generationId || data.id;
}

// 查询生成状态
export async function getGeneration(
  apiKey: string,
  generationId: string
): Promise<GammaGeneration> {
  const response = await fetch(`${GAMMA_API_BASE}/generations/${generationId}`, {
    headers: {
      'X-API-KEY': apiKey,
    },
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Gamma API 查询失败: ${response.status} ${errText}`);
  }

  return await response.json();
}

// 轮询等待生成完成
export async function pollGeneration(
  apiKey: string,
  generationId: string,
  options?: {
    intervalMs?: number;
    timeoutMs?: number;
    onProgress?: (status: string) => void;
  }
): Promise<GammaGeneration> {
  const intervalMs = options?.intervalMs || 5000;
  const timeoutMs = options?.timeoutMs || 180000; // 3 minutes
  const startTime = Date.now();

  while (Date.now() - startTime < timeoutMs) {
    const generation = await getGeneration(apiKey, generationId);

    options?.onProgress?.(generation.status);

    if (generation.status === 'completed') {
      return generation;
    }

    if (generation.status === 'failed') {
      throw new Error(generation.error || 'Gamma 生成失败');
    }

    await new Promise(r => setTimeout(r, intervalMs));
  }

  throw new Error('Gamma 生成超时');
}

// 获取主题列表
export async function getThemes(apiKey: string): Promise<GammaTheme[]> {
  const response = await fetch(`${GAMMA_API_BASE}/themes`, {
    headers: {
      'X-API-KEY': apiKey,
    },
  });

  if (!response.ok) {
    throw new Error(`获取主题列表失败: ${response.status}`);
  }

  const data = await response.json();
  return data.themes || data || [];
}
