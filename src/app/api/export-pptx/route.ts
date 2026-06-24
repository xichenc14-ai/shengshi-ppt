import { NextRequest, NextResponse } from 'next/server';
import { selectBestKey } from '@/lib/gamma-key-pool';
import { getGammaAdditionalExportUnsupportedMessage } from '@/lib/gamma-export';

export const runtime = 'nodejs';

const GAMMA_API_BASE = 'https://public-api.gamma.app/v1.0';
const GAMMA_UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
const FORMAT = 'pptx' as const;
const MIME_TYPE = 'application/vnd.openxmlformats-officedocument.presentationml.presentation';
const MIN_PPTX_BYTES = 1024;

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function isPptxUrl(url: string): boolean {
  const lower = url.toLowerCase();
  return lower.includes('.pptx') || lower.includes('/pptx/');
}

function isValidPptxBuffer(buffer: Buffer): boolean {
  if (buffer.length < MIN_PPTX_BYTES) return false;
  // PPTX 是 ZIP 容器，合法文件必须以 PK ZIP signature 开头。
  const hasZipSignature =
    buffer[0] === 0x50
    && buffer[1] === 0x4b
    && (
      (buffer[2] === 0x03 && buffer[3] === 0x04)
      || (buffer[2] === 0x05 && buffer[3] === 0x06)
      || (buffer[2] === 0x07 && buffer[3] === 0x08)
    );
  if (!hasZipSignature) return false;

  // ZIP 中的文件名以明文保存；两项均存在才能确认是 PowerPoint 包。
  const packageIndex = buffer.indexOf(Buffer.from('[Content_Types].xml'));
  const presentationIndex = buffer.indexOf(Buffer.from('ppt/presentation.xml'));
  return packageIndex >= 0 && presentationIndex >= 0;
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

    // Step 2: 仅复用创建任务时返回的 PPTX URL。
    let pptxUrl = '';
    if (typeof statusData.exportUrl === 'string' && isPptxUrl(statusData.exportUrl)) {
      pptxUrl = statusData.exportUrl;
    }

    if (!pptxUrl) {
      const currentExport = typeof statusData.exportUrl === 'string' ? statusData.exportUrl : '';
      const message = currentExport
        ? getGammaAdditionalExportUnsupportedMessage('pptx')
        : '当前任务未生成 PPTX 文件，请重新生成后再下载。';
      return NextResponse.json({
        generationId,
        status: 'failed',
        error: { code: 'EXPORT_FAILED', message },
      }, { status: 409 });
    }

    console.log('[ExportPPTX] 获取到PPTX URL:', pptxUrl.substring(0, 80));

    // Step 3: 后端代理下载PPTX（解决跨域/302问题）
    const downloadPptx = (withApiKey = false) => fetch(pptxUrl, {
      headers: {
        'User-Agent': GAMMA_UA,
        'Accept': MIME_TYPE,
        ...(withApiKey ? { 'X-API-KEY': apiKey } : {}),
      },
      redirect: 'follow',
      cache: 'no-store',
      signal: AbortSignal.timeout(120000),
    });

    let pptxRes = await downloadPptx();

    if (!pptxRes.ok) {
      // 部分 Gamma 导出地址仍要求 API key；首次失败时兼容重试一次。
      pptxRes = await downloadPptx(true);
      if (!pptxRes.ok) {
        console.error('[ExportPPTX] 下载PPTX失败:', pptxRes.status);
        return NextResponse.json({
          generationId,
          status: 'failed',
          error: { code: 'DOWNLOAD_FAILED', message: `下载PPTX失败: ${pptxRes.status}` },
        }, { status: 502 });
      }
    }

    let buffer = Buffer.from(await pptxRes.arrayBuffer());
    if (!isValidPptxBuffer(buffer)) {
      console.warn('[ExportPPTX] 首次响应不是有效 PPTX，使用 API key 重试', {
        bytes: buffer.length,
        contentType: pptxRes.headers.get('content-type'),
      });
      const retryRes = await downloadPptx(true);
      if (retryRes.ok) {
        buffer = Buffer.from(await retryRes.arrayBuffer());
      }
    }

    if (!isValidPptxBuffer(buffer)) {
      console.error('[ExportPPTX] 上游返回无效或不完整的 PPTX:', {
        bytes: buffer.length,
        contentType: pptxRes.headers.get('content-type'),
      });
      return NextResponse.json({
        generationId,
        status: 'failed',
        error: { code: 'INVALID_PPTX', message: '导出文件不完整，请重新下载或重新生成' },
      }, { status: 502 });
    }

    // Step 4: 返回PPTX文件
    const safeFilename = filename.replace(/[^\w\u4e00-\u9fff.\-]/g, '_');
    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        'Content-Type': MIME_TYPE,
        'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(safeFilename)}`,
        'Content-Length': buffer.length.toString(),
        'Cache-Control': 'no-store, max-age=0',
        'X-Content-Type-Options': 'nosniff',
      },
    });
  } catch (e: unknown) {
    const errorMessage = getErrorMessage(e);
    const errorName = e instanceof Error ? e.name : '';
    console.error('[ExportPPTX] Error:', errorMessage);
    if (errorName === 'AbortError' || errorName === 'TimeoutError') {
      return NextResponse.json({
        generationId,
        status: 'failed',
        error: { code: 'EXPORT_TIMEOUT', message: 'PPTX下载超时，请重试' },
      }, { status: 504 });
    }
    return NextResponse.json({
      generationId,
      status: 'failed',
      error: { code: 'DOWNLOAD_FAILED', message: errorMessage || '下载失败' },
    }, { status: 500 });
  }
}
