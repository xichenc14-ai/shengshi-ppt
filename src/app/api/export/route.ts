import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const fileId = searchParams.get('file');

    if (!fileId) {
      return NextResponse.json({ error: '缺少文件参数' }, { status: 400 });
    }

    const filePath = path.join('/tmp/ppt-output', `${fileId}.pptx`);

    if (!fs.existsSync(filePath)) {
      return NextResponse.json({ error: '文件不存在或已过期' }, { status: 404 });
    }

    const buffer = fs.readFileSync(filePath);
    const filename = `省心PPT_${fileId}.pptx`;

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
        'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`,
        'Content-Length': buffer.length.toString(),
        'Cache-Control': 'no-cache',
      },
    });
  } catch (error: any) {
    console.error('Export error:', error);
    return NextResponse.json({ error: '下载失败' }, { status: 500 });
  }
}
