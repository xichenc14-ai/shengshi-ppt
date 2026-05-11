import { NextRequest, NextResponse } from 'next/server';
import { selectBestKey } from '@/lib/gamma-key-pool';

export const runtime = 'nodejs';

const GAMMA_API_BASE = 'https://public-api.gamma.app/v1.0';
const GAMMA_UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
const MAX_EXPORT_POLL = 30;
const EXPORT_POLL_INTERVAL_MS = 2000;

type PreviewFormat = 'pdf' | 'pptx';

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function parsePreviewFormat(raw: string | null): PreviewFormat {
  return raw?.toLowerCase() === 'pptx' ? 'pptx' : 'pdf';
}

function resolveFilename(raw: string | null, format: PreviewFormat): string {
  const base = (raw || '省心PPT').trim() || '省心PPT';
  const safe = base.replace(/[^\w\u4e00-\u9fff.\-]/g, '_');
  return safe.toLowerCase().endsWith(`.${format}`) ? safe : `${safe}.${format}`;
}

function isFormatUrl(url: string, format: PreviewFormat): boolean {
  const lower = url.toLowerCase();
  if (format === 'pdf') return lower.includes('.pdf') || lower.includes('/pdf/');
  return lower.includes('.pptx') || lower.includes('/pptx/');
}

function extractExportUrl(payload: Record<string, any>, format: PreviewFormat): string | null {
  const candidates = [
    payload.exportUrl,
    payload.url,
    payload.downloadUrl,
    payload.pdfUrl,
    payload.pptxUrl,
  ];
  for (const candidate of candidates) {
    if (typeof candidate === 'string' && candidate && isFormatUrl(candidate, format)) {
      return candidate;
    }
  }
  for (const candidate of candidates) {
    if (typeof candidate === 'string' && candidate) {
      return candidate;
    }
  }
  return null;
}

async function pollExportUrl(generationId: string, exportId: string, apiKey: string, format: PreviewFormat): Promise<string | null> {
  for (let i = 0; i < MAX_EXPORT_POLL; i++) {
    await sleep(EXPORT_POLL_INTERVAL_MS);

    const checkRes = await fetch(`${GAMMA_API_BASE}/generations/${generationId}/exports/${exportId}`, {
      headers: {
        'X-API-KEY': apiKey,
        'User-Agent': GAMMA_UA,
      },
    });

    if (!checkRes.ok) continue;

    const checkData = await checkRes.json().catch(() => ({}));
    const readyUrl = extractExportUrl(checkData, format);
    if (readyUrl) return readyUrl;

    const status = String(checkData.status || '').toLowerCase();
    if (status === 'failed' || status === 'error') {
      throw new Error(checkData.error || `${format.toUpperCase()} 导出失败`);
    }
  }

  return null;
}

async function createExportUrl(generationId: string, apiKey: string, format: PreviewFormat): Promise<string | null> {
  const endpoints = ['exports', 'export'];

  for (const endpoint of endpoints) {
    const exportRes = await fetch(`${GAMMA_API_BASE}/generations/${generationId}/${endpoint}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-KEY': apiKey,
        'User-Agent': GAMMA_UA,
      },
      body: JSON.stringify({ format }),
      signal: AbortSignal.timeout(60000),
    });

    if (!exportRes.ok) continue;

    const exportData = await exportRes.json().catch(() => ({}));
    const exportUrl = extractExportUrl(exportData, format);
    if (exportUrl) return exportUrl;

    const exportId = typeof exportData.id === 'string'
      ? exportData.id
      : typeof exportData.exportId === 'string'
        ? exportData.exportId
        : '';

    if (exportId) {
      const polledUrl = await pollExportUrl(generationId, exportId, apiKey, format);
      if (polledUrl) return polledUrl;
    }
  }

  return null;
}

function getMimeType(format: PreviewFormat): string {
  return format === 'pdf'
    ? 'application/pdf'
    : 'application/vnd.openxmlformats-officedocument.presentationml.presentation';
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const generationId = searchParams.get('generationId') || searchParams.get('id');
  const format = parsePreviewFormat(searchParams.get('format'));
  const inline = searchParams.get('inline') !== '0';
  const filename = resolveFilename(searchParams.get('name'), format);

  if (!generationId) {
    return NextResponse.json({ error: '缺少 generationId 参数' }, { status: 400 });
  }

  try {
    const selectedKey = selectBestKey();
    const apiKey = selectedKey.key;

    const statusRes = await fetch(`${GAMMA_API_BASE}/generations/${generationId}`, {
      headers: {
        'X-API-KEY': apiKey,
        'User-Agent': GAMMA_UA,
      },
      signal: AbortSignal.timeout(30000),
    });

    if (!statusRes.ok) {
      return NextResponse.json({ error: `获取状态失败: ${statusRes.status}` }, { status: 502 });
    }

    const statusData = await statusRes.json();
    const generationStatus = String(statusData.status || '').toLowerCase();

    if (generationStatus === 'pending' || generationStatus === 'in_progress' || generationStatus === 'processing') {
      return NextResponse.json({ error: 'PPT 正在生成中，请稍后重试' }, { status: 409 });
    }

    if (generationStatus === 'failed' || generationStatus === 'error') {
      return NextResponse.json({ error: statusData.error || '生成失败，无法预览' }, { status: 500 });
    }

    let exportUrl = extractExportUrl(statusData, format);
    if (!exportUrl) {
      exportUrl = await createExportUrl(generationId, apiKey, format);
    }

    if (!exportUrl) {
      return NextResponse.json({ error: `${format.toUpperCase()} 导出链接获取失败` }, { status: 502 });
    }

    const fileRes = await fetch(exportUrl, {
      headers: { 'User-Agent': GAMMA_UA },
      redirect: 'follow',
      signal: AbortSignal.timeout(120000),
    });

    if (!fileRes.ok) {
      return NextResponse.json({ error: `${format.toUpperCase()} 下载失败: ${fileRes.status}` }, { status: 502 });
    }

    const buffer = Buffer.from(await fileRes.arrayBuffer());
    const dispositionType = inline ? 'inline' : 'attachment';

    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        'Content-Type': getMimeType(format),
        'Content-Disposition': `${dispositionType}; filename*=UTF-8''${encodeURIComponent(filename)}`,
        'Content-Length': String(buffer.length),
        'Cache-Control': 'private, max-age=300',
      },
    });
  } catch (error: any) {
    const msg = error?.name === 'AbortError' ? '请求超时，请重试' : (error?.message || '预览失败');
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
