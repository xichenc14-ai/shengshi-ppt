import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getClientIP, rateLimit } from '@/lib/rate-limit';
import { getSession } from '@/lib/session';
import {
  getAttachmentPolicy,
  getFileExtension,
  isPaidPlan,
  validateAttachmentMeta,
  type AttachmentMode,
} from '@/lib/attachment-policy';

export const runtime = 'nodejs';

type PdfParseResult = { text?: string };
type PdfTextItem = { str?: string; transform?: number[] };
type JsZipLike = { loadAsync: (input: Buffer) => Promise<{ files: Record<string, unknown>; file: (path: string) => { async: (format: 'text') => Promise<string> } | null }> };
const ATTACHMENT_BUCKET = 'temporary-attachments';

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key);
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

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

function validateFileSignature(fileName: string, buffer: Buffer): string | null {
  const extension = getFileExtension(fileName);
  if (extension === '.pdf' && buffer.subarray(0, 5).toString('ascii') !== '%PDF-') {
    return 'PDF 文件内容与扩展名不一致';
  }
  if (['.docx', '.xlsx', '.pptx'].includes(extension)) {
    const signature = buffer.subarray(0, 4).toString('hex');
    if (!['504b0304', '504b0506', '504b0708'].includes(signature)) {
      return 'Office 文件内容与扩展名不一致';
    }
  }
  return null;
}

async function parsePdfWithPdfParse(buffer: Buffer): Promise<string> {
  try {
    const pdfParseModule = await import('pdf-parse');
    const pdfParseFn = (pdfParseModule.default ?? pdfParseModule) as (dataBuffer: Buffer) => Promise<PdfParseResult>;
    const parsed = await pdfParseFn(buffer);
    return normalizeExtractedText(parsed?.text || '');
  } catch (e: unknown) {
    console.error('[Parse] pdf-parse失败:', getErrorMessage(e));
    throw e;
  }
}

async function parsePdfWithPdfJs(buffer: Buffer): Promise<string> {
  const pdfjsLib = await import('pdfjs-dist/legacy/build/pdf.mjs');
  const { getDocument } = pdfjsLib;
  const loadingTask = getDocument({
    data: new Uint8Array(buffer),
    useSystemFonts: true,
    disableFontFace: true,
    useWorkerFetch: false,
    isEvalSupported: false,
  });

  const doc = await loadingTask.promise;
  let text = '';

  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i);
    const content = await page.getTextContent();
    let lastY = -1;
    for (const item of content.items) {
      const str = (item as PdfTextItem).str || '';
      if (!str) continue;
      const y = (item as PdfTextItem).transform?.[5] ?? -1;
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

  const byPdfJs = await parsePdfWithPdfJs(buffer).catch((e: unknown) => {
    console.error('[Parse] pdfjs fallback失败:', getErrorMessage(e));
    return '';
  });
  if (byPdfJs) return byPdfJs;

  return '';
}

export async function POST(request: NextRequest) {
  const ip = getClientIP(request);
  const { allowed } = rateLimit(`parse:${ip}`, { windowMs: 60000, maxRequests: 20 });
  if (!allowed) return NextResponse.json({ error: '请求过于频繁' }, { status: 429 });

  const session = await getSession();
  if (!session.isLoggedIn || !session.user?.id) {
    return NextResponse.json({ error: '请先登录' }, { status: 401 });
  }

  try {
    const contentType = request.headers.get('content-type') || '';
    let fileName = '';
    let fileSize = 0;
    let buffer: Buffer;
    let skipTables = false;
    let mode: AttachmentMode = 'direct';
    let storagePath = '';

    if (contentType.includes('application/json')) {
      const body = await request.json();
      fileName = String(body?.fileName || '').slice(0, 180);
      fileSize = Number(body?.fileSize || 0);
      skipTables = Boolean(body?.skipTables);
      mode = body?.mode === 'smart' ? 'smart' : 'direct';
      storagePath = String(body?.storagePath || '');
      if (!storagePath.startsWith(`${session.user.id}/`)) {
        return NextResponse.json({ error: '附件路径无效' }, { status: 403 });
      }
      const sb = getSupabase();
      if (!sb) return NextResponse.json({ error: '附件存储服务未配置' }, { status: 503 });
      const { data, error } = await sb.storage.from(ATTACHMENT_BUCKET).download(storagePath);
      if (error || !data) return NextResponse.json({ error: '附件读取失败或已过期' }, { status: 400 });
      buffer = Buffer.from(await data.arrayBuffer());
      fileSize = buffer.length;
      await sb.storage.from(ATTACHMENT_BUCKET).remove([storagePath]);
      storagePath = '';
    } else {
      const formData = await request.formData();
      const file = formData.get('file') as File | null;
      if (!file) return NextResponse.json({ error: '未提供文件' }, { status: 400 });
      fileName = file.name;
      fileSize = file.size;
      skipTables = String(formData.get('skipTables') || '').toLowerCase() === 'true';
      mode = String(formData.get('mode') || '') === 'smart' ? 'smart' : 'direct';
      buffer = Buffer.from(await file.arrayBuffer());
    }

    const policy = getAttachmentPolicy(session.user.plan_type, mode);
    if (mode === 'smart' && !isPaidPlan(session.user.plan_type)) {
      return NextResponse.json({ error: '省心模式为会员专享功能' }, { status: 403 });
    }
    const metaError = validateAttachmentMeta({ name: fileName, size: fileSize }, policy);
    if (metaError) return NextResponse.json({ error: metaError }, { status: 400 });
    const signatureError = validateFileSignature(fileName, buffer);
    if (signatureError) return NextResponse.json({ error: signatureError }, { status: 400 });

    const lowerFileName = fileName.toLowerCase();
    let text = '';
    let failed = false;
    let error = '';

    if (lowerFileName.endsWith('.pdf')) {
      text = await parsePdf(buffer);
      if (!text) {
        failed = true;
        error = 'PDF 未提取到可用文字（可能是扫描件）';
      }
    } else if (lowerFileName.endsWith('.csv')) {
      if (skipTables) {
        text = `[表格文件已上传: ${fileName}，默认未展开表格明细。若需解析表格，请在需求中明确说明“处理表格数据”。]`;
      } else {
        text = buffer.toString('utf-8').trim() || `[CSV: ${fileName}，内容为空]`;
      }
    } else if (lowerFileName.endsWith('.xlsx')) {
      if (skipTables) {
        text = `[表格文件已上传: ${fileName}，默认未展开表格明细。若需解析表格，请在需求中明确说明“处理表格数据”。]`;
      } else {
      try {
        const XLSX = await import('xlsx');
        const workbook = XLSX.read(buffer, { type: 'buffer' });
        const sheets: string[] = [];
        for (const name of workbook.SheetNames) {
          const csv = XLSX.utils.sheet_to_csv(workbook.Sheets[name]);
          if (csv.trim()) sheets.push(`【${name}】\n${csv}`);
        }
        text = sheets.join('\n\n') || `[Excel: ${fileName}，无数据]`;
      } catch (e: unknown) {
        failed = true;
        error = `Excel解析失败: ${getErrorMessage(e) || '未知错误'}`;
      }
      }
    } else if (lowerFileName.endsWith('.docx')) {
      try {
        const mammoth = await import('mammoth');
        const result = await mammoth.extractRawText({ buffer });
        text = result.value.trim() || `[Word: ${fileName}，内容为空]`;
      } catch (e: unknown) {
        failed = true;
        error = `Word解析失败: ${getErrorMessage(e) || '未知错误'}`;
      }
    } else if (lowerFileName.endsWith('.pptx')) {
      try {
        const JSZipModule = await import('jszip');
        const JSZip = (JSZipModule.default ?? JSZipModule) as JsZipLike;
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
        text = slides.join('\n\n---\n\n') || `[PPT: ${fileName}，无文本内容]`;
      } catch (e: unknown) {
        failed = true;
        error = `PPT解析失败: ${getErrorMessage(e) || '未知错误'}`;
      }
    } else if (lowerFileName.endsWith('.txt') || lowerFileName.endsWith('.md')) {
      text = buffer.toString('utf-8').trim() || `[文件: ${fileName}，内容为空]`;
    } else {
      return NextResponse.json({ error: '不支持的附件格式' }, { status: 400 });
    }

    if (failed) {
      return NextResponse.json({
        text: '',
        fileName,
        fileSize,
        charCount: 0,
        failed: true,
        error,
      });
    }

    if (text.length > policy.maxExtractedCharsPerFile) {
      text = text.substring(0, policy.maxExtractedCharsPerFile) + '\n\n[...已按当前套餐提取关键内容...]';
    }

    return NextResponse.json({
      text,
      fileName,
      fileSize,
      charCount: text.length,
      failed: false,
    });
  } catch (e: unknown) {
    return NextResponse.json({
      text: '',
      failed: true,
      error: getErrorMessage(e) || '文件解析失败',
    });
  }
}
