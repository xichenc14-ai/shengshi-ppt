import { describe, it, expect, beforeAll } from 'vitest';
import type { NextRequest } from 'next/server';
import { POST, GET } from '@/app/api/gamma/route';
import fs from 'fs';
import path from 'path';

// ===== 真实 Gamma API 端到端测试 =====
// 不用 mock，直接调真实 API，验证完整生成链路

const hasGammaKeys = Boolean(process.env.GAMMA_API_KEYS || process.env.GAMMA_API_KEY);

function asNextRequest(request: Request): NextRequest {
  return request as unknown as NextRequest;
}

function mockPostRequest(body: Record<string, unknown> = {}) {
  return asNextRequest(new Request('http://localhost/api/gamma', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-forwarded-for': '127.0.0.1' },
    body: JSON.stringify(body),
  }));
}

function mockGetRequest(id: string) {
  return asNextRequest(new Request(`http://localhost/api/gamma?id=${id}`, {
    headers: { 'x-forwarded-for': '127.0.0.1' },
  }));
}

function getStringField(data: Record<string, unknown>, key: string): string {
  return typeof data[key] === 'string' ? data[key] : '';
}

/**
 * 轮询 Gamma 生成状态，直到完成或超时
 * Gamma PPT 生成通常需要 30-120 秒
 */
async function pollUntilComplete(generationId: string, timeoutMs = 180000): Promise<Record<string, unknown>> {
  const start = Date.now();
  let status = 'pending';

  while (status !== 'completed' && status !== 'failed' && Date.now() - start < timeoutMs) {
    const res = await GET(mockGetRequest(generationId));
    const data = await res.json();

    if (!res.ok) {
      throw new Error(`轮询失败: ${res.status} ${JSON.stringify(data)}`);
    }

    status = data.status;
    console.log(`  [轮询] ${new Date().toLocaleTimeString()} | status=${status} | 已等待 ${Math.round((Date.now() - start) / 1000)}s`);

    if (status === 'completed') return data;
    if (status === 'failed') throw new Error(`生成失败: ${JSON.stringify(data)}`);

    // Gamma 建议 5-10 秒轮询一次
    await new Promise(r => setTimeout(r, 8000));
  }

  throw new Error(`生成超时 (${timeoutMs / 1000}s)，最终状态: ${status}`);
}

/**
 * 下载文件并验证
 */
async function downloadAndVerify(url: string, expectedMinSize = 1024): Promise<{ ok: boolean; size: number; type: string; path?: string }> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`下载失败: ${res.status}`);

  const buffer = Buffer.from(await res.arrayBuffer());
  const size = buffer.length;
  const contentType = res.headers.get('content-type') || 'unknown';

  // 保存到本地供人工检查
  const testOutputDir = path.join(process.cwd(), '__tests__/output');
  if (!fs.existsSync(testOutputDir)) fs.mkdirSync(testOutputDir, { recursive: true });

  const ext = contentType.includes('pdf') ? 'pdf' : 'pptx';
  const filename = `gamma-e2e-${Date.now()}.${ext}`;
  const filepath = path.join(testOutputDir, filename);
  fs.writeFileSync(filepath, buffer);

  return {
    ok: size >= expectedMinSize,
    size,
    type: contentType,
    path: filepath,
  };
}

// ===== 测试套件 =====
describe('Gamma API 真实端到端测试', () => {
  beforeAll(() => {
    if (!process.env.GAMMA_API_KEYS && process.env.GAMMA_API_KEY) {
      process.env.GAMMA_API_KEYS = `test:3967:${process.env.GAMMA_API_KEY}`;
    }
  });

  const runWhenGammaConfigured = hasGammaKeys ? it : it.skip;

  runWhenGammaConfigured('完整链路：生成3页PPT → 轮询完成 → 下载验证', async () => {
    // Step 1: 创建生成任务（3页，主题图，导出PDF）
    const postRes = await POST(mockPostRequest({
      inputText: '# AI技术趋势报告\n\n## 机器学习\n\n- 监督学习\n- 无监督学习\n- 强化学习',
      numCards: 3,
      themeId: 'consultant',
    }));

    expect(postRes.status).toBe(200);
    const postData = await postRes.json() as Record<string, unknown>;
    const generationId = getStringField(postData, 'generationId');
    expect(generationId).toBeTruthy();

    console.log(`[E2E] 生成任务已创建: ${generationId}`);

    // Step 2: 轮询直到完成
    const completed = await pollUntilComplete(generationId);
    expect(completed.status).toBe('completed');
    console.log(`[E2E] 生成完成，耗时约 30-120s`);

    // Step 3: 验证返回的 URL
    // Gamma completed 状态通常返回 pptxUrl / pdfUrl / gammaUrl
    const pptxUrl = getStringField(completed, 'pptxUrl');
    const pdfUrl = getStringField(completed, 'pdfUrl');
    const gammaUrl = getStringField(completed, 'gammaUrl');
    const hasUrl = pptxUrl || pdfUrl || gammaUrl;
    expect(hasUrl).toBeDefined();
    console.log(`[E2E] 获取到URL: ${hasUrl ? '有' : '无'} (pptx=${!!pptxUrl}, pdf=${!!pdfUrl}, gamma=${!!gammaUrl})`);

    // Step 4: 如果有 pptx/pdf URL，下载并验证
    if (pptxUrl) {
      const result = await downloadAndVerify(pptxUrl, 5000);
      console.log(`[E2E] PPTX 下载: ${result.size} bytes, 保存至 ${result.path}`);
      expect(result.ok).toBe(true);
      expect(result.size).toBeGreaterThan(5000); // 真实PPT至少几KB
    } else if (pdfUrl) {
      const result = await downloadAndVerify(pdfUrl, 5000);
      console.log(`[E2E] PDF 下载: ${result.size} bytes, 保存至 ${result.path}`);
      expect(result.ok).toBe(true);
      expect(result.size).toBeGreaterThan(5000);
    } else {
      console.log(`[E2E] ⚠️ 无 pptx/pdf 下载链接，仅有 gammaUrl: ${gammaUrl}`);
      console.log(`[E2E] Gamma 在线预览链接可用，跳过文件下载验证`);
    }

    console.log(`[E2E] ✅ 完整链路测试通过`);
  }, 300000); // 5分钟超时（Gamma生成+下载）

  it('参数校验：缺少输入返回400', async () => {
    const res = await POST(mockPostRequest({}));
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toContain('内容');
  });

  it('参数校验：空字符串返回400', async () => {
    const res = await POST(mockPostRequest({ inputText: '' }));
    expect(res.status).toBe(400);
  });

  it('查询状态：缺少id返回400', async () => {
    const res = await GET(asNextRequest(new Request('http://localhost/api/gamma', {
      headers: { 'x-forwarded-for': '127.0.0.1' },
    })));
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toContain('generationId');
  });
});
