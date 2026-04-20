import { NextRequest, NextResponse } from 'next/server';
import { selectBestKey } from '@/lib/gamma-key-pool';
import { PDFDocument, rgb, StandardFonts, degrees } from 'pdf-lib';

const GAMMA_API_BASE = 'https://public-api.gamma.app/v1.0';

/**
 * 免费用户 PDF 下载（水印版）
 * 水印使用英文 "ShengxinPPT"（Helvetica Bold），不支持CJK的标准PDF字体
 * 如需中文水印，需嵌入中文字体（当前方案不支持无fontkit的TTF嵌入）
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

    const pdfArrayBuffer = await pdfRes.arrayBuffer();
    const pdfBytes = new Uint8Array(pdfArrayBuffer);

    // 3. 用 pdf-lib 添加水印（英文，Helvetica Bold）
    const pdfDoc = await PDFDocument.load(pdfBytes);
    const font = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
    const pages = pdfDoc.getPages();

    // 使用英文水印（标准PDF字体不支持CJK）
    const watermarkText = 'ShengxinPPT';

    for (const page of pages) {
      const { width, height } = page.getSize();
      const fontSize = Math.min(width, height) * 0.04;
      const textWidth = font.widthOfTextAtSize(watermarkText, fontSize);

      // 页面中心斜向水印（大字半透明）
      page.drawText(watermarkText, {
        x: (width - textWidth) / 2,
        y: height / 2 - fontSize / 2,
        size: fontSize,
        font: font,
        color: rgb(0.75, 0.75, 0.75),
        opacity: 0.12,
        rotate: degrees(-45),
      });

      // 页面底部小字水印
      page.drawText(watermarkText, {
        x: 8, y: 8, size: 9, font: font,
        color: rgb(0.6, 0.6, 0.6),
        opacity: 0.25,
      });
    }

    // 4. 保存并返回
    const watermarkedUint8 = await pdfDoc.save();
    const buffer = Buffer.from(watermarkedUint8);

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