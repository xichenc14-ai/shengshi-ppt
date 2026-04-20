import { NextRequest, NextResponse } from 'next/server';
import { selectBestKey } from '@/lib/gamma-key-pool';

const GAMMA_API_BASE = 'https://public-api.gamma.app/v1.0';

/**
 * 预览PDF导出API
 * 流程：用户点击"在线预览" → 前端调用此API → 获取PDF URL → 前端渲染预览
 * V9修复：
 * 1. status endpoint 正确（/generations/{id}，不是 /status）
 * 2. exportUrl 直接从状态返回，不需要单独调用 export API
 * 3. apiKey 正确获取
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

    // 1. 查询 Gamma 生成状态
    const statusRes = await fetch(`${GAMMA_API_BASE}/generations/${generationId}`, {
      headers: {
        'X-API-KEY': apiKey,
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
      },
    });

    if (!statusRes.ok) {
      console.error('[PreviewPDF] Gamma status error:', statusRes.status);
      return NextResponse.json({ error: `获取Gamma状态失败: ${statusRes.status}` }, { status: 502 });
    }

    const statusData = await statusRes.json();
    console.log('[PreviewPDF] status:', statusData.status, '| exportUrl:', !!statusData.exportUrl);

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

    // 3. 直接从状态获取 exportUrl（无需再调 export API）
    const gammaUrl = statusData.gammaUrl || '';
    const exportUrl = statusData.exportUrl || '';

    if (!exportUrl) {
      return NextResponse.json({
        status: 'fallback',
        gammaUrl: gammaUrl,
        message: 'PDF导出链接暂不可用，请稍后重试'
      });
    }

    // 4. 返回 PDF 预览 URL
    return NextResponse.json({
      status: 'ready',
      pdfUrl: exportUrl,
      gammaUrl: gammaUrl,
    });

  } catch (e: any) {
    console.error('[PreviewPDF] Error:', e.message);
    return NextResponse.json({ error: e.message || '预览失败' }, { status: 500 });
  }
}
