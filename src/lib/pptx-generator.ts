import PptxGenJS from 'pptxgenjs';

// 主题配色表（与 Gamma 主题对应）
const THEMES: Record<string, { primary: string; secondary: string; bg: string; text: string; accent: string; font: string }> = {
  'default-light': { primary: '5B4FE9', secondary: '8B5CF6', bg: 'FFFFFF', text: '1F2937', accent: 'F59E0B', font: 'Microsoft YaHei' },
  'consultant':    { primary: '1E3A5F', secondary: '2E5F8A', bg: 'FFFFFF', text: '1F2937', accent: 'D4A843', font: 'Microsoft YaHei' },
  'founder':       { primary: '0F172A', secondary: '1E293B', bg: 'FFFFFF', text: '0F172A', accent: 'F97316', font: 'Microsoft YaHei' },
  'aurora':        { primary: '6366F1', secondary: '8B5CF6', bg: '0F172A', text: 'F8FAFC', accent: '22D3EE', font: 'Microsoft YaHei' },
  'icebreaker':    { primary: '059669', secondary: '10B981', bg: 'FFFFFF', text: '1F2937', accent: 'F59E0B', font: 'Microsoft YaHei' },
  'electric':      { primary: 'EC4899', secondary: 'F472B6', bg: '1F2937', text: 'F8FAFC', accent: 'FBBF24', font: 'Microsoft YaHei' },
  'ashrose':       { primary: 'E11D48', secondary: 'FB7185', bg: 'FFF1F2', text: '1F2937', accent: 'F59E0B', font: 'Microsoft YaHei' },
  'gleam':         { primary: '2563EB', secondary: '3B82F6', bg: 'F8FAFC', text: '1E293B', accent: '10B981', font: 'Microsoft YaHei' },
  'blues':         { primary: '1D4ED8', secondary: '3B82F6', bg: 'EFF6FF', text: '1E293B', accent: 'F59E0B', font: 'Microsoft YaHei' },
  'chisel':        { primary: '475569', secondary: '64748B', bg: 'F8FAFC', text: '1E293B', accent: '6366F1', font: 'Microsoft YaHei' },
  'finesse':       { primary: '7C3AED', secondary: 'A78BFA', bg: 'FAF5FF', text: '1E293B', accent: 'EC4899', font: 'Microsoft YaHei' },
  // fallback
  'ocean':         { primary: '1e40af', secondary: '3b82f6', bg: 'FFFFFF', text: '1e293b', accent: '60a5fa', font: 'system-ui' },
  'forest':        { primary: '166534', secondary: '22c55e', bg: 'FFFFFF', text: '1e293b', accent: '4ade80', font: 'system-ui' },
  'sunset':        { primary: 'ea580c', secondary: 'f97316', bg: 'FFFFFF', text: '1e293b', accent: 'fb923c', font: 'system-ui' },
  'dark':          { primary: '7c3aed', secondary: '8b5cf6', bg: '0f172a', text: 'f1f5f9', accent: 'a78bfa', font: 'system-ui' },
  'rose':          { primary: 'e11d48', secondary: 'f43f5e', bg: 'FFFFFF', text: '1e293b', accent: 'fb7185', font: 'system-ui' },
};

export interface SlideInput {
  title: string;
  subtitle?: string;
  content?: string[];
  type?: 'title' | 'content' | 'toc' | 'end';
}

export interface GenerateOptions {
  title: string;
  slides: SlideInput[];
  themeId?: string;
}

// 生成唯一文件名
function generateFileId(): string {
  return `ppt_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
}

// 主生成函数 — 纯内存，不写磁盘（兼容 Vercel Serverless）
export async function generatePPTX(options: GenerateOptions): Promise<{ fileId: string; buffer: Buffer; base64: string }> {
  const { title, slides, themeId = 'default-light' } = options;

  const theme = THEMES[themeId] || THEMES['default-light'];
  const pptx = new PptxGenJS();
  pptx.layout = 'LAYOUT_16x9';
  pptx.title = title;
  pptx.author = '省心PPT';

  // 封面页
  const coverSlide = pptx.addSlide();
  coverSlide.background = { color: theme.primary };
  coverSlide.addText(title, {
    x: 0.8, y: 1.8, w: 8.4, h: 1.5,
    fontSize: 40, fontFace: theme.font,
    color: 'FFFFFF', bold: true,
    align: 'center', valign: 'middle',
  });
  if (slides[0]?.subtitle) {
    coverSlide.addText(slides[0].subtitle, {
      x: 0.8, y: 3.5, w: 8.4, h: 0.6,
      fontSize: 18, fontFace: theme.font,
      color: 'FFFFFF', align: 'center',
    });
  }
  // 装饰线
  coverSlide.addShape(pptx.ShapeType.rect, {
    x: 3.5, y: 4.3, w: 3, h: 0.04,
    fill: { color: theme.accent },
  });

  // 目录页
  const tocSlide = pptx.addSlide();
  tocSlide.background = { color: theme.bg };
  tocSlide.addShape(pptx.ShapeType.rect, {
    x: 0, y: 0, w: '100%', h: 0.9,
    fill: { color: theme.primary },
  });
  tocSlide.addText('目录', {
    x: 0.8, y: 0.15, w: 8, h: 0.6,
    fontSize: 24, fontFace: theme.font,
    color: 'FFFFFF', bold: true,
  });
  const tocItems = slides.slice(2).map((s, i) => `${i + 1}. ${s.title}`);
  tocItems.forEach((item, i) => {
    tocSlide.addText(item, {
      x: 1.2, y: 1.3 + i * 0.55, w: 8, h: 0.5,
      fontSize: 16, fontFace: theme.font,
      color: theme.text, bullet: { type: 'bullet' },
    });
  });

  // 内容页（跳过封面和目录，从第3页开始）
  slides.slice(2).forEach((slide, idx) => {
    const contentSlide = pptx.addSlide();
    contentSlide.background = { color: theme.bg };

    // 顶部色带
    contentSlide.addShape(pptx.ShapeType.rect, {
      x: 0, y: 0, w: '100%', h: 0.85,
      fill: { color: theme.primary },
    });

    // 页码
    contentSlide.addText(`${idx + 3}`, {
      x: 8.8, y: 0.15, w: 0.8, h: 0.5,
      fontSize: 14, color: 'FFFFFF', align: 'right',
    });

    // 标题
    contentSlide.addText(slide.title, {
      x: 0.8, y: 1.1, w: 8.4, h: 0.8,
      fontSize: 26, fontFace: theme.font,
      color: theme.primary, bold: true,
    });

    // 内容要点
    if (slide.content && slide.content.length > 0) {
      const rows = slide.content.map(item => ({
        text: item,
        options: {
          fontSize: 16,
          fontFace: theme.font,
          color: theme.text,
          bullet: { type: 'bullet' },
          paraSpaceAfter: 10,
        },
      }));
      contentSlide.addText(rows as any, {
        x: 1.0, y: 2.1, w: 8.2, h: 4,
        valign: 'top', lineSpacing: 26,
      });
    }
  });

  // 结尾页
  const endSlide = pptx.addSlide();
  endSlide.background = { color: theme.primary };
  endSlide.addText('感谢观看', {
    x: 0.8, y: 2.0, w: 8.4, h: 1.0,
    fontSize: 38, fontFace: theme.font,
    color: 'FFFFFF', bold: true, align: 'center',
  });
  endSlide.addShape(pptx.ShapeType.rect, {
    x: 3.5, y: 3.1, w: 3, h: 0.04,
    fill: { color: theme.accent },
  });
  endSlide.addText(title, {
    x: 0.8, y: 3.4, w: 8.4, h: 0.6,
    fontSize: 16, fontFace: theme.font,
    color: 'FFFFFF', align: 'center',
  });

  // 生成到内存（不写磁盘，兼容 Vercel Serverless）
  const fileId = generateFileId();
  const buffer = await pptx.write({ outputType: 'nodebuffer' }) as Buffer;
  const base64 = buffer.toString('base64');

  return { fileId, buffer, base64 };
}
