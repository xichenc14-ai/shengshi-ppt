import { NextRequest, NextResponse } from 'next/server';

const GAMMA_API_BASE = 'https://public-api.gamma.app/v1.0';

/**
 * 预览API：服务端预下载Gamma导出的PDF，返回给前端展示
 * 流程：用户点击"在线预览" → 此API获取Gamma PDF → 新窗口打开PDF
 */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const generationId = searchParams.get('generationId');
  
  if (!generationId) {
    return NextResponse.json({ error: '缺少generationId' }, { status: 400 });
  }

  try {
    // 1. 获取Gamma生成状态
    const statusRes = await fetch(`${GAMMA_API_BASE}/generations/${generationId}/status`, {
      headers: {
        'Authorization': `Bearer ${process.env.GAMMA_API_KEY}`,
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
      },
    });

    if (!statusRes.ok) {
      return NextResponse.json({ error: '获取Gamma状态失败' }, { status: 500 });
    }

    const statusData = await statusRes.json();
    
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

    // 3. 获取PDF导出链接（Gamma支持PDF导出）
    const gammaUrl = statusData.gammaUrl || statusData.deck?.url;
    if (!gammaUrl) {
      return NextResponse.json({ error: '未找到Gamma链接' }, { status: 500 });
    }

    // 4. 请求Gamma导出PDF（使用Gamma的导出API）
    const exportRes = await fetch(`${GAMMA_API_BASE}/generations/${generationId}/export`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.GAMMA_API_KEY}`,
        'Content-Type': 'application/json',
        'User-Agent': 'Mozilla/5.0',
      },
      body: JSON.stringify({ format: 'pdf' }),
    });

    if (!exportRes.ok) {
      // 如果导出API失败，直接返回Gamma在线链接让用户去看
      return NextResponse.json({ 
        status: 'fallback',
        gammaUrl: gammaUrl,
        message: 'PDF导出失败，请直接查看Gamma在线版本'
      });
    }

    const exportData = await exportRes.json();
    const pdfUrl = exportData.exportUrl || exportData.url;

    if (!pdfUrl) {
      return NextResponse.json({ 
        status: 'fallback',
        gammaUrl: gammaUrl,
        message: '未获取到PDF链接，请查看Gamma在线版本'
      });
    }

    // 5. 返回PDF预览URL
    return NextResponse.json({
      status: 'ready',
      pdfUrl: pdfUrl,
      gammaUrl: gammaUrl,
      message: 'PDF已准备好，新窗口打开预览'
    });

  } catch (e: any) {
    console.error('[Preview] Error:', e.message);
    return NextResponse.json({ error: e.message || '预览失败' }, { status: 500 });
  }
}