import { NextRequest, NextResponse } from 'next/server';
import { selectBestKey } from '@/lib/gamma-key-pool';

const GAMMA_API_BASE = 'https://public-api.gamma.app/v1.0';
const GAMMA_UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
const FORMAT = 'pdf' as const;
const MIME_TYPE = 'application/pdf';

/**
 * PDF下载代理API (D5: 统一错误处理)
 * 
 * 流程：
 * 1. 接收 generationId
 * 2. 后端调用 Gamma Export API 获取 PDF URL
 * 3. 后端服务器发起 fetch 获取真实 PDF 二进制流（处理302重定向）
 * 4. 返回时设置 Content-Disposition: attachment 强制下载
 * 
 * 错误响应格式（D5 canonical）:
 * { generationId, status: "failed", error: { code, message } }
 */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const generationId = searchParams.get('generationId');
  const filename = searchParams.get('filename') || `省心PPT.${FORMAT}`;

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

    // Step 1: 先检查生成状态（与 export-pptx 保持一致）
    const statusRes = await fetch(`${GAMMA_API_BASE}/generations/${generationId}`, {
      headers: {
        'X-API-KEY': apiKey,
        'User-Agent': GAMMA_UA,
      },
    });

    if (!statusRes.ok) {
      console.error('[DownloadPDF] 状态查询失败:', statusRes.status);
      return NextResponse.json({
        generationId,
        status: 'failed',
        error: { code: 'EXPORT_FAILED', message: `查询失败: ${statusRes.status}` },
      }, { status: 502 });
    }

    const statusData = await statusRes.json();
    console.log('[DownloadPDF] Generation 状态:', statusData.status);

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

    // Step 2: 调用 Gamma PDF 导出 API
    const exportRes = await fetch(`${GAMMA_API_BASE}/generations/${generationId}/export`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'User-Agent': GAMMA_UA,
      },
      body: JSON.stringify({ format: FORMAT }),
      signal: AbortSignal.timeout(60000),
    });

    if (!exportRes.ok) {
      const errText = await exportRes.text().catch(() => '');
      console.error('[DownloadPDF] Export失败:', exportRes.status, errText);
      return NextResponse.json({
        generationId,
        status: 'failed',
        error: { code: 'EXPORT_FAILED', message: `PDF导出失败: ${exportRes.status}` },
      }, { status: 502 });
    }

    const exportData = await exportRes.json();
    const pdfUrl = exportData.exportUrl || exportData.url;

    if (!pdfUrl) {
      return NextResponse.json({
        generationId,
        status: 'failed',
        error: { code: 'FILE_NOT_AVAILABLE', message: '未获取到 PDF 链接' },
      }, { status: 500 });
    }

    // Step 3: 后端代理获取 PDF 二进制流（处理 302 重定向）
    const pdfRes = await fetch(pdfUrl, {
      headers: { 'User-Agent': GAMMA_UA },
      redirect: 'follow',
      signal: AbortSignal.timeout(120000),
    });

    if (!pdfRes.ok) {
      return NextResponse.json({
        generationId,
        status: 'failed',
        error: { code: 'DOWNLOAD_FAILED', message: `获取 PDF 文件失败: ${pdfRes.status}` },
      }, { status: 502 });
    }

    const arrayBuffer = await pdfRes.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Step 4: 返回 PDF 二进制流（强制下载）
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
    console.error('[DownloadPDF] Error:', e.message);
    if (e.name === 'AbortError' || e.name === 'TimeoutError') {
      return NextResponse.json({
        generationId,
        status: 'failed',
        error: { code: 'EXPORT_TIMEOUT', message: 'PDF 下载超时，请重试' },
      }, { status: 504 });
    }
    return NextResponse.json({
      generationId,
      status: 'failed',
      error: { code: 'DOWNLOAD_FAILED', message: e.message || '下载失败' },
    }, { status: 500 });
  }
}
