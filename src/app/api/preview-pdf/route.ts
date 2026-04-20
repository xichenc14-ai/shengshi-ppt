import { NextRequest, NextResponse } from 'next/server';
import { selectBestKey } from '@/lib/gamma-key-pool';

const GAMMA_API_BASE = 'https://public-api.gamma.app/v1.0';

/**
 * 预览PDF导出API
 * 流程：用户点击"在线预览" → 前端调用此API → 获取PDF URL → 前端渲染预览
 * V9: 修复 status endpoint + apiKey 定义
 */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const generationId = searchParams.get('generationId');

  if (!generationId) {
    return NextResponse.json({ error: '缺少generationId' }, { status: 400 });
  }

  try {
    // V9: 获取 API Key
    const selectedKey = selectBestKey();
    const apiKey = selectedKey.key;

    // 1. 查询 Gamma 生成状态（正确的 endpoint）
    const statusRes = await fetch(`${GAMMA_API_BASE}/generations/${generationId}`, {
      headers: {
        'X-API-KEY': apiKey,
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
      },
    });

    if (!statusRes.ok) {
      console.error('[PreviewPDF] Gamma status error:', statusRes.status, await statusRes.text());
      return NextResponse.json({ error: `获取Gamma状态失败: ${statusRes.status}` }, { status: 502 });
    }

    const statusData = await statusRes.json();
    console.log('[PreviewPDF] Gamma status:', statusData.status, '| gammaUrl:', statusData.gammaUrl);

    // 2. 检查生成状态
    if (statusData.status === 'pending' || statusData.status === 'in_progress') {
      return NextResponse.json({
        status: 'generating',
        message: 'PPT正在生成中，请稍后再试'
      });
    }

    if (statusData.status === 'failed') {
      return NextResponse.json({ error: statusData.error || '生成失败' }, { status: 500 });
    }

    // 3. 获取 Gamma 在线链接
    const gammaUrl = statusData.gammaUrl || statusData.deck?.url || '';

    // 4. 调用 Gamma PDF 导出 API
    const exportRes = await fetch(`${GAMMA_API_BASE}/generations/${generationId}/export`, {
      method: 'POST',
      headers: {
        'X-API-KEY': apiKey,
        'Content-Type': 'application/json',
        'User-Agent': 'Mozilla/5.0',
      },
      body: JSON.stringify({ format: 'pdf' }),
    });

    if (!exportRes.ok) {
      console.error('[PreviewPDF] Export API error:', exportRes.status, await exportRes.text());
      return NextResponse.json({
        status: 'fallback',
        gammaUrl: gammaUrl,
        message: 'PDF导出失败，请稍后重试'
      });
    }

    const exportData = await exportRes.json();
    const pdfUrl = exportData.exportUrl || exportData.url;

    if (!pdfUrl) {
      return NextResponse.json({
        status: 'fallback',
        gammaUrl: gammaUrl,
        message: '未获取到PDF链接'
      });
    }

    // 5. 返回 PDF 预览 URL
    return NextResponse.json({
      status: 'ready',
      pdfUrl: pdfUrl,
      gammaUrl: gammaUrl,
    });

  } catch (e: any) {
    console.error('[PreviewPDF] Error:', e.message, e.stack);
    return NextResponse.json({ error: e.message || '预览失败' }, { status: 500 });
  }
}
