import { NextRequest, NextResponse } from 'next/server';
import { getClientIP, rateLimit } from '@/lib/rate-limit';

export const runtime = 'nodejs';

// ===== PDF 解析：使用 pdf-parse（纯 Node.js，serverless 友好） =====

async function parsePdfWithPdfJs(buffer: Buffer, fileName: string): Promise<string> {
  const { PDFParse } = await import('pdf-parse');
  const parser = new PDFParse({ data: new Uint8Array(buffer) } as any);
  try {
    const textResult = await parser.getText();
    const text = (textResult.text || '').trim();
    if (!text) {
      return `[PDF: ${fileName}, ${buffer.length} bytes, 扫描件/无文字内容，建议手动复制文字粘贴]`;
    }
    return text;
  } finally {
    await parser.destroy();
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

    // ===== PDF parsing（双引擎：pdfjs-dist 优先，pdf-parse fallback） =====
    if (fileName.endsWith('.pdf')) {
      try {
        text = await parsePdfWithPdfJs(buffer, file.name);
      } catch (e1: any) {
        console.error('[Parse] pdf-parse failed:', e1.message);
        return NextResponse.json({
          text: '',
          error: `PDF解析失败（${e1.message})，请将文字直接粘贴到输入框`,
          failed: true,
          fileName: file.name,
        });
      }
    }
    // ===== CSV 纯文本（单独处理，避免 xlsx 库编码问题） =====
    else if (fileName.endsWith('.csv')) {
      try {
        // 直接作为 UTF-8 文本读取，不走 xlsx 库
        const csvText = buffer.toString('utf-8');
        if (csvText.trim()) {
          text = csvText;
        } else {
          text = `[CSV: ${file.name}，内容为空]`;
        }
      } catch (e: any) {
        console.error('[Parse] CSV 解析失败:', e.message);
        return NextResponse.json({
          text: '',
          error: `CSV解析失败（${e.message})，请将内容直接粘贴`,
          failed: true,
          fileName: file.name,
        });
      }
    }
    // ===== Excel 解析（xlsx/xls） =====
    else if (fileName.endsWith('.xlsx') || fileName.endsWith('.xls')) {
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
        return NextResponse.json({
          text: '',
          error: `Excel解析失败（${e.message})，请将内容直接粘贴`,
          failed: true,
          fileName: file.name,
        });
      }
    }
    // ===== Word 解析（mammoth 工业级方案） =====
    else if (fileName.endsWith('.docx') || fileName.endsWith('.doc')) {
      try {
        const mammoth = await import('mammoth');
        // mammoth.extractRawText 高保真提取纯文本，忽略复杂样式和 XML 嵌套
        const result = await mammoth.extractRawText({ buffer });
        const plainText = result.value.trim();

        if (plainText.length > 10) {
          text = plainText;
        } else {
          text = `[Word: ${file.name}, 解析内容为空，可能是全图片文档，请手动复制文字]`;
        }
      } catch (e: any) {
        // 返回 200 + 友好提示文本，避免客户端无法处理 422 状态码
        console.error(`[Parse] Word 解析失败 (${file.name}):`, e.message);
        text = `[Word: ${file.name}, 解析失败，请尝试保存为 PDF 或直接复制文字粘贴]`;
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
        return NextResponse.json({
          text: '',
          error: `PPT解析失败（${e.message})，请将内容直接粘贴`,
          failed: true,
          fileName: file.name,
        });
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

    // 截断：对齐 outline API 的 10000 字符限制，留 2000 余量
    const MAX_CHARS = 8000;
    if (text.length > MAX_CHARS) {
      text = text.substring(0, MAX_CHARS) + '\n\n[...内容已截断，原始文档过长，请精简或分段处理]';
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
