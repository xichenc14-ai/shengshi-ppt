import { NextRequest, NextResponse } from 'next/server';
import { selectBestKey } from '@/lib/gamma-key-pool';
import { extractPreviewFromGamma } from '@/lib/adapters/preview-adapter';
import { PreviewInfo } from '@/types/preview';

const GAMMA_API_BASE = 'https://public-api.gamma.app/v1.0';
const GAMMA_UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

/**
 * 预览信息API - D4 canonical
 * 
 * GET /api/preview?id={generationId}
 * 
 * 返回规范化的PreviewInfo结构
 * 
 * 功能：
 * - 查询Gamma生成状态
 * - 返回gammaUrl供前端"在新标签页中查看"
 * - 返回exportUrl供下载
 * - 明确embedAllowed=false（Gamma X-Frame-Options: SAMEORIGIN）
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const generationId = searchParams.get('id');

  if (!generationId) {
    return NextResponse.json({
      generationId: '',
      status: 'failed',
      gammaUrl: null,
      exportUrl: null,
      exportFormat: 'unknown',
      title: null,
      embedAllowed: false,
      embedNote: null,
      error: { code: 'MISSING_ID', message: '缺少generationId参数' },
    } as PreviewInfo, { status: 400 });
  }

  try {
    const selectedKey = selectBestKey();
    const apiKey = selectedKey.key;

    // 查询Gamma生成状态
    const response = await fetch(`${GAMMA_API_BASE}/generations/${generationId}`, {
      headers: {
        'X-API-KEY': apiKey,
        'User-Agent': GAMMA_UA,
      },
    });

    if (!response.ok) {
      return NextResponse.json({
        generationId,
        status: 'failed',
        gammaUrl: null,
        exportUrl: null,
        exportFormat: 'unknown',
        title: null,
        embedAllowed: false,
        embedNote: null,
        error: {
          code: 'EXPORT_FAILED',
          message: `查询失败: ${response.status}`,
          fallbackAction: 'download_pptx',
        },
      } as PreviewInfo, { status: 502 });
    }

    const data = await response.json();
    const previewInfo: PreviewInfo = extractPreviewFromGamma(data);
    
    return NextResponse.json(previewInfo);
    
  } catch (e: any) {
    console.error('[Preview] Error:', e.message);
    return NextResponse.json({
      generationId,
      status: 'failed',
      gammaUrl: null,
      exportUrl: null,
      exportFormat: 'unknown',
      title: null,
      embedAllowed: false,
      embedNote: null,
      error: { code: 'EXPORT_FAILED', message: e.message || '预览失败' },
    } as PreviewInfo, { status: 500 });
  }
}
