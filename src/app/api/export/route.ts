import { NextRequest, NextResponse } from 'next/server';
import { exportToPPTX } from '@/lib/pptx-export';
import { Presentation } from '@/lib/types';

export async function POST(request: NextRequest) {
  try {
    const { presentation } = await request.json() as { presentation: Presentation };

    if (!presentation || !presentation.slides) {
      return NextResponse.json(
        { error: '无效的PPT数据' },
        { status: 400 }
      );
    }

    const blob = await exportToPPTX(presentation);

    return new NextResponse(blob, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
        'Content-Disposition': `attachment; filename="${encodeURIComponent(presentation.title || 'presentation')}.pptx"`,
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
