import { NextRequest, NextResponse } from 'next/server';
import { getPptBuffer } from './route.utils';

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

// GET: 仅开发环境保留 ?file=xxx 内存缓存读取；生产环境整体停用。
export async function GET(request: NextRequest) {
  try {
    if (process.env.NODE_ENV === 'production') {
      return NextResponse.json({
        error: '旧版内存导出接口已停用，请使用受保护的 PPTX/PDF 导出接口',
        code: 'LEGACY_EXPORT_DISABLED',
      }, { status: 410 });
    }

    const { searchParams } = new URL(request.url);
    const fileId = searchParams.get('file');
    const externalUrl = searchParams.get('url');
    const filename = searchParams.get('name') || '省心PPT.pptx';

    // 安全策略：禁止把任意外部 URL 交给服务端抓取，避免 SSRF 与带宽滥用。
    if (externalUrl) {
      return NextResponse.json({
        error: '外部 URL 代理模式已停用',
        code: 'EXTERNAL_EXPORT_PROXY_DISABLED',
      }, { status: 410 });
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
