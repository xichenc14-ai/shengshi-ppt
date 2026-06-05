import { NextRequest, NextResponse } from 'next/server';
import { GET as exportPptxGET } from '@/app/api/export-pptx/route';
import { convertPptxToPdf } from '@/lib/pdf-converter';
import { renderSlidesPdfBuffer } from '@/lib/slides-pdf';

export const runtime = 'nodejs';
export const maxDuration = 300;

type SlideInput = {
  id?: string;
  title?: string;
  content?: string[];
  notes?: string;
};

function resolvePdfFilename(raw: string | null): string {
  const base = (raw || '省心PPT').trim() || '省心PPT';
  const safe = base.replace(/[^\w\u4e00-\u9fff.\-]/g, '_');
  return safe.toLowerCase().endsWith('.pdf') ? safe : `${safe}.pdf`;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const title = String(body?.title || '省心PPT').trim() || '省心PPT';
    const themeId = typeof body?.themeId === 'string' ? body.themeId : 'consultant';
    const filename = resolvePdfFilename(typeof body?.name === 'string' ? body.name : `${title}.pdf`);
    const slides = Array.isArray(body?.slides)
      ? (body.slides as SlideInput[]).map((slide, index) => ({
        id: typeof slide?.id === 'string' ? slide.id : `${index + 1}`,
        title: String(slide?.title || `第 ${index + 1} 页`).trim(),
        content: Array.isArray(slide?.content) ? slide.content.map((item) => String(item || '').trim()).filter(Boolean) : [],
        notes: typeof slide?.notes === 'string' ? slide.notes : '',
      }))
      : [];

    if (!slides.length) {
      return NextResponse.json({ error: '缺少 slides 数据' }, { status: 400 });
    }

    const pdfBuffer = await renderSlidesPdfBuffer({ title, slides, themeId });
    return new NextResponse(new Uint8Array(pdfBuffer), {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`,
        'Content-Length': String(pdfBuffer.length),
        'Cache-Control': 'no-cache',
      },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'PDF 生成失败';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const generationId = searchParams.get('generationId');
  const filename = resolvePdfFilename(searchParams.get('name'));

  if (!generationId) {
    return NextResponse.json({ error: '缺少 generationId 参数' }, { status: 400 });
  }

  const pptxFilename = filename.replace(/\.pdf$/i, '.pptx');
  const pptxRequest = new Request(`http://internal/api/export-pptx?generationId=${encodeURIComponent(generationId)}&name=${encodeURIComponent(pptxFilename)}`);
  const pptxResponse = await exportPptxGET(pptxRequest as unknown as NextRequest);

  if (!pptxResponse.ok) {
    const contentType = (pptxResponse.headers.get('Content-Type') || '').toLowerCase();
    if (contentType.includes('application/json')) {
      const payload = await pptxResponse.json().catch(() => ({ error: 'PPTX 导出失败' }));
      return NextResponse.json(payload, { status: pptxResponse.status });
    }
    return NextResponse.json({ error: 'PPTX 导出失败' }, { status: pptxResponse.status });
  }

  try {
    const pptxBuffer = Buffer.from(await pptxResponse.arrayBuffer());
    const pdfBuffer = await convertPptxToPdf(pptxBuffer, filename);

    return new NextResponse(new Uint8Array(pdfBuffer), {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`,
        'Content-Length': String(pdfBuffer.length),
        'Cache-Control': 'no-cache',
      },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'PDF 转换失败';
    return NextResponse.json({ error: message }, { status: 501 });
  }
}
