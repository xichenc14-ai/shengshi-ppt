import { NextRequest, NextResponse } from 'next/server';
import { getClientIP, rateLimit } from '@/lib/rate-limit';

export const runtime = 'nodejs';

// ===== PDF 解析：优先使用 pdfjs-dist（Vercel serverless 兼容），fallback 到 pdf-parse =====

async function parsePdfWithPdfJs(buffer: Buffer): Promise<string> {
  // pdfjs-dist legacy (pure JS, Node.js 兼容)
  const { getDocument } = await import('pdfjs-dist/legacy/build/pdf.mjs');
  // 标准字体数据 URL（用于纯 JS 模式）
  const doc = await getDocument({
    data: new Uint8Array(buffer),
    standardFontDataUrl: '/standard_fonts/',
  }).promise;
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

          // pdfjs-dist 失败时直接返回解析失败提示，不做额外 fallback
        console.error('[Parse] pdfjs-dist failed:', errorMsg);
        text = `[PDF: ${file.name}, 解析失败，请复制文字后直接粘贴]`;
        parsed = true;
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
      // 🚨 V9.3: 用 JSZip 提取 docx 真实文本内容
      try {
        const JSZip = await import('jszip');
        const zip = await JSZip.loadAsync(buffer);
        const docXml = await zip.file('word/document.xml')?.async('text');
        if (docXml) {
          // 提取所有 <w:t> 标签内的文本
          const texts = docXml.match(/<w:t[^>]*>([^<]*)<\/w:t>/g) || [];
          const plainText = texts.map(t => t.replace(/<[^>]+>/g, '')).filter(Boolean).join('\n').trim();
          if (plainText.length > 10) {
            text = plainText;
          } else {
            text = `[Word: ${file.name}, 解析内容为空，请复制文字后直接粘贴]`;
          }
        } else {
          text = `[Word: ${file.name}, 解析失败，请复制文字后直接粘贴]`;
        }
      } catch {
        text = `[Word: ${file.name}, 解析失败，请复制文字后直接粘贴]`;
      }
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
    // ===== 纯文本文件解析（txt/md） =====
    else if (fileName.endsWith('.txt') || fileName.endsWith('.md') || fileName.endsWith('.markdown')) {
      try {
        text = buffer.toString('utf-8');
        if (!text.trim()) {
          text = `[文件: ${file.name}，内容为空]`;
        }
      } catch (e: any) {
        console.error('[Parse] 文本解析失败:', e.message);
        text = `[文件: ${file.name}，解析失败]`;
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
