import { NextRequest, NextResponse } from 'next/server';
import { getClientIP, rateLimit } from '@/lib/rate-limit';

export const runtime = 'nodejs';

/**
 * 纯JS PDF文本提取（不依赖pdfjs-dist worker）
 * 使用pdf-parse v1.x自带的老版pdfjs（disableWorker=true）
 * 在Vercel serverless中通过dynamic import隔离
 */
async function parsePdf(buffer: Buffer): Promise<string> {
  try {
    // 动态import pdf-parse，避免build时打包pdfjs-dist
    const pdfParse = (await import('pdf-parse')).default;
    const result = await pdfParse(buffer);
    return (result.text || '').trim();
  } catch (e: any) {
    console.error('[Parse] pdf-parse失败:', e.message);
    // fallback: 尝试直接用pdfjs-dist legacy（如果存在）
    try {
      const { getDocument } = await import('pdfjs-dist/legacy/build/pdf.mjs');
      // 全局polyfill
      if (typeof globalThis !== 'undefined' && !(globalThis as any).DOMMatrix) {
        (globalThis as any).DOMMatrix = class {
          a = 1; b = 0; c = 0; d = 1; e = 0; f = 0;
          constructor() {}
          scale() { return this; }
          translate() { return this; }
          rotate() { return this; }
          multiply() { return this; }
          inverse() { return this; }
          transformPoint() { return { x: 0, y: 0 }; }
          setMatrixValue() { return this; }
        };
      }
      const doc = await getDocument({ data: new Uint8Array(buffer), useSystemFonts: true }).promise;
      let text = '';
      for (let i = 1; i <= doc.numPages; i++) {
        const page = await doc.getPage(i);
        const content = await page.getTextContent();
        const pageText = content.items.map((item: any) => item.str).join(' ');
        text += pageText + '\n\n';
      }
      return text.trim();
    } catch (e2: any) {
      console.error('[Parse] pdfjs-dist legacy也失败:', e2.message);
      throw new Error('PDF解析失败: ' + e2.message);
    }
  }
}

// ===== 主处理函数 =====

export async function POST(request: NextRequest) {
  const ip = getClientIP(request);
  const { allowed } = rateLimit(`parse:${ip}`, { windowMs: 60000, maxRequests: 20 });
  if (!allowed) return NextResponse.json({ error: '请求过于频繁' }, { status: 429 });

  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;

    if (!file) return NextResponse.json({ error: '未提供文件' }, { status: 400 });

    // 文件大小限制：50MB
    if (file.size > 50 * 1024 * 1024) {
      return NextResponse.json({ error: '文件超过50MB限制' }, { status: 400 });
    }

    const fileName = file.name.toLowerCase();
    const buffer = Buffer.from(await file.arrayBuffer());
    let text = '';

    // ===== PDF parsing =====
    if (fileName.endsWith('.pdf')) {
      try {
        text = await parsePdf(buffer);
        if (!text) {
          text = `[PDF: ${file.name}, ${buffer.length} bytes, 扫描件/无文字内容，建议手动复制文字粘贴]`;
        }
      } catch (e1: any) {
        console.error('[Parse] PDF解析失败:', e1.message);
        text = `[PDF: ${file.name}, 解析失败，请复制文字后直接粘贴]`;
      }
    }
    // ===== CSV 纯文本 =====
    else if (fileName.endsWith('.csv')) {
      try {
        const csvText = buffer.toString('utf-8');
        text = csvText.trim() ? csvText : `[CSV: ${file.name}，内容为空]`;
      } catch (e: any) {
        console.error('[Parse] CSV 解析失败:', e.message);
        text = `[CSV: ${file.name}，解析失败]`;
      }
    }
    // ===== Excel 解析 =====
    else if (fileName.endsWith('.xlsx') || fileName.endsWith('.xls')) {
      try {
        const XLSX = await import('xlsx');
        const workbook = XLSX.read(buffer, { type: 'buffer' });
        const sheets: string[] = [];
        for (const sheetName of workbook.SheetNames) {
          const sheet = workbook.Sheets[sheetName];
          const csv = XLSX.utils.sheet_to_csv(sheet);
          if (csv.trim()) sheets.push(`【${sheetName}】\n${csv}`);
        }
        text = sheets.join('\n\n') || `[Excel文件: ${file.name}，无数据]`;
      } catch (e: any) {
        console.error('[Parse] Excel解析失败:', e.message);
        text = `[Excel文件: ${file.name}，解析失败]`;
      }
    }
    // ===== Word 解析 =====
    else if (fileName.endsWith('.docx') || fileName.endsWith('.doc')) {
      try {
        const mammoth = await import('mammoth');
        const result = await mammoth.extractRawText({ buffer });
        text = result.value.trim().length > 10
          ? result.value.trim()
          : `[Word: ${file.name}, 解析内容为空，可能是全图片文档]`;
      } catch (e: any) {
        return NextResponse.json(
          { error: `Word解析失败: ${e.message}` },
          { status: 422 }
        );
      }
    }
    // ===== PPTX 解析 =====
    else if (fileName.endsWith('.pptx') || fileName.endsWith('.ppt')) {
      try {
        const JSZip = await import('jszip');
        const zip = await JSZip.loadAsync(buffer);
        const slides: string[] = [];
        const slideFiles = Object.keys(zip.files)
          .filter(f => f.startsWith('ppt/slides/slide') && f.endsWith('.xml'))
          .sort((a, b) => {
            const numA = parseInt(a.match(/slide(\d+)/)?.[1] || '0');
            const numB = parseInt(b.match(/slide(\d+)/)?.[1] || '0');
            return numA - numB;
          });
        for (const slideFile of slideFiles) {
          const content = await zip.file(slideFile)?.async('text');
          if (content) {
            const texts = content.match(/<a:t>([^<]*)<\/a:t>/g) || [];
            const slideText = texts.map(t => t.replace(/<\/?a:t>/g, '')).join(' ');
            if (slideText.trim()) slides.push(slideText);
          }
        }
        text = slides.join('\n\n---\n\n') || `[PPT: ${file.name}, 无文本内容]`;
      } catch (e: any) {
        text = `[PPT: ${file.name}，解析失败]`;
      }
    }
    // ===== 纯文本 =====
    else if (fileName.endsWith('.txt') || fileName.endsWith('.md')) {
      text = buffer.toString('utf-8').trim() || `[文件: ${file.name}，内容为空]`;
    }
    else {
      text = `[文件: ${file.name}]`;
    }

    const MAX_CHARS = 80000;
    if (text.length > MAX_CHARS) {
      text = text.substring(0, MAX_CHARS) + '\n\n[...内容已截断...]';
    }

    return NextResponse.json({
      text,
      fileName: file.name,
      fileSize: file.size,
      charCount: text.length,
    });
  } catch (e: any) {
    console.error('[Parse] Error:', e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
