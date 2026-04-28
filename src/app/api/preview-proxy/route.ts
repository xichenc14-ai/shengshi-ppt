import { NextRequest, NextResponse } from 'next/server';
import { selectBestKey } from '@/lib/gamma-key-pool';

const GAMMA_API_BASE = 'https://public-api.gamma.app/v1.0';
const GAMMA_UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

/**
 * 预览信息 API - v10.14.1
 * 
 * 功能：查询 Gamma 生成状态，返回 gammaUrl 供前端"在新标签页中查看"
 * 
 * 根因：Gamma API GET /generations/{id} 不返回 cards/previewUrl 字段
 * （API 仅返回 generationId, status, gammaUrl, exportUrl, credits）
 * 所以内嵌预览不可行，唯一可行方案是打开新标签页
 * 
 * Gamma 网站 X-Frame-Options: SAMEORIGIN → iframe 不可行
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const generationId = searchParams.get('id');

  if (!generationId) {
    return NextResponse.json({ error: '缺少 generationId 参数' }, { status: 400 });
  }

  try {
    const selectedKey = selectBestKey();
    const apiKey = selectedKey.key;

    // 查询 Gamma 生成状态
    const response = await fetch(`${GAMMA_API_BASE}/generations/${generationId}`, {
      headers: {
        'X-API-KEY': apiKey,
        'User-Agent': GAMMA_UA,
      },
    });

    if (!response.ok) {
      return NextResponse.json({ 
        error: `查询失败: ${response.status}`,
        detail: await response.text().catch(() => '')
      }, { status: 502 });
    }

    const data = await response.json();

    // Gamma API 标准字段：gammaUrl, exportUrl, status, credits
    // 注意：没有 cards/previewUrl 字段
    const gammaUrl = data.gammaUrl || data.deck?.url || '';
    const exportUrl = data.exportUrl || '';
    const status = data.status || '';
    const credits = data.credits || null;

    return NextResponse.json({
      generationId: data.generationId || data.id,
      status,
      gammaUrl,
      exportUrl,
      credits,
    });
  } catch (e: any) {
    console.error('[PreviewProxy] Error:', e.message);
    return NextResponse.json({ error: e.message || '预览失败' }, { status: 500 });
  }
}
