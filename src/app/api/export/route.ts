import { NextRequest, NextResponse } from 'next/server';

// 简易内存缓存（Vercel Serverless 单实例内有效，足够短时间内的下载）
// Key: fileId, Value: { buffer, createdAt }
const pptCache = new Map<string, { buffer: Buffer; createdAt: number }>();

// 缓存过期时间：5 分钟
const CACHE_TTL = 5 * 60 * 1000;

// 供 pptx-generator 注册文件到缓存
export function registerPptBuffer(fileId: string, buffer: Buffer) {
  pptCache.set(fileId, { buffer, createdAt: Date.now() });
}

// 定期清理过期缓存
setInterval(() => {
  const now = Date.now();
  for (const [key, val] of pptCache.entries()) {
    if (now - val.createdAt > CACHE_TTL) {
      pptCache.delete(key);
    }
  }
}, 60 * 1000);

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const fileId = searchParams.get('file');

    if (!fileId) {
      return NextResponse.json({ error: '缺少文件参数' }, { status: 400 });
    }

    const cached = pptCache.get(fileId);
    if (!cached) {
      return NextResponse.json({ error: '文件不存在或已过期（请重新生成）' }, { status: 404 });
    }

    // 检查是否过期
    if (Date.now() - cached.createdAt > CACHE_TTL) {
      pptCache.delete(fileId);
      return NextResponse.json({ error: '文件已过期（请重新生成）' }, { status: 410 });
    }

    const filename = `省心PPT_${fileId}.pptx`;

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
