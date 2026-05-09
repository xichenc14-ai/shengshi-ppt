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

  const startTime = Date.now();

  try {
    const selectedKey = selectBestKey();
    const apiKey = selectedKey.key;

    // [D5] Step 1: 先检查生成状态（与 export-pptx 保持一致）
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

    // [D5] 预检：检查总耗时，如果已超过 120s 则自动降级
    const elapsedMs = Date.now() - startTime;
    if (elapsedMs >= 120000) {
      console.warn('[DownloadPDF] 已超过 120s 限制，自动降级为 PPTX fallback');
      return NextResponse.json({
        generationId,
        status: 'degraded',
        error: { code: 'EXPORT_TIMEOUT_DEGRADED', message: 'PDF 导出超时，建议下载 PPTX' },
        fallbackPptx: true,
        pptxUrl: statusData.exportUrl || statusData.deck?.url || null,
      }, { status: 200 });
    }

    // [D5] Step 2: 尝试 post /exports 复数端点（先尝试更可靠的端点）
    let pdfUrl = '';

    // 先检查是否有现成的 exportUrl
    if (statusData.exportUrl && statusData.exportUrl.toLowerCase().includes('.pdf')) {
      pdfUrl = statusData.exportUrl;
      console.log('[DownloadPDF] 使用已有 PDF URL:', pdfUrl);
    }

    // 如果没有现成的，调用导出 API
    if (!pdfUrl) {
      // 先尝试复数端点 /exports
      const exportsRes = await fetch(`${GAMMA_API_BASE}/generations/${generationId}/exports`, {
        method: 'POST',
        headers: {
          'X-API-KEY': apiKey,
          'Content-Type': 'application/json',
          'User-Agent': GAMMA_UA,
        },
        body: JSON.stringify({ format: FORMAT }),
        signal: AbortSignal.timeout(30000), // 30s 超时
      });

      if (exportsRes.ok) {
        const exportsData = await exportsRes.json();
        if (exportsData.url) {
          pdfUrl = exportsData.url;
        } else if (exportsData.exportUrl) {
          pdfUrl = exportsData.exportUrl;
        } else if (exportsData.pdfUrl) {
          pdfUrl = exportsData.pdfUrl;
        } else if (exportsData.downloadUrl) {
          pdfUrl = exportsData.downloadUrl;
        } else if (exportsData.id || exportsData.exportId) {
          // 需要轮询等待导出完成
          const exportId = exportsData.id || exportsData.exportId;
          console.log('[DownloadPDF] 开始轮询导出任务:', exportId);

          for (let i = 0; i < 15; i++) {
            // [D5] 每次轮询前检查总耗时
            if (Date.now() - startTime >= 120000) {
              console.warn('[DownloadPDF] 轮询超 120s，自动降级 fallback');
              return NextResponse.json({
                generationId,
                status: 'degraded',
                error: { code: 'EXPORT_TIMEOUT_DEGRADED', message: 'PDF 导出超时，建议下载 PPTX' },
                fallbackPptx: true,
              }, { status: 200 });
            }

            await new Promise(r => setTimeout(r, 2000));

            const checkRes = await fetch(`${GAMMA_API_BASE}/generations/${generationId}/exports/${exportId}`, {
              headers: {
                'X-API-KEY': apiKey,
                'User-Agent': GAMMA_UA,
              },
            });

            if (!checkRes.ok) {
              console.warn('[DownloadPDF] 查询导出状态失败:', checkRes.status);
              continue;
            }

            const checkData = await checkRes.json();
            console.log(`[DownloadPDF] 轮询 ${i+1}/15, 状态: ${checkData.status || 'unknown'}`);

            if (checkData.url || checkData.exportUrl || checkData.pdfUrl || checkData.downloadUrl) {
              pdfUrl = checkData.url || checkData.exportUrl || checkData.pdfUrl || checkData.downloadUrl;
              console.log('[DownloadPDF] PDF 导出完成:', pdfUrl);
              break;
            }

            if (checkData.status === 'failed' || checkData.error) {
              console.error('[DownloadPDF] PDF 导出失败:', checkData.error);
              return NextResponse.json({
                generationId,
                status: 'degraded',
                error: { code: 'EXPORT_FAILED', message: checkData.error || 'PDF 导出失败' },
                fallbackPptx: true,
              }, { status: 200 });
            }

            if (checkData.status === 'completed' || checkData.status === 'ready') {
              pdfUrl = checkData.url || checkData.exportUrl || checkData.pdfUrl || checkData.downloadUrl;
              if (pdfUrl) {
                console.log('[DownloadPDF] 导出完成:', pdfUrl);
                break;
              }
            }
          }
        }

        // 如果复数端点未返回 URL，尝试单数端点
        if (!pdfUrl) {
          console.log('[DownloadPDF] /exports 未返回 URL，尝试 /export fallback...');
          const fallbackExportRes = await fetch(`${GAMMA_API_BASE}/generations/${generationId}/export`, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${apiKey}`,
              'Content-Type': 'application/json',
              'User-Agent': GAMMA_UA,
            },
            body: JSON.stringify({ format: FORMAT }),
            signal: AbortSignal.timeout(30000),
          });

          if (fallbackExportRes.ok) {
            const fallbackData = await fallbackExportRes.json();
            pdfUrl = fallbackData.exportUrl || fallbackData.url || '';
            console.log('[DownloadPDF] /export fallback 成功:', pdfUrl);
          }
        }
      } else {
        // 复数端点失败，尝试单数端点
        console.log('[DownloadPDF] /exports 失败，尝试 /export fallback...');
        const fallbackExportRes = await fetch(`${GAMMA_API_BASE}/generations/${generationId}/export`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
            'User-Agent': GAMMA_UA,
          },
          body: JSON.stringify({ format: FORMAT }),
          signal: AbortSignal.timeout(30000),
        });

        if (fallbackExportRes.ok) {
          const fallbackData = await fallbackExportRes.json();
          pdfUrl = fallbackData.exportUrl || fallbackData.url || '';
          console.log('[DownloadPDF] /export fallback 成功:', pdfUrl);
        }
      }
    }

    if (!pdfUrl) {
      console.error('[DownloadPDF] 未获取到 PDF 链接');
      return NextResponse.json({
        generationId,
        status: 'degraded',
        error: { code: 'FILE_NOT_AVAILABLE', message: '未获取到 PDF 链接' },
        fallbackPptx: true,
      }, { status: 200 });
    }

    // [D5] Step 3: 下载前再次检查总耗时
    if (Date.now() - startTime >= 120000) {
      console.warn('[DownloadPDF] 下载前已超 120s，自动降级');
      return NextResponse.json({
        generationId,
        status: 'degraded',
        error: { code: 'EXPORT_TIMEOUT_DEGRADED', message: 'PDF 下载超时，建议下载 PPTX' },
        fallbackPptx: true,
      }, { status: 200 });
    }

    // 后端代理获取 PDF 二进制流（处理 302 重定向）
    const pdfRes = await fetch(pdfUrl, {
      headers: { 'User-Agent': GAMMA_UA },
      redirect: 'follow',
      signal: AbortSignal.timeout(60000),
    });

    if (!pdfRes.ok) {
      console.error('[DownloadPDF] 获取 PDF 文件失败:', pdfRes.status);
      return NextResponse.json({
        generationId,
        status: 'degraded',
        error: { code: 'DOWNLOAD_FAILED', message: `获取 PDF 文件失败: ${pdfRes.status}` },
        fallbackPptx: true,
      }, { status: 200 });
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
