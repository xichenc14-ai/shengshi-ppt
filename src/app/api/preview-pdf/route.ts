import { NextRequest, NextResponse } from 'next/server';
import { selectBestKey } from '@/lib/gamma-key-pool';

const GAMMA_API_BASE = 'https://public-api.gamma.app/v1.0';

/**
 * 预览PDF导出API：调用Gamma Export API获取PDF文件URL
 * 流程：用户点击"在线预览" → 前端调用此API → 获取PDF URL → iframe预览
 * 注意：只返回PDF URL，不做代理（PDF文件大，适合直连）
 */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const generationId = searchParams.get('generationId');
  
  if (!generationId) {
    return NextResponse.json({ error: '缺少generationId' }, { status: 400 });
  }

  try {
    // 🚨 V8.6: 使用Key池选择
    const selectedKey = selectBestKey();
    const apiKey = selectedKey.key;

    // 1. 检查Gamma生成状态
    const statusRes = await fetch(`${GAMMA_API_BASE}/generations/${generationId}/status`, {
      headers: {
        'Authorization': `Bearer ${apiKey}`,
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

    // 3. 获取Gamma在线链接（fallback用）
    const gammaUrl = statusData.gammaUrl || statusData.deck?.url || '';

    // 4. 调用Gamma PDF导出API
    const exportRes = await fetch(`${GAMMA_API_BASE}/generations/${generationId}/export`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'User-Agent': 'Mozilla/5.0',
      },
      body: JSON.stringify({ format: 'pdf' }),
    });

    if (!exportRes.ok) {
      // 导出API失败，返回Gamma在线链接作为fallback
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

    // 5. 返回PDF预览URL
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