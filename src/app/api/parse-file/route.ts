import { NextRequest, NextResponse } from 'next/server';
import { getClientIP, rateLimit } from '@/lib/rate-limit';

export const runtime = 'nodejs';

// ===== Node.js polyfills for pdfjs-dist v5.x =====
if (typeof globalThis !== 'undefined') {
  // DOMMatrix
  if (!(globalThis as any).DOMMatrix) {
    (globalThis as any).DOMMatrix = class DOMMatrix {
      a = 1; b = 0; c = 0; d = 1; e = 0; f = 0;
      m11 = 1; m12 = 0; m13 = 0; m14 = 0;
      m21 = 0; m22 = 1; m23 = 0; m24 = 0;
      m31 = 0; m32 = 0; m33 = 1; m34 = 0;
      m41 = 0; m42 = 0; m43 = 0; m44 = 1;
      is2D = true; isIdentity = true;
      constructor(init?: any) {}
      scale() { return this; }
      translate() { return this; }
      rotate() { return this; }
      multiply() { return this; }
      inverse() { return new (globalThis as any).DOMMatrix(); }
      transformPoint() { return { x: 0, y: 0, z: 0, w: 1 }; }
      setMatrixValue() { return this; }
      toString() { return 'matrix(1, 0, 0, 1, 0, 0)'; }
      toJSON() { return { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 }; }
    };
  }
  // OffscreenCanvas（pdfjs v5可能需要）
  if (!(globalThis as any).OffscreenCanvas) {
    (globalThis as any).OffscreenCanvas = class OffscreenCanvas {
      width = 0; height = 0;
      constructor(w: number, h: number) { this.width = w; this.height = h; }
      getContext() { return null; }
      transferToImageBitmap() { return {}; }
    };
  }
  // Path2D
  if (!(globalThis as any).Path2D) {
    (globalThis as any).Path2D = class Path2D {
      constructor(path?: any) {}
      moveTo() {}
      lineTo() {}
      closePath() {}
      addPath() {}
    };
  }
  // ImageData
  if (!(globalThis as any).ImageData) {
    (globalThis as any).ImageData = class ImageData {
      data: Uint8ClampedArray;
      width: number; height: number;
      constructor(w: number, h: number) {
        this.width = w; this.height = h;
        this.data = new Uint8ClampedArray(w * h * 4);
      }
    };
  }
  // ImageBitmap
  if (!(globalThis as any).ImageBitmap) {
    (globalThis as any).ImageBitmap = class ImageBitmap {
      width = 0; height = 0;
      close() {}
    };
  }
  // structuredClone
  if (!(globalThis as any).structuredClone) {
    (globalThis as any).structuredClone = (obj: any) => JSON.parse(JSON.stringify(obj));
  }
}

/**
 * PDF文本提取 - 使用pdfjs-dist v5.x legacy模式
 */
async function parsePdf(buffer: Buffer): Promise<string> {
  try {
    // 使用pdfjs-dist/legacy（纯JS，不需要web worker）
    const pdfjsLib = await import('pdfjs-dist/legacy/build/pdf.mjs');
    const { getDocument, GlobalWorkerOptions } = pdfjsLib;
    
    // 设置workerSrc — 使用data URL内联worker（避免CDN/file协议问题）
    // @ts-ignore - Next.js支持?url导入
    const workerUrl = (await import('pdfjs-dist/build/pdf.worker.min.mjs?url')).default;
    GlobalWorkerOptions.workerSrc = workerUrl;
    console.log('[Parse] pdfjs workerSrc set:', typeof workerUrl, String(workerUrl).substring(0, 50));
    
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
        const str = (item as any).str || '';
        if (!str) continue;
        const y = (item as any).transform?.[5] ?? -1;
        if (lastY >= 0 && Math.abs(y - lastY) > 2) {
          text += '\n';
        }
        text += str;
        lastY = y;
      }
      if (i < doc.numPages) text += '\n\n';
    }

    doc.destroy();
    return text.trim();
  } catch (e: any) {
    console.error('[Parse] pdfjs-dist失败:', e.message);
    throw e;
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
    if (file.size > 50 * 1024 * 1024) {
      return NextResponse.json({ error: '文件超过50MB限制' }, { status: 400 });
    }

    const fileName = file.name.toLowerCase();
    const buffer = Buffer.from(await file.arrayBuffer());
    let text = '';

    if (fileName.endsWith('.pdf')) {
      try {
        text = await parsePdf(buffer);
        if (!text) {
          text = `[PDF: ${file.name}, ${buffer.length} bytes, 扫描件/无文字内容]`;
        }
      } catch (e1: any) {
        console.error('[Parse] PDF解析失败:', e1.message, e1.stack?.substring(0, 200));
        text = `[PDF: ${file.name}, 解析失败(${e1.message})，请复制文字后直接粘贴]`;
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
      } catch (e: any) { text = `[Excel: ${file.name}，解析失败]`; }
    } else if (fileName.endsWith('.docx') || fileName.endsWith('.doc')) {
      try {
        const mammoth = await import('mammoth');
        const result = await mammoth.extractRawText({ buffer });
        text = result.value.trim() || `[Word: ${file.name}，内容为空]`;
      } catch (e: any) {
        return NextResponse.json({ error: `Word解析失败: ${e.message}` }, { status: 422 });
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
      } catch (e: any) { text = `[PPT: ${file.name}，解析失败]`; }
    } else if (fileName.endsWith('.txt') || fileName.endsWith('.md')) {
      text = buffer.toString('utf-8').trim() || `[文件: ${file.name}，内容为空]`;
    } else {
      text = `[文件: ${file.name}]`;
    }

    if (text.length > 80000) text = text.substring(0, 80000) + '\n\n[...内容已截断...]';

    return NextResponse.json({ text, fileName: file.name, fileSize: file.size, charCount: text.length });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
