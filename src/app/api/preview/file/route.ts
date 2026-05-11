import { NextRequest, NextResponse } from 'next/server';
import { selectBestKey } from '@/lib/gamma-key-pool';

export const runtime = 'nodejs';

const GAMMA_API_BASE = 'https://public-api.gamma.app/v1.0';
const GAMMA_UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
const SINGLE_EXPORT_HINT = 'Gamma 官方 API 每次生成仅返回一种 exportAs 文件。若需另一种格式，请发起新的生成请求。';

type PreviewFormat = 'pdf' | 'pptx';

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

function extractAnyExportUrl(payload: Record<string, any>): string | null {
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
      const entry = item as Record<string, any>;
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

    const exportUrl = extractAnyExportUrl(statusData);
    if (!exportUrl) {
      return NextResponse.json({
        error: '当前任务没有可下载的导出文件，请确认创建 generation 时传入了 exportAs 参数',
      }, { status: 409 });
    }

    const availableFormat = detectExportFormatFromUrl(exportUrl);
    if (availableFormat !== 'unknown' && availableFormat !== format) {
      return NextResponse.json({
        error: `当前任务导出格式为 ${availableFormat.toUpperCase()}，不支持直接预览 ${format.toUpperCase()}。${SINGLE_EXPORT_HINT}`,
        requestedFormat: format,
        availableFormat,
      }, { status: 409 });
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
