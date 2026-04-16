import { NextRequest, NextResponse } from 'next/server';

const GAMMA_UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

// GET /api/preview/watermarked?gammaUrl=xxx
// 代理 Gamma 预览页面，注入水印，返回可嵌入的 HTML
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const gammaUrl = searchParams.get('gammaUrl');

    if (!gammaUrl) {
      return NextResponse.json({ error: '缺少 gammaUrl 参数' }, { status: 400 });
    }

    // 获取 Gamma 页面内容
    const response = await fetch(gammaUrl, {
      headers: {
        'User-Agent': GAMMA_UA,
      },
    });

    if (!response.ok) {
      return NextResponse.json({ error: '获取预览失败，请稍后重试' }, { status: 502 });
    }

    const html = await response.text();

    // 注入水印 CSS + 水印 DOM overlay
    const watermarkStyle = `
      <style>
        .xch-watermark-overlay {
          position: fixed;
          top: 0; left: 0; right: 0; bottom: 0;
          pointer-events: none;
          z-index: 9999;
          overflow: hidden;
        }
        .xch-watermark-overlay::before {
          content: '';
          position: absolute;
          top: -20%;
          left: -20%;
          width: 140%;
          height: 140%;
          background-image: repeating-linear-gradient(
            -45deg,
            transparent,
            transparent 60px,
            rgba(100,100,100,0.05) 60px,
            rgba(100,100,100,0.05) 120px
          );
          background-size: 200px 200px;
        }
        .xch-watermark-text {
          position: absolute;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%) rotate(-30deg);
          font-size: 48px;
          font-weight: bold;
          color: rgba(180,180,180,0.12);
          white-space: nowrap;
          pointer-events: none;
          user-select: none;
          font-family: system-ui, -apple-system, sans-serif;
          letter-spacing: 8px;
        }
        .xch-watermark-label {
          position: fixed;
          bottom: 16px;
          right: 20px;
          background: rgba(0,0,0,0.55);
          color: white;
          padding: 6px 14px;
          border-radius: 20px;
          font-size: 12px;
          pointer-events: none;
          z-index: 10000;
          font-family: system-ui, -apple-system, sans-serif;
        }
      </style>
    `;

    const watermarkHtml = `
      <div class="xch-watermark-overlay">
        <div class="xch-watermark-text">省心PPT · 仅供预览</div>
      </div>
      <div class="xch-watermark-label">📄 预览版 · 确认下载获得完整PPT</div>
    `;

    // 注入水印样式到 <head>，注入水印 DOM 到 </body>
    let proxiedHtml = html
      .replace(/<head([^>]*)>/i, `<head$1>${watermarkStyle}`)
      .replace(/https:\/\/gamma\.app/g, `/api/preview/proxy`)
      .replace(/https:\/\/assets\.api\.gamma\.app/g, `/api/preview/proxy-assets`)
      .replace(/<\/body>/i, `${watermarkHtml}</body>`);

    // 移除 X-Frame-Options 让同域 iframe 可加载
    proxiedHtml = proxiedHtml
      .replace(/X-Frame-Options[^\n]*/gi, '')
      .replace(/x-frame-options[^\n]*/gi, '');

    return new NextResponse(proxiedHtml, {
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'no-cache',
        'X-Frame-Options': 'SAMEORIGIN',
      },
    });
  } catch (error: any) {
    console.error('[Preview/Watermarked] Error:', error);
    return NextResponse.json({ error: '预览失败: ' + error.message }, { status: 500 });
  }
}
