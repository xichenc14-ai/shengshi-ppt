import { NextRequest, NextResponse } from 'next/server';

// 简易内存缓存（Vercel Serverless 单实例内有效）
const pptCache = new Map<string, { buffer: Buffer; createdAt: number }>();
const CACHE_TTL = 5 * 60 * 1000;

export function registerPptBuffer(fileId: string, buffer: Buffer) {
  pptCache.set(fileId, { buffer, createdAt: Date.now() });
}

setInterval(() => {
  const now = Date.now();
  for (const [key, val] of pptCache.entries()) {
    if (now - val.createdAt > CACHE_TTL) pptCache.delete(key);
  }
}, 60 * 1000);

// GET: 支持两种模式
// 1. ?file=xxx → 从内存缓存读取（本地生成）
// 2. ?url=https://... → 从外部 URL 抓取并返回（Gamma 下载代理，解决墙问题）
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const fileId = searchParams.get('file');
    const externalUrl = searchParams.get('url');
    const filename = searchParams.get('name') || '省心PPT.pptx';

    // 模式2：代理外部 URL（解决 assets.api.gamma.app 在国内被墙的问题）
    if (externalUrl) {
      try {
        const gammaRes = await fetch(externalUrl, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
          },
          signal: AbortSignal.timeout(30000),
        });

        if (!gammaRes.ok) {
          return NextResponse.json({ error: '从 Gamma 下载文件失败' }, { status: 502 });
        }

        const arrayBuffer = await gammaRes.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);

        return new NextResponse(new Uint8Array(buffer), {
          status: 200,
          headers: {
            'Content-Type': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
            'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`,
            'Content-Length': buffer.length.toString(),
            'Cache-Control': 'private, max-age=300',
          },
        });
      } catch (err) {
        console.error('Gamma proxy fetch error:', err);
        return NextResponse.json({ error: '下载超时，请重试' }, { status: 504 });
      }
    }

    // 模式1：从内存缓存读取
    if (!fileId) {
      return NextResponse.json({ error: '缺少文件参数' }, { status: 400 });
    }

    const cached = pptCache.get(fileId);
    if (!cached) {
      return NextResponse.json({ error: '文件不存在或已过期' }, { status: 404 });
    }

    if (Date.now() - cached.createdAt > CACHE_TTL) {
      pptCache.delete(fileId);
      return NextResponse.json({ error: '文件已过期' }, { status: 410 });
    }

    return new NextResponse(new Uint8Array(cached.buffer), {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
        'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`,
        'Content-Length': cached.buffer.length.toString(),
        'Cache-Control': 'no-cache',
      },
    });
  } catch (error: any) {
    console.error('Export error:', error);
    return NextResponse.json({ error: '下载失败' }, { status: 500 });
  }
}
