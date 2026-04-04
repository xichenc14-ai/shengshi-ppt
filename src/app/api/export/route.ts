import { NextRequest, NextResponse } from 'next/server';
import { exportToPPTX } from '@/lib/pptx-export';
import { Presentation } from '@/lib/types';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { presentation, addWatermark = false } = body as { presentation: Presentation; addWatermark?: boolean };

    if (!presentation || !presentation.slides) {
      return NextResponse.json(
        { error: '无效的PPT数据' },
        { status: 400 }
      );
    }

    const blob = await exportToPPTX(presentation, addWatermark);
    const buffer = Buffer.from(await blob.arrayBuffer());
    const filename = (presentation.title || 'presentation').replace(/[^\u4e00-\u9fa5a-zA-Z0-9_-]/g, '_');

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
        'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(filename)}.pptx`,
        'Content-Length': buffer.length.toString(),
        'Cache-Control': 'no-cache',
      },
    });
  } catch (error: any) {
    console.error('Export error:', error);
    return NextResponse.json(
      { error: error.message || '导出失败' },
      { status: 500 }
    );
  }
}
