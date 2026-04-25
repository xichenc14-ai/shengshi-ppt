import { NextRequest, NextResponse } from 'next/server';
import { selectBestKey } from '@/lib/gamma-key-pool';

const GAMMA_API_BASE = 'https://public-api.gamma.app/v1.0';

/**
 * PDF预览代理API (v10.9)
 * 
 * 流程：
 * 1. 接收 generationId
 * 2. 后端调用 Gamma Export API 获取 PDF URL
 * 3. 后端服务器发起 fetch 获取真实 PDF 二进制流（处理302重定向）
 * 4. 将二进制流返回给前端，设置正确的 Content-Type 和 Content-Disposition
 * 
 * 前端拿到 blob 后通过 URL.createObjectURL() 渲染到 pdf.js/iframe
 * 彻底禁止前端直连 Gamma（解决 X-Frame-Options 防嵌套问题）
 */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const generationId = searchParams.get('generationId');

  if (!generationId) {
    return NextResponse.json({ error: '缺少 generationId' }, { status: 400 });
  }

  try {
    const selectedKey = selectBestKey();
    const apiKey = selectedKey.key;

    // Step 1: 调用 Gamma PDF 导出 API
    const exportRes = await fetch(`${GAMMA_API_BASE}/generations/${generationId}/export`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
      },
      body: JSON.stringify({ format: 'pdf' }),
      signal: AbortSignal.timeout(60000),
    });

    if (!exportRes.ok) {
      // 如果导出失败，尝试直接获取 generation 状态来检查是否已完成
      const statusRes = await fetch(`${GAMMA_API_BASE}/generations/${generationId}`, {
        headers: {
          'X-API-KEY': apiKey,
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
        },
      });
      if (statusRes.ok) {
        const statusData = await statusRes.json();
        if (statusData.status === 'pending' || statusData.status === 'in_progress') {
          return NextResponse.json({ status: 'generating', message: 'PPT 正在生成中，请稍后再试' });
        }
        if (statusData.status === 'failed') {
          return NextResponse.json({ error: statusData.error || '生成失败' }, { status: 500 });
        }
      }
      return NextResponse.json({ error: `PDF 导出失败: ${exportRes.status}` }, { status: 502 });
    }

    const exportData = await exportRes.json();
    const pdfUrl = exportData.exportUrl || exportData.url;

    if (!pdfUrl) {
      return NextResponse.json({ error: '未获取到 PDF 链接' }, { status: 500 });
    }

    // Step 2: 后端代理获取 PDF 二进制流（处理 302 重定向）
    const pdfRes = await fetch(pdfUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
      },
      redirect: 'follow', // 自动跟随 302 重定向
      signal: AbortSignal.timeout(120000),
    });

    if (!pdfRes.ok) {
      return NextResponse.json({ error: `获取 PDF 文件失败: ${pdfRes.status}` }, { status: 502 });
    }

    const arrayBuffer = await pdfRes.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Step 3: 返回 PDF 二进制流给前端（inline 预览）
    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': 'inline; filename="preview.pdf"',
        'Content-Length': buffer.length.toString(),
        'Cache-Control': 'private, max-age=300',
      },
    });
  } catch (e: any) {
    console.error('[ProxyPDF] Error:', e.message);
    if (e.name === 'AbortError' || e.name === 'TimeoutError') {
      return NextResponse.json({ error: 'PDF 获取超时，请重试' }, { status: 504 });
    }
    return NextResponse.json({ error: e.message || '预览失败' }, { status: 500 });
  }
}
