import { NextRequest, NextResponse } from 'next/server';
import { selectBestKey } from '@/lib/gamma-key-pool';

export const runtime = 'nodejs';

const GAMMA_API_BASE = 'https://public-api.gamma.app/v1.0';
const GAMMA_UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
const FORMAT = 'png' as const;

function extractExportUrl(data: Record<string, any>): string {
  return data.exportUrl || data.url || data.pngUrl || data.downloadUrl || '';
}

async function pollExportUrl(generationId: string, exportId: string, apiKey: string): Promise<string> {
  for (let i = 0; i < 30; i++) {
    await new Promise((r) => setTimeout(r, 2000));
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
      throw new Error(checkData.error || 'PNG导出失败');
    }
  }
  throw new Error('PNG导出超时');
}

async function createPngExport(generationId: string, apiKey: string): Promise<string> {
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
    if (!exportRes.ok) continue;

    const exportData = await exportRes.json();
    const directUrl = extractExportUrl(exportData);
    if (directUrl) return directUrl;

    const exportId = exportData.id || exportData.exportId;
    if (exportId) return pollExportUrl(generationId, exportId, apiKey);
  }
  throw new Error('未获取到PNG下载链接');
}

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

    const statusRes = await fetch(`${GAMMA_API_BASE}/generations/${generationId}`, {
      headers: {
        'X-API-KEY': apiKey,
        'User-Agent': GAMMA_UA,
      },
    });

    if (!statusRes.ok) {
      return NextResponse.json({
        generationId,
        status: 'failed',
        error: { code: 'EXPORT_FAILED', message: `查询失败: ${statusRes.status}` },
      }, { status: 502 });
    }

    const statusData = await statusRes.json();
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

    let pngUrl = '';
    if (typeof statusData.exportUrl === 'string' && statusData.exportUrl) {
      const lower = statusData.exportUrl.toLowerCase();
      if (lower.includes('.png') || lower.includes('/png/') || lower.includes('.zip')) {
        pngUrl = statusData.exportUrl;
      }
    }
    if (!pngUrl) {
      pngUrl = await createPngExport(generationId, apiKey);
    }

    const fileRes = await fetch(pngUrl, {
      headers: { 'User-Agent': GAMMA_UA },
      redirect: 'follow',
      signal: AbortSignal.timeout(120000),
    });

    if (!fileRes.ok) {
      return NextResponse.json({
        generationId,
        status: 'failed',
        error: { code: 'DOWNLOAD_FAILED', message: `下载PNG失败: ${fileRes.status}` },
      }, { status: 502 });
    }

    const arrayBuffer = await fileRes.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const contentType = fileRes.headers.get('content-type') || 'application/octet-stream';
    const fileExt = contentType.includes('zip') ? 'zip' : 'png';
    const safeBase = filename.replace(/\.[^.]+$/, '').replace(/[^\w\u4e00-\u9fff.\-]/g, '_');
    const finalFilename = `${safeBase}.${fileExt}`;

    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(finalFilename)}`,
        'Content-Length': buffer.length.toString(),
        'Cache-Control': 'no-cache',
      },
    });
  } catch (e: any) {
    if (e.name === 'AbortError' || e.name === 'TimeoutError') {
      return NextResponse.json({
        generationId,
        status: 'failed',
        error: { code: 'EXPORT_TIMEOUT', message: 'PNG下载超时，请重试' },
      }, { status: 504 });
    }
    return NextResponse.json({
      generationId,
      status: 'failed',
      error: { code: 'DOWNLOAD_FAILED', message: e.message || '下载失败' },
    }, { status: 500 });
  }
}
