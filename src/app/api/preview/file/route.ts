import { NextRequest, NextResponse } from 'next/server';
import { selectBestKey } from '@/lib/gamma-key-pool';

export const runtime = 'nodejs';

const GAMMA_API_BASE = 'https://public-api.gamma.app/v1.0';
const GAMMA_UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

type PreviewFormat = 'pdf' | 'pptx';
type ExportEntry = {
  url?: string;
  exportUrl?: string;
  downloadUrl?: string;
  format?: string;
  type?: string;
  status?: string;
  id?: string;
  exportId?: string;
};
type GammaStatusPayload = {
  status?: string;
  error?: string;
  exportUrl?: string;
  url?: string;
  downloadUrl?: string;
  pdfUrl?: string;
  pptxUrl?: string;
  exports?: ExportEntry[];
};

function parsePreviewFormat(raw: string | null): PreviewFormat {
  return raw?.toLowerCase() === 'pptx' ? 'pptx' : 'pdf';
}

function resolveFilename(raw: string | null, format: PreviewFormat): string {
  const base = (raw || '省心PPT').trim() || '省心PPT';
  const safe = base.replace(/[^\w\u4e00-\u9fff.\-]/g, '_');
  return safe.toLowerCase().endsWith(`.${format}`) ? safe : `${safe}.${format}`;
}

function detectExportFormatFromUrl(url: string): PreviewFormat | 'unknown' {
  const lower = url.toLowerCase();
  if (lower.includes('.pdf') || lower.includes('/pdf/')) return 'pdf';
  if (lower.includes('.pptx') || lower.includes('/pptx/')) return 'pptx';
  return 'unknown';
}

function detectExportFormatFromEntry(entry: ExportEntry): PreviewFormat | 'unknown' {
  const format = String(entry.format || entry.type || '').toLowerCase();
  if (format.includes('pdf')) return 'pdf';
  if (format.includes('pptx')) return 'pptx';
  const nestedUrl = entry.url || entry.exportUrl || entry.downloadUrl || '';
  return nestedUrl ? detectExportFormatFromUrl(nestedUrl) : 'unknown';
}

function extractExportUrlForFormat(payload: GammaStatusPayload, format: PreviewFormat): string | null {
  const topLevelCandidates = [
    payload.exportUrl,
    payload.url,
    payload.downloadUrl,
    payload.pdfUrl,
    payload.pptxUrl,
  ];
  for (const candidate of topLevelCandidates) {
    if (typeof candidate !== 'string' || !candidate) continue;
    const detected = detectExportFormatFromUrl(candidate);
    if (detected === format) return candidate;
  }

  if (Array.isArray(payload.exports)) {
    for (const item of payload.exports) {
      if (!item || typeof item !== 'object') continue;
      const entry = item as ExportEntry;
      if (detectExportFormatFromEntry(entry) !== format) continue;
      const candidate = entry.url || entry.exportUrl || entry.downloadUrl;
      if (typeof candidate === 'string' && candidate) return candidate;
    }
  }

  return null;
}

function extractAnyExportUrl(payload: GammaStatusPayload): string | null {
  const topLevelCandidates = [
    payload.exportUrl,
    payload.url,
    payload.downloadUrl,
    payload.pdfUrl,
    payload.pptxUrl,
  ];
  for (const candidate of topLevelCandidates) {
    if (typeof candidate === 'string' && candidate) return candidate;
  }

  if (Array.isArray(payload.exports)) {
    for (const item of payload.exports) {
      if (!item || typeof item !== 'object') continue;
      const entry = item as ExportEntry;
      const nestedCandidates = [entry.url, entry.exportUrl, entry.downloadUrl];
      for (const candidate of nestedCandidates) {
        if (typeof candidate === 'string' && candidate) return candidate;
      }
    }
  }

  return null;
}

function getMimeType(format: PreviewFormat): string {
  return format === 'pdf'
    ? 'application/pdf'
    : 'application/vnd.openxmlformats-officedocument.presentationml.presentation';
}

async function pollExportUrl(generationId: string, exportId: string, format: PreviewFormat, apiKey: string): Promise<string> {
  for (let i = 0; i < 30; i++) {
    await new Promise((r) => setTimeout(r, 2000));
    const checkRes = await fetch(`${GAMMA_API_BASE}/generations/${generationId}/exports/${exportId}`, {
      headers: {
        'X-API-KEY': apiKey,
        'User-Agent': GAMMA_UA,
      },
      signal: AbortSignal.timeout(30000),
    });

    if (!checkRes.ok) continue;
    const checkData = await checkRes.json() as ExportEntry;
    const directUrl = checkData.url || checkData.exportUrl || checkData.downloadUrl || '';
    if (directUrl) return directUrl;
    if (String(checkData.status || '').toLowerCase() === 'failed') {
      throw new Error(`${format.toUpperCase()} 导出失败`);
    }
  }

  throw new Error(`${format.toUpperCase()} 导出超时`);
}

async function createExportUrl(generationId: string, format: PreviewFormat, apiKey: string): Promise<string> {
  const endpoints = ['exports', 'export'];

  for (const endpoint of endpoints) {
    const exportRes = await fetch(`${GAMMA_API_BASE}/generations/${generationId}/${endpoint}`, {
      method: 'POST',
      headers: {
        'X-API-KEY': apiKey,
        'Content-Type': 'application/json',
        'User-Agent': GAMMA_UA,
      },
      body: JSON.stringify({ format }),
      signal: AbortSignal.timeout(60000),
    });

    if (!exportRes.ok) continue;
    const exportData = await exportRes.json() as ExportEntry;
    const directUrl = exportData.url || exportData.exportUrl || exportData.downloadUrl || '';
    if (directUrl) return directUrl;
    const exportId = exportData.id || exportData.exportId;
    if (exportId) return pollExportUrl(generationId, exportId, format, apiKey);
  }

  throw new Error(`未获取到 ${format.toUpperCase()} 导出链接`);
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

    const statusData = await statusRes.json() as GammaStatusPayload;
    const generationStatus = String(statusData.status || '').toLowerCase();

    if (generationStatus === 'pending' || generationStatus === 'in_progress' || generationStatus === 'processing') {
      return NextResponse.json({ error: 'PPT 正在生成中，请稍后重试' }, { status: 409 });
    }

    if (generationStatus === 'failed' || generationStatus === 'error') {
      return NextResponse.json({ error: statusData.error || '生成失败，无法预览' }, { status: 500 });
    }

    let exportUrl = extractExportUrlForFormat(statusData, format);
    if (!exportUrl) {
      const anyExportUrl = extractAnyExportUrl(statusData);
      const availableFormat = anyExportUrl ? detectExportFormatFromUrl(anyExportUrl) : 'unknown';
      try {
        exportUrl = await createExportUrl(generationId, format, apiKey);
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : `${format.toUpperCase()} 导出失败`;
        return NextResponse.json({
          error: message,
          requestedFormat: format,
          availableFormat,
        }, { status: message.includes('超时') ? 504 : 502 });
      }
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
  } catch (error: unknown) {
    const msg = error instanceof Error
      ? (error.name === 'AbortError' ? '请求超时，请重试' : (error.message || '预览失败'))
      : '预览失败';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
