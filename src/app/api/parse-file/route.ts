import { NextRequest, NextResponse } from 'next/server';
import { getClientIP, rateLimit } from '@/lib/rate-limit';

export const runtime = 'nodejs';

// ===== PDF 解析：使用 pdf-parse v1.x（不依赖 web worker，Vercel serverless 兼容） =====

async function parsePdf(buffer: Buffer): Promise<string> {
  // pdf-parse v1.x 内部使用 pdfjs-dist 的纯 JS 模式，无需 worker
  const pdfParse = require('pdf-parse');
  const result = await pdfParse(buffer);
  return (result.text || '').trim();
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
        text = `[CSV: ${file.name}，解析失败]`;
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
        text = `[Excel文件: ${file.name}，解析失败]`;
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
        // 必须打印真实错误，否则永远不知道线上为什么挂了
        console.error(`[Parse] Word 解析发生致命错误 (${file.name}):`, e.message);

        // 不要静默返回 200，明确抛出异常让前端感知并提示用户重试或换格式
        return NextResponse.json(
          { error: `Word 文件解析失败，文档可能已损坏或格式不支持。请尝试保存为 PDF 或直接复制文字粘贴。(${e.message})` },
          { status: 422 } // 422 Unprocessable Entity 是更语义化的状态码
        );
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

    // 截断超长文本（提升至 80000 字，充分利用大模型长上下文能力）
    const MAX_CHARS = 80000;
    if (text.length > MAX_CHARS) {
      text = text.substring(0, MAX_CHARS) + '\n\n[...为保证生成质量，内容已截断...]';
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
