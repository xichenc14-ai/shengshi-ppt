import { NextRequest, NextResponse } from 'next/server';
import { getClientIP, rateLimit } from '@/lib/rate-limit';

export const runtime = 'nodejs';

// ===== PDF 解析：优先使用 pdfjs-dist（Vercel serverless 兼容），fallback 到 pdf-parse =====

async function parsePdfWithPdfJs(buffer: Buffer): Promise<string> {
  // pdfjs-dist legacy (pure JS, Node.js 兼容)
  const { getDocument } = await import('pdfjs-dist/legacy/build/pdf.mjs');
  const doc = await getDocument({ data: new Uint8Array(buffer) }).promise;
  const parts: string[] = [];
  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i);
    const content = await page.getTextContent();
    const pageText = content.items
      .map((item: any) => item.str)
      .join(' ')
      .trim();
    if (pageText) parts.push(pageText);
  }
  return parts.join('\n\n');
}

async function parsePdfWithPdfParse(buffer: Buffer): Promise<string> {
  // @ts-ignore - pdf-parse
  const pdfParse = require('pdf-parse');
  const pdfData = await pdfParse(buffer);
  return pdfData.text || '';
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

    // ===== PDF parsing（双引擎：pdfjs-dist 优先，pdf-parse fallback） =====
    if (fileName.endsWith('.pdf')) {
      let parsed = false;
      let errorMsg = '';

      // 引擎1：pdfjs-dist（推荐，纯 JS，serverless 友好）
      try {
        text = await parsePdfWithPdfJs(buffer);
        if (text.trim()) {
          parsed = true;
        } else {
          // 空内容，可能是扫描件
          text = `[PDF: ${file.name}, ${buffer.length} bytes, 扫描件/无文字内容，建议手动复制文字粘贴]`;
          parsed = true;
        }
      } catch (e1: any) {
        errorMsg = `pdfjs-dist: ${e1.message}`;
        console.warn('[Parse] pdfjs-dist failed, trying pdf-parse:', errorMsg);

        // 引擎2：pdf-parse（Node.js 原生）
        try {
          text = await parsePdfWithPdfParse(buffer);
          if (text.trim()) {
            parsed = true;
          } else {
            text = `[PDF: ${file.name}, ${buffer.length} bytes, 扫描件/无文字内容]`;
            parsed = true;
          }
        } catch (e2: any) {
          errorMsg += ` | pdf-parse: ${e2.message}`;
          console.error('[Parse] All PDF engines failed:', errorMsg);
          text = `[PDF: ${file.name}, 解析失败，请复制文字后直接粘贴]`;
          parsed = true; // 仍然返回文本（fallback），不让流程中断
        }
      }
    }
    // ===== Excel 解析（xlsx/xls/csv） =====
    else if (fileName.endsWith('.xlsx') || fileName.endsWith('.xls') || fileName.endsWith('.csv')) {
      try {
        const XLSX = await import('xlsx');
        const workbook = XLSX.read(buffer, { type: 'buffer' });
        const sheets: string[] = [];
        for (const sheetName of workbook.SheetNames) {
          const sheet = workbook.Sheets[sheetName];
          const csv = XLSX.utils.sheet_to_csv(sheet);
          if (csv.trim()) {
            sheets.push(`【${sheetName}】\n${csv}`);
          }
        }
        text = sheets.join('\n\n') || `[Excel文件: ${file.name}，无数据]`;
      } catch (e: any) {
        console.error('[Parse] Excel解析失败:', e.message);
        text = `[Excel文件: ${file.name}，解析失败]`;
      }
    }
    // ===== Word/PPT 基本信息（暂不支持内容提取） =====
    else if (fileName.endsWith('.docx') || fileName.endsWith('.doc')) {
      text = `[Word: ${file.name}, ${Math.round(buffer.length / 1024)}KB, 请复制文字后直接粘贴]`;
    }
    else if (fileName.endsWith('.pptx') || fileName.endsWith('.ppt')) {
      try {
        const JSZip = await import('jszip');
        const zip = await JSZip.loadAsync(buffer);
        const slides: string[] = [];

        const slideFiles = Object.keys(zip.files).filter(f => f.startsWith('ppt/slides/slide') && f.endsWith('.xml'));
        slideFiles.sort((a, b) => {
          const numA = parseInt(a.match(/slide(\d+)/)?.[1] || '0');
          const numB = parseInt(b.match(/slide(\d+)/)?.[1] || '0');
          return numA - numB;
        });

        for (const slideFile of slideFiles) {
          const content = await zip.file(slideFile)?.async('text');
          if (content) {
            const texts = content.match(/<a:t>([^<]*)<\/a:t>/g) || [];
            const slideText = texts.map(t => t.replace(/<a:t>|<\/a:t>/g, '').trim()).filter(Boolean).join('\n');
            if (slideText) {
              slides.push(slideText);
            }
          }
        }

        text = slides.length > 0 ? slides.join('\n\n---\n\n') : `[PPT: ${file.name}, 无文本内容]`;
      } catch (e: any) {
        console.error('[Parse] PPT解析失败:', e.message);
        text = `[PPT: ${file.name}，解析失败]`;
      }
    }
    else {
      text = `[文件: ${file.name}]`;
    }

    // 截断超长文本（防止token过多）
    const MAX_CHARS = 10000;
    if (text.length > MAX_CHARS) {
      text = text.substring(0, MAX_CHARS) + '\n\n[...内容过长，已截断...]';
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
