import { NextRequest, NextResponse } from 'next/server';

const GAMMA_API_BASE = 'https://public-api.gamma.app/v1.0';
const GAMMA_UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

// 代理 Gamma PPT 预览页面（隐藏 Gamma 域名）
export async function GET(request: NextRequest) {
  try {
    const apiKey = process.env.GAMMA_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: '服务未配置' }, { status: 500 });
    }

    const { searchParams } = new URL(request.url);
    const gammaUrl = searchParams.get('url');

    if (!gammaUrl) {
      return NextResponse.json({ error: '缺少 url 参数' }, { status: 400 });
    }

    // 安全检查：只允许代理 gamma.app 域名
    try {
      const parsedUrl = new URL(gammaUrl);
      if (!parsedUrl.hostname.endsWith('gamma.app') && !parsedUrl.hostname.endsWith('api.gamma.app')) {
        return NextResponse.json({ error: '只支持代理 Gamma 预览链接' }, { status: 400 });
      }
    } catch {
      return NextResponse.json({ error: '无效的 URL' }, { status: 400 });
    }

    // 代理获取 Gamma 页面内容
    const response = await fetch(gammaUrl, {
      headers: {
        'User-Agent': GAMMA_UA,
      },
    });

    if (!response.ok) {
      return NextResponse.json({ error: '获取预览失败' }, { status: 502 });
    }

    const html = await response.text();

    // 替换页面中的所有 Gamma 域名引用为我们的代理路径
    const proxiedHtml = html
      .replace(/https:\/\/gamma\.app/g, `/api/preview/proxy`)
      .replace(/https:\/\/assets\.api\.gamma\.app/g, `/api/preview/proxy-assets`);

    return new NextResponse(proxiedHtml, {
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'public, max-age=300', // 缓存5分钟
        // 不设置 X-Frame-Options，允许 iframe 嵌入
      },
    });
  } catch (error: any) {
    console.error('Preview proxy error:', error);
    return NextResponse.json({ error: '预览失败' }, { status: 500 });
  }
}
