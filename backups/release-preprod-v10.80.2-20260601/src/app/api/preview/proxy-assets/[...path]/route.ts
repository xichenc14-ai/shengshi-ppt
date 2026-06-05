import { NextRequest, NextResponse } from 'next/server';

const GAMMA_UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

// 代理 Gamma 资源（图片、CSS、JS等）
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const url = searchParams.get('url');

    if (!url) {
      return NextResponse.json({ error: '缺少 url' }, { status: 400 });
    }

    // 只允许代理 gamma.app 和 assets.api.gamma.app 的资源
    const allowedHosts = ['gamma.app', 'assets.api.gamma.app', 'www.gamma.app'];
    try {
      const parsedUrl = new URL(url);
      if (!allowedHosts.some(h => parsedUrl.hostname.endsWith(h))) {
        return NextResponse.json({ error: '不允许的域名' }, { status: 403 });
      }
    } catch {
      return NextResponse.json({ error: '无效URL' }, { status: 400 });
    }

    const response = await fetch(url, {
      headers: {
        'User-Agent': GAMMA_UA,
        'Accept': request.headers.get('Accept') || '*/*',
      },
    });

    if (!response.ok) {
      return new NextResponse('Not found', { status: response.status });
    }

    const contentType = response.headers.get('content-type') || 'application/octet-stream';
    const buffer = Buffer.from(await response.arrayBuffer());

    return new NextResponse(buffer, {
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=3600',
        'Access-Control-Allow-Origin': '*',
      },
    });
  } catch (error: any) {
    return NextResponse.json({ error: '资源获取失败' }, { status: 500 });
  }
}
