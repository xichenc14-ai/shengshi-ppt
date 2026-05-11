import { NextRequest, NextResponse } from 'next/server';
import { getClientIP, rateLimit } from '@/lib/rate-limit';

export const runtime = 'nodejs';

function normalizeExtractedText(raw: string): string {
  return (raw || '')
    .replace(/\r/g, '\n')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

async function parsePdfWithPdfParse(buffer: Buffer): Promise<string> {
  try {
    const pdfParseModule = await import('pdf-parse');
    const pdfParseFn = (pdfParseModule.default ?? pdfParseModule) as (dataBuffer: Buffer) => Promise<{ text?: string }>;
    const parsed = await pdfParseFn(buffer);
    return normalizeExtractedText(parsed?.text || '');
  } catch (e: any) {
    console.error('[Parse] pdf-parse失败:', e.message);
    throw e;
  }
}

async function parsePdfWithPdfJs(buffer: Buffer): Promise<string> {
  const pdfjsLib = await import('pdfjs-dist/legacy/build/pdf.mjs');
  const { getDocument } = pdfjsLib;
  const loadingTask = getDocument({
    data: new Uint8Array(buffer),
    disableWorker: true,
    useSystemFonts: true,
    disableFontFace: true,
    useWorkerFetch: false,
    isEvalSupported: false,
  } as any);

  const doc = await loadingTask.promise;
  let text = '';

  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i);
    const content = await page.getTextContent();
    let lastY = -1;
    for (const item of content.items) {
      const str = (item as any).str || '';
      if (!str) continue;
      const y = (item as any).transform?.[5] ?? -1;
      if (lastY >= 0 && Math.abs(y - lastY) > 2) text += '\n';
      text += str;
      lastY = y;
    }
    if (i < doc.numPages) text += '\n\n';
  }

  await doc.destroy();
  return normalizeExtractedText(text);
}

async function parsePdf(buffer: Buffer): Promise<string> {
  const byPdfParse = await parsePdfWithPdfParse(buffer).catch(() => '');
  if (byPdfParse) return byPdfParse;

  const byPdfJs = await parsePdfWithPdfJs(buffer).catch((e: any) => {
    console.error('[Parse] pdfjs fallback失败:', e?.message || String(e));
    return '';
  });
  if (byPdfJs) return byPdfJs;

  return '';
}

export async function POST(request: NextRequest) {
  const ip = getClientIP(request);
  const { allowed } = rateLimit(`parse:${ip}`, { windowMs: 60000, maxRequests: 20 });
  if (!allowed) return NextResponse.json({ error: '请求过于频繁' }, { status: 429 });

  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;

    if (!file) return NextResponse.json({ error: '未提供文件' }, { status: 400 });
    if (file.size > 50 * 1024 * 1024) {
      return NextResponse.json({ error: '文件超过50MB限制' }, { status: 400 });
    }

    const fileName = file.name.toLowerCase();
    const buffer = Buffer.from(await file.arrayBuffer());
    let text = '';
    let failed = false;
    let error = '';

    if (fileName.endsWith('.pdf')) {
      text = await parsePdf(buffer);
      if (!text) {
        failed = true;
        error = 'PDF 未提取到可用文字（可能是扫描件）';
      }
    } else if (fileName.endsWith('.csv')) {
      text = buffer.toString('utf-8').trim() || `[CSV: ${file.name}，内容为空]`;
    } else if (fileName.endsWith('.xlsx') || fileName.endsWith('.xls')) {
      try {
        const XLSX = await import('xlsx');
        const workbook = XLSX.read(buffer, { type: 'buffer' });
        const sheets: string[] = [];
        for (const name of workbook.SheetNames) {
          const csv = XLSX.utils.sheet_to_csv(workbook.Sheets[name]);
          if (csv.trim()) sheets.push(`【${name}】\n${csv}`);
        }
        text = sheets.join('\n\n') || `[Excel: ${file.name}，无数据]`;
      } catch (e: any) {
        failed = true;
        error = `Excel解析失败: ${e.message || '未知错误'}`;
      }
    } else if (fileName.endsWith('.docx') || fileName.endsWith('.doc')) {
      try {
        const mammoth = await import('mammoth');
        const result = await mammoth.extractRawText({ buffer });
        text = result.value.trim() || `[Word: ${file.name}，内容为空]`;
      } catch (e: any) {
        failed = true;
        error = `Word解析失败: ${e.message || '未知错误'}`;
      }
    } else if (fileName.endsWith('.pptx') || fileName.endsWith('.ppt')) {
      try {
        const JSZip = await import('jszip');
        const zip = await JSZip.loadAsync(buffer);
        const slides: string[] = [];
        const files = Object.keys(zip.files)
          .filter(f => f.startsWith('ppt/slides/slide') && f.endsWith('.xml'))
          .sort((a, b) => (parseInt(a.match(/slide(\d+)/)?.[1] || '0')) - (parseInt(b.match(/slide(\d+)/)?.[1] || '0')));
        for (const f of files) {
          const c = await zip.file(f)?.async('text');
          if (c) {
            const ts = (c.match(/<a:t>([^<]*)<\/a:t>/g) || []).map(t => t.replace(/<\/?a:t>/g, ''));
            if (ts.join('').trim()) slides.push(ts.join(' '));
          }
        }
        text = slides.join('\n\n---\n\n') || `[PPT: ${file.name}，无文本内容]`;
      } catch (e: any) {
        failed = true;
        error = `PPT解析失败: ${e.message || '未知错误'}`;
      }
    } else if (fileName.endsWith('.txt') || fileName.endsWith('.md')) {
      text = buffer.toString('utf-8').trim() || `[文件: ${file.name}，内容为空]`;
    } else {
      text = `[文件: ${file.name}]`;
    }

    if (failed) {
      return NextResponse.json({
        text: '',
        fileName: file.name,
        fileSize: file.size,
        charCount: 0,
        failed: true,
        error,
      });
    }

    if (text.length > 80000) text = text.substring(0, 80000) + '\n\n[...内容已截断...]';

    return NextResponse.json({
      text,
      fileName: file.name,
      fileSize: file.size,
      charCount: text.length,
      failed: false,
    });
  } catch (e: any) {
    return NextResponse.json({
      text: '',
      failed: true,
      error: e?.message || '文件解析失败',
    });
  }
}
