import { NextRequest, NextResponse } from 'next/server';
import { selectBestKey } from '@/lib/gamma-key-pool';

const GAMMA_API_BASE = 'https://public-api.gamma.app/v1.0';
const GAMMA_UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

/**
 * 预览PDF导出API：调用Gamma Export API获取PDF文件URL
 * 流程：用户点击"在线预览" → 前端调用此API → 获取PDF URL → iframe预览
 * 注意：只返回PDF URL，不做代理（PDF文件大，适合直连）
 *
 * P1 Fix (参考 export-pdf/route.ts):
 * 1. 使用 /generations/${id} 而非 /generations/${id}/status
 * 2. 使用 /exports 复数而非 /export 单数
 * 3. 添加轮询机制等待导出完成
 */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const generationId = searchParams.get('generationId');

  if (!generationId) {
    return NextResponse.json({ error: '缺少generationId' }, { status: 400 });
  }

  try {
    const selectedKey = selectBestKey();
    const apiKey = selectedKey.key;

    // Step 1: 检查generation状态（使用正确端点 /generations/${id}）
    const statusRes = await fetch(`${GAMMA_API_BASE}/generations/${generationId}`, {
      headers: {
        'X-API-KEY': apiKey,
        'User-Agent': GAMMA_UA,
      },
    });

    if (!statusRes.ok) {
      return NextResponse.json({ error: `获取状态失败: ${statusRes.status}` }, { status: 502 });
    }

    const statusData = await statusRes.json();

    // 检查生成状态
    if (statusData.status === 'pending' || statusData.status === 'in_progress' || statusData.status === 'processing') {
      return NextResponse.json({
        status: 'generating',
        message: 'PPT正在生成中，请稍后再试',
      });
    }

    if (statusData.status === 'failed') {
      return NextResponse.json({ error: statusData.error || '生成失败' }, { status: 500 });
    }

    // 获取Gamma在线链接（fallback用）
    const gammaUrl = statusData.gammaUrl || statusData.deck?.url || '';

    // Step 2: 如果已有exportUrl（之前已导出），直接返回
    let pdfUrl = '';
    if (statusData.exportUrl && statusData.exportUrl.toLowerCase().includes('.pdf')) {
      pdfUrl = statusData.exportUrl;
    }

    // Step 3: 如果没有PDF URL，调用 /exports API（复数）创建导出任务
    if (!pdfUrl) {
      // 调用 /generations/${id}/exports（复数，正确）
      const exportRes = await fetch(`${GAMMA_API_BASE}/generations/${generationId}/exports`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-KEY': apiKey,
          'User-Agent': GAMMA_UA,
        },
        body: JSON.stringify({ format: 'pdf' }),
      });

      if (!exportRes.ok) {
        // 导出API失败，返回Gamma在线链接作为fallback
        return NextResponse.json({
          status: 'fallback',
          gammaUrl: gammaUrl,
          message: 'PDF导出失败，请稍后重试',
        });
      }

      const exportData = await exportRes.json();

      // 直接返回URL
      if (exportData.url) {
        pdfUrl = exportData.url;
      } else if (exportData.exportUrl) {
        pdfUrl = exportData.exportUrl;
      } else if (exportData.pdfUrl) {
        pdfUrl = exportData.pdfUrl;
      } else if (exportData.downloadUrl) {
        pdfUrl = exportData.downloadUrl;
      } else if (exportData.id || exportData.exportId) {
        // 需要轮询等待导出完成（轮询 /exports/${exportId}）
        const exportId = exportData.id || exportData.exportId;

        for (let i = 0; i < 20; i++) {
          await new Promise(r => setTimeout(r, 2000));

          const checkRes = await fetch(`${GAMMA_API_BASE}/generations/${generationId}/exports/${exportId}`, {
            headers: {
              'X-API-KEY': apiKey,
              'User-Agent': GAMMA_UA,
            },
          });

          if (!checkRes.ok) {
            continue;
          }

          const checkData = await checkRes.json();

          if (checkData.url || checkData.exportUrl || checkData.pdfUrl || checkData.downloadUrl) {
            pdfUrl = checkData.url || checkData.exportUrl || checkData.pdfUrl || checkData.downloadUrl;
            break;
          }

          if (checkData.status === 'failed' || checkData.error) {
            return NextResponse.json({
              status: 'fallback',
              gammaUrl: gammaUrl,
              error: checkData.error || 'PDF导出失败',
            }, { status: 500 });
          }

          if (checkData.status === 'completed' || checkData.status === 'ready') {
            pdfUrl = checkData.url || checkData.exportUrl || checkData.pdfUrl || checkData.downloadUrl;
            if (pdfUrl) break;
          }
        }
      }
    }

    // Step 4: 如果最终没有获取到PDF URL
    if (!pdfUrl) {
      return NextResponse.json({
        status: 'fallback',
        gammaUrl: gammaUrl,
        message: 'PDF导出超时，请稍后重试',
      });
    }

    // Step 5: 返回PDF预览URL
    return NextResponse.json({
      status: 'ready',
      pdfUrl: pdfUrl,
      gammaUrl: gammaUrl,
    });

  } catch (e: any) {
    console.error('[PreviewPDF] Error:', e.message);
    return NextResponse.json({ error: e.message || '预览失败' }, { status: 500 });
  }
}
