import { NextRequest, NextResponse } from 'next/server';
import { selectBestKey } from '@/lib/gamma-key-pool';
import { PDFDocument, rgb, StandardFonts, degrees } from 'pdf-lib';

const GAMMA_API_BASE = 'https://public-api.gamma.app/v1.0';

/**
 * 免费用户 PDF 下载（水印版）
 * 流程：前端检测到免费用户 → 调用此API → 服务器加水印 → 返回带"省心PPT"水印的PDF
 */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const generationId = searchParams.get('generationId');
  const filename = searchParams.get('name') || '省心PPT.pdf';

  if (!generationId) {
    return NextResponse.json({ error: '缺少generationId' }, { status: 400 });
  }

  try {
    const selectedKey = selectBestKey();
    const apiKey = selectedKey.key;

    // 1. 获取 Gamma 状态和 exportUrl
    const statusRes = await fetch(`${GAMMA_API_BASE}/generations/${generationId}`, {
      headers: { 'X-API-KEY': apiKey },
    });

    if (!statusRes.ok) {
      return NextResponse.json({ error: '获取PPT失败' }, { status: 502 });
    }

    const statusData = await statusRes.json();
    const exportUrl = statusData.exportUrl;

    if (!exportUrl) {
      return NextResponse.json({ error: 'PDF暂不可用' }, { status: 404 });
    }

    // 2. 下载原始 PDF
    const pdfRes = await fetch(exportUrl);
    if (!pdfRes.ok || !pdfRes.body) {
      return NextResponse.json({ error: '下载PDF失败' }, { status: 502 });
    }

    const pdfBytes = await pdfRes.arrayBuffer();

    // 3. 用 pdf-lib 添加水印
    const pdfDoc = await PDFDocument.load(pdfBytes);
    const font = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
    const pages = pdfDoc.getPages();
    const watermarkText = '省心PPT';

    for (const page of pages) {
      const { width, height } = page.getSize();
      // 水印参数：斜向大字，半透明灰色
      const fontSize = Math.min(width, height) * 0.04;
      const textWidth = font.widthOfTextAtSize(watermarkText, fontSize);

      // 在页面中心放置斜向水印
      page.drawText(watermarkText, {
        x: (width - textWidth) / 2,
        y: height / 2 - fontSize / 2,
        size: fontSize,
        font: font,
        color: rgb(0.82, 0.82, 0.82),
        opacity: 0.15,
        rotate: degrees(-45), // 斜向旋转45度
      });

      // 在页面底部添加小字水印
      page.drawText(watermarkText, {
        x: 10,
        y: 10,
        size: 10,
        font: font,
        color: rgb(0.6, 0.6, 0.6),
        opacity: 0.3,
      });
    }

    // 4. 保存并返回（Uint8Array → Buffer → NextResponse）
    const watermarkedBytes = await pdfDoc.save();
    const buffer = Buffer.from(watermarkedBytes);

    return new NextResponse(buffer, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${encodeURIComponent(filename)}"`,
        'Content-Length': buffer.length.toString(),
        'Cache-Control': 'no-store',
      },
    });

  } catch (e: any) {
    console.error('[ExportWatermarked] Error:', e.message);
    return NextResponse.json({ error: '处理失败: ' + e.message }, { status: 500 });
  }
}
