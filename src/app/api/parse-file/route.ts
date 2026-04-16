import { NextRequest, NextResponse } from 'next/server';
import { getClientIP, rateLimit } from '@/lib/rate-limit';

export const runtime = 'nodejs';

// POST: 解析上传的文件内容（PDF/Excel/Word等）
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

    // PDF parsing
    if (fileName.endsWith('.pdf')) {
      try {
        // @ts-ignore - pdf-parse types
        const pdfParse = require('pdf-parse');
        const pdfData = await pdfParse(buffer);
        text = pdfData.text || '';
        if (!text.trim()) {
          text = `[PDF: ${file.name}, ${pdfData.numpages || 0} pages, scanned image]`;
        }
      } catch (e: any) {
        console.error('[Parse] PDF failed:', e.message);
        text = `[PDF: ${file.name}, parse failed]`;
      }
    }
    // Excel 解析
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
    // Word/PPT - basic info only (no jszip dep)
    else if (fileName.endsWith('.docx') || fileName.endsWith('.doc')) {
      text = `[Word: ${file.name}, ${Math.round(buffer.length / 1024)}KB, upload to extract content]`;
    }
    else if (fileName.endsWith('.pptx') || fileName.endsWith('.ppt')) {
      try {
        // PPTX 是 ZIP 文件，解析 XML 提取文本
        const JSZip = await import('jszip');
        const zip = await JSZip.loadAsync(buffer);
        const slides: string[] = [];
        
        // 遍历所有 slide XML
        const slideFiles = Object.keys(zip.files).filter(f => f.startsWith('ppt/slides/slide') && f.endsWith('.xml'));
        slideFiles.sort((a, b) => {
          const numA = parseInt(a.match(/slide(\d+)/)?.[1] || '0');
          const numB = parseInt(b.match(/slide(\d+)/)?.[1] || '0');
          return numA - numB;
        });
        
        for (const slideFile of slideFiles) {
          const content = await zip.file(slideFile)?.async('text');
          if (content) {
            // 提取 <a:t> 标签中的文本
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
        text = `[PPT: ${file.name}, 解析失败]`;
      }
    }
    else {
      text = `[File: ${file.name}]`;
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