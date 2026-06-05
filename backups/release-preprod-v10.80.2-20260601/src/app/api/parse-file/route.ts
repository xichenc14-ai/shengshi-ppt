import { NextRequest, NextResponse } from 'next/server';
import { getClientIP, rateLimit } from '@/lib/rate-limit';
import { LIMITS } from '@/lib/input-validation';

export const runtime = 'nodejs';

function normalizeExtractedText(raw: string): string {
  return (raw || '')
    .replace(/\r/g, '\n')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function decodeXmlEntities(text: string): string {
  return text
    .replace(/&#x0*A;/gi, '\n')
    .replace(/&#10;/g, '\n')
    .replace(/&#x0*9;/gi, '\t')
    .replace(/&#9;/g, '\t')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'");
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
    const skipTables = String(formData.get('skipTables') || '').toLowerCase() === 'true';

    if (!file) return NextResponse.json({ error: '未提供文件' }, { status: 400 });
    if (file.size > LIMITS.MAX_FILE_SIZE) {
      return NextResponse.json({ error: `文件超过${Math.floor(LIMITS.MAX_FILE_SIZE / 1024 / 1024)}MB限制` }, { status: 400 });
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
      if (skipTables) {
        text = `[表格文件已上传: ${file.name}，默认未展开表格明细。若需解析表格，请在需求中明确说明“处理表格数据”。]`;
      } else {
        text = buffer.toString('utf-8').trim() || `[CSV: ${file.name}，内容为空]`;
      }
    } else if (fileName.endsWith('.xlsx') || fileName.endsWith('.xls')) {
      if (skipTables) {
        text = `[表格文件已上传: ${file.name}，默认未展开表格明细。若需解析表格，请在需求中明确说明“处理表格数据”。]`;
      } else {
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
        const JSZipModule = await import('jszip');
        const JSZip = (JSZipModule.default ?? JSZipModule) as { loadAsync: (input: Buffer) => Promise<any> };
        const zip = await JSZip.loadAsync(buffer);
        const slides: string[] = [];
        const files = Object.keys(zip.files)
          .filter(f => f.startsWith('ppt/slides/slide') && f.endsWith('.xml'))
          .sort((a, b) => (parseInt(a.match(/slide(\d+)/)?.[1] || '0')) - (parseInt(b.match(/slide(\d+)/)?.[1] || '0')));
        for (const f of files) {
          const c = await zip.file(f)?.async('text');
          if (c) {
            const matches = Array.from(c.matchAll(/<a:t[^>]*>([\s\S]*?)<\/a:t>/g));
            const ts = matches
              .map((m) => decodeXmlEntities(m[1] || '').trim())
              .filter(Boolean);
            if (ts.length > 0) slides.push(ts.join(' '));
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

    if (text.length > LIMITS.MAX_EXTRACTED_CHARS_PER_FILE) {
      text = text.substring(0, LIMITS.MAX_EXTRACTED_CHARS_PER_FILE) + '\n\n[...内容已截断...]';
    }

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
