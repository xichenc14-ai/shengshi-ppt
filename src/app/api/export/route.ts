import { NextRequest, NextResponse } from 'next/server';
import { getPptBuffer } from './route.utils';

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

// GET: 支持两种模式
// 1. ?file=xxx → 从内存缓存读取（本地生成）
// 2. ?url=https://... → 从外部 URL 抓取并返回（外部下载代理，解决网络受限问题）
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const fileId = searchParams.get('file');
    const externalUrl = searchParams.get('url');
    const filename = searchParams.get('name') || '省心PPT.pptx';

    // 模式2：代理外部 URL（解决外部下载地址在部分网络环境下不可达的问题）
    if (externalUrl) {
      try {
        const upstreamRes = await fetch(externalUrl, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
          },
          signal: AbortSignal.timeout(120000),
        });

        if (!upstreamRes.ok) {
          return NextResponse.json({ error: '从外部源下载文件失败' }, { status: 502 });
        }

        const arrayBuffer = await upstreamRes.arrayBuffer();
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
        console.error('Upstream export fetch error:', err);
        return NextResponse.json({ error: '下载超时，请重试' }, { status: 504 });
      }
    }

    // 模式1：从内存缓存读取
    if (!fileId) {
      return NextResponse.json({ error: '缺少文件参数' }, { status: 400 });
    }

    const cached = getPptBuffer(fileId);
    if (!cached) {
      return NextResponse.json({ error: '文件不存在或已过期' }, { status: 404 });
    }

    // 注意：已过期检查由 utils 侧的 setInterval 处理，这里不做重复删除

    return new NextResponse(new Uint8Array(cached), {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
        'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`,
        'Content-Length': cached.length.toString(),
        'Cache-Control': 'no-cache',
      },
    });
  } catch (error: unknown) {
    console.error('Export error:', getErrorMessage(error));
    return NextResponse.json({ error: '下载失败' }, { status: 500 });
  }
}
