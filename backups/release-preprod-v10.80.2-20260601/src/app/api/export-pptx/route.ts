import { NextRequest, NextResponse } from 'next/server';
import { selectBestKey } from '@/lib/gamma-key-pool';

export const runtime = 'nodejs';

const GAMMA_API_BASE = 'https://public-api.gamma.app/v1.0';
const GAMMA_UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
const FORMAT = 'pptx' as const;
const MIME_TYPE = 'application/vnd.openxmlformats-officedocument.presentationml.presentation';

function isPptxUrl(url: string): boolean {
  const lower = url.toLowerCase();
  return lower.includes('.pptx') || lower.includes('/pptx/');
}

function extractExportUrl(data: Record<string, any>): string {
  return data.exportUrl || data.url || data.pptxUrl || data.downloadUrl || '';
}

async function pollExportUrl(generationId: string, exportId: string, apiKey: string): Promise<string> {
  for (let i = 0; i < 30; i++) {
    await new Promise(r => setTimeout(r, 2000));

    const checkRes = await fetch(`${GAMMA_API_BASE}/generations/${generationId}/exports/${exportId}`, {
      headers: {
        'X-API-KEY': apiKey,
        'User-Agent': GAMMA_UA,
      },
    });

    if (!checkRes.ok) continue;

    const checkData = await checkRes.json();
    const url = extractExportUrl(checkData);
    if (url) return url;
    if (checkData.status === 'failed' || checkData.error) {
      throw new Error(checkData.error || 'PPTX导出失败');
    }
  }

  throw new Error('PPTX导出超时');
}

async function createPptxExport(generationId: string, apiKey: string): Promise<string> {
  const endpoints = ['exports', 'export'];

  for (const endpoint of endpoints) {
    const exportRes = await fetch(`${GAMMA_API_BASE}/generations/${generationId}/${endpoint}`, {
      method: 'POST',
      headers: {
        'X-API-KEY': apiKey,
        'Content-Type': 'application/json',
        'User-Agent': GAMMA_UA,
      },
      body: JSON.stringify({ format: FORMAT }),
      signal: AbortSignal.timeout(60000),
    });

    if (!exportRes.ok) {
      const errText = await exportRes.text().catch(() => '');
      console.warn(`[ExportPPTX] /${endpoint} 失败:`, exportRes.status, errText.substring(0, 200));
      continue;
    }

    const exportData = await exportRes.json();
    const directUrl = extractExportUrl(exportData);
    if (directUrl) return directUrl;

    const exportId = exportData.id || exportData.exportId;
    if (exportId) return pollExportUrl(generationId, exportId, apiKey);
  }

  throw new Error('未获取到PPTX下载链接');
}

/**
 * PPTX 下载代理 API (D5: 统一错误处理)
 * 
 * 流程：
 * 1. 接收 generationId
 * 2. 调用 Gamma Export API 创建 PPTX 导出任务
 * 3. 下载 PPTX 文件并通过后端代理返回（解决跨域问题）
 * 
 * 错误响应格式（D5 canonical）:
 * { generationId, status: "failed", error: { code, message } }
 */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const generationId = searchParams.get('generationId');
  const filename = searchParams.get('name') || `省心PPT.${FORMAT}`;

  if (!generationId) {
    return NextResponse.json({
      generationId: '',
      status: 'failed',
      error: { code: 'MISSING_ID', message: '缺少 generationId 参数' },
    }, { status: 400 });
  }

  try {
    const selectedKey = selectBestKey();
    const apiKey = selectedKey.key;
    console.log('[ExportPPTX] generationId:', generationId, 'key:', selectedKey.label);

    // Step 1: 检查 generation 状态
    const statusRes = await fetch(`${GAMMA_API_BASE}/generations/${generationId}`, {
      headers: {
        'X-API-KEY': apiKey,
        'User-Agent': GAMMA_UA,
      },
    });

    if (!statusRes.ok) {
      console.error('[ExportPPTX] 状态查询失败:', statusRes.status);
      return NextResponse.json({
        generationId,
        status: 'failed',
        error: { code: 'EXPORT_FAILED', message: `查询失败: ${statusRes.status}` },
      }, { status: 502 });
    }

    const statusData = await statusRes.json();
    console.log('[ExportPPTX] Generation 状态:', statusData.status);

    if (statusData.status === 'pending' || statusData.status === 'in_progress' || statusData.status === 'processing') {
      return NextResponse.json({
        generationId,
        status: 'pending',
        error: { code: 'GENERATION_PENDING', message: 'PPT 仍在生成中，请稍后再试' },
      }, { status: 400 });
    }

    if (statusData.status === 'failed') {
      return NextResponse.json({
        generationId,
        status: 'failed',
        error: { code: 'GENERATION_FAILED', message: statusData.error || 'PPT 生成失败' },
      }, { status: 500 });
    }

    // Step 2: 优先复用 completed 状态里的 PPTX URL，否则创建导出任务。
    let pptxUrl = '';
    if (typeof statusData.exportUrl === 'string' && isPptxUrl(statusData.exportUrl)) {
      pptxUrl = statusData.exportUrl;
    } else {
      try {
        pptxUrl = await createPptxExport(generationId, apiKey);
      } catch (exportErr: any) {
        console.error('[ExportPPTX] Export失败:', exportErr.message);
        return NextResponse.json({
          generationId,
          status: 'failed',
          error: { code: 'EXPORT_FAILED', message: exportErr.message || 'PPTX导出失败' },
        }, { status: exportErr.message?.includes('超时') ? 504 : 502 });
      }
    }

    console.log('[ExportPPTX] 获取到PPTX URL:', pptxUrl.substring(0, 80));

    // Step 3: 后端代理下载PPTX（解决跨域/302问题）
    const pptxRes = await fetch(pptxUrl, {
      headers: { 'User-Agent': GAMMA_UA },
      redirect: 'follow',
      signal: AbortSignal.timeout(120000),
    });

    if (!pptxRes.ok) {
      console.error('[ExportPPTX] 下载PPTX失败:', pptxRes.status);
      return NextResponse.json({
        generationId,
        status: 'failed',
        error: { code: 'DOWNLOAD_FAILED', message: `下载PPTX失败: ${pptxRes.status}` },
      }, { status: 502 });
    }

    const arrayBuffer = await pptxRes.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Step 4: 返回PPTX文件
    const safeFilename = filename.replace(/[^\w\u4e00-\u9fff.\-]/g, '_');
    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        'Content-Type': MIME_TYPE,
        'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(safeFilename)}`,
        'Content-Length': buffer.length.toString(),
        'Cache-Control': 'no-cache',
      },
    });
  } catch (e: any) {
    console.error('[ExportPPTX] Error:', e.message);
    if (e.name === 'AbortError' || e.name === 'TimeoutError') {
      return NextResponse.json({
        generationId,
        status: 'failed',
        error: { code: 'EXPORT_TIMEOUT', message: 'PPTX下载超时，请重试' },
      }, { status: 504 });
    }
    return NextResponse.json({
      generationId,
      status: 'failed',
      error: { code: 'DOWNLOAD_FAILED', message: e.message || '下载失败' },
    }, { status: 500 });
  }
}
