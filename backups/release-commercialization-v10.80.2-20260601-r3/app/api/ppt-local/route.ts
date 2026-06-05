// /api/ppt-local — P0 本地 LLM + python-pptx PPT 生成 API
// 替代 Gamma API，使用本地 LLM (MiniMax/GLM) + python-pptx
//
// 流程:
//  1. 接收结构化 PPT 数据（title, slides, theme, tone）
//  2. [可选] 调用本地 LLM 增强原始内容
//  3. 调用 python-pptx 脚本生成 PPTX
//  4. 缓存并返回文件 ID

import { NextRequest, NextResponse } from 'next/server';
import { spawn } from 'child_process';
import { registerPptBuffer } from '@/app/api/export/route.utils';
import { randomUUID } from 'crypto';

export const runtime = 'nodejs';
export const maxDuration = 120;

const PYTHON_SCRIPT = '/Users/macmini/shengshi-ppt/scripts/ppt-local/ppt_local_generator.py';

interface PptLocalSlide {
  title: string;
  content?: string[];
  points?: string[];
  bullets?: string[];
  type?: 'bullets' | 'title' | 'toc' | 'two-column' | 'chart' | 'quote';
}

interface PptLocalRequest {
  title: string;
  slides?: PptLocalSlide[];
  theme?: string;
  tone?: 'professional' | 'casual' | 'creative' | 'bold' | 'traditional';
  // raw_input + use_llm: LLM 增强模式
  raw_input?: string;
  use_llm?: boolean;
  // 直接生成模式（跳过 LLM）
  api_base?: string;
  api_key?: string;
}

// 调用 Python 脚本生成 PPTX
function runPythonScript(payload: object, timeoutMs = 90000): Promise<{ outputPath: string; fileSize: number }> {
  return new Promise((resolve, reject) => {
    const payloadStr = JSON.stringify(payload);
    const child = spawn('python3', [PYTHON_SCRIPT, '-'], {
      stdio: ['pipe', 'pipe', 'pipe'],
      timeout: timeoutMs,
    });

    let stdout = '';
    let stderr = '';

    child.stdout.on('data', (data) => { stdout += data.toString(); });
    child.stderr.on('data', (data) => { stderr += data.toString(); });

    child.on('error', (err) => reject(new Error(`Python 进程启动失败: ${err.message}`)));

    child.on('close', (code) => {
      if (code !== 0) {
        console.error('[ppt-local] Python stderr:', stderr);
        return reject(new Error(`Python 脚本退出码 ${code}: ${stderr.substring(0, 300)}`));
      }

      try {
        const result = JSON.parse(stdout);
        if (result.error) {
          return reject(new Error(result.error));
        }
        resolve({ outputPath: result.output_path, fileSize: result.file_size });
      } catch (e) {
        reject(new Error(`解析 Python 输出失败: ${stdout.substring(0, 200)}`));
      }
    });

    child.stdin.write(payloadStr);
    child.stdin.end();
  });
}

// POST — 创建 PPT 生成任务
export async function POST(request: NextRequest) {
  try {
    const body: PptLocalRequest = await request.json();
    const { title, slides, theme = 'default', tone = 'professional', raw_input, use_llm = false, api_base, api_key } = body;

    // 基础验证
    if (!title && !raw_input) {
      return NextResponse.json({ error: '缺少 title 或 raw_input 参数' }, { status: 400 });
    }

    // 构建 payload
    const payload: Record<string, unknown> = {
      title: title || 'PPT',
      theme,
      tone,
      use_llm,
    };

    if (slides && slides.length > 0) {
      // 直接结构化数据模式
      payload.slides = slides.map(s => ({
        title: s.title,
        content: s.bullets ?? s.points ?? s.content ?? [],
        type: s.type || 'bullets',
      }));
    } else if (raw_input) {
      // LLM 增强模式
      payload.raw_input = raw_input;
    } else {
      return NextResponse.json({ error: '缺少 slides 或 raw_input' }, { status: 400 });
    }

    if (api_base) payload.api_base = api_base;
    if (api_key) payload.api_key = api_key;

    console.log('[ppt-local] 开始生成 PPTX, title:', payload.title, 'use_llm:', use_llm);

    const { outputPath, fileSize } = await runPythonScript(payload);

    console.log('[ppt-local] PPTX 生成成功:', outputPath, 'size:', fileSize);

    // 读取文件并注册到缓存
    const fs = await import('fs/promises');
    const fileBuffer = await fs.readFile(outputPath);

    const fileId = randomUUID();
    registerPptBuffer(fileId, Buffer.from(fileBuffer));

    // 清理临时文件
    try {
      await fs.unlink(outputPath);
    } catch { /* 忽略清理错误 */ }

    return NextResponse.json({
      success: true,
      fileId,
      title: payload.title,
      fileSize,
      downloadUrl: `/api/export?file=${fileId}&name=${encodeURIComponent(String(payload.title))}.pptx`,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : '生成失败';
    console.error('[ppt-local] Error:', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
