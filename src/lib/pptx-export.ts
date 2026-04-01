import PptxGenJS from 'pptxgenjs';
import { Presentation, Template, templates } from './types';

// 根据templateId获取模板
function getTemplate(templateId: string): Template {
  return templates.find(t => t.id === templateId) || templates[0];
}

// 导出PPTX
export async function exportToPPTX(presentation: Presentation): Promise<Blob> {
  const pptx = new PptxGenJS();
  pptx.layout = 'LAYOUT_16x9';
  pptx.author = '省事PPT';
  pptx.title = presentation.title;

  const template = getTemplate(presentation.templateId);

  presentation.slides.forEach((slide, index) => {
    const slideObj = pptx.addSlide();

    switch (slide.type) {
      case 'title':
        addTitleSlide(slideObj, slide, template, pptx);
        break;
      case 'end':
        addEndSlide(slideObj, slide, template, pptx);
        break;
      default:
        addContentSlide(slideObj, slide, template, index, pptx);
        break;
    }
  });

  return await pptx.write({ outputType: 'blob' }) as Blob;
}

function addTitleSlide(
  slideObj: any,
  slide: { title: string; subtitle?: string },
  template: Template,
  pptx: PptxGenJS
) {
  slideObj.background = { color: template.colors.primary };

  slideObj.addText(slide.title, {
    x: 1, y: 1.8, w: 8, h: 1.5,
    fontSize: 36, fontFace: template.font,
    color: 'FFFFFF', bold: true,
    align: 'center', valign: 'middle',
  });

  if (slide.subtitle) {
    slideObj.addText(slide.subtitle, {
      x: 1, y: 3.5, w: 8, h: 0.8,
      fontSize: 18, fontFace: template.font,
      color: 'FFFFFF', align: 'center', valign: 'middle',
    });
  }

  // 装饰线
  slideObj.addShape(pptx.ShapeType.rect, {
    x: 3.5, y: 4.5, w: 3, h: 0.04,
    fill: { color: template.colors.accent },
  });
}

function addContentSlide(
  slideObj: any,
  slide: { title: string; content: string[] },
  template: Template,
  index: number,
  pptx: PptxGenJS
) {
  slideObj.background = { color: template.colors.background };

  // 顶部色带
  slideObj.addShape(pptx.ShapeType.rect, {
    x: 0, y: 0, w: '100%', h: 0.8,
    fill: { color: template.colors.primary },
  });

  // 页码
  slideObj.addText(`${index + 1}`, {
    x: 8.8, y: 0.15, w: 0.8, h: 0.5,
    fontSize: 14, color: 'FFFFFF', align: 'right',
  });

  // 标题
  slideObj.addText(slide.title, {
    x: 0.8, y: 1.2, w: 8.4, h: 0.8,
    fontSize: 28, fontFace: template.font,
    color: template.colors.primary, bold: true,
  });

  // 内容
  if (slide.content && slide.content.length > 0) {
    const contentRows = slide.content.map((item: string) => ({
      text: item,
      options: {
        fontSize: 18,
        fontFace: template.font,
        color: template.colors.text,
        bullet: { code: '2022', color: template.colors.secondary },
        paraSpaceAfter: 12,
      },
    }));

    slideObj.addText(contentRows, {
      x: 1.2, y: 2.3, w: 7.8, h: 4,
      valign: 'top', lineSpacing: 28,
    });
  }
}

function addEndSlide(
  slideObj: any,
  slide: { title: string; subtitle?: string },
  template: Template,
  pptx: PptxGenJS
) {
  slideObj.background = { color: template.colors.primary };

  slideObj.addText(slide.title, {
    x: 1, y: 2, w: 8, h: 1.2,
    fontSize: 40, fontFace: template.font,
    color: 'FFFFFF', bold: true, align: 'center',
  });

  if (slide.subtitle) {
    slideObj.addText(slide.subtitle, {
      x: 1, y: 3.5, w: 8, h: 0.8,
      fontSize: 16, fontFace: template.font,
      color: 'FFFFFF', align: 'center',
    });
  }

  slideObj.addShape(pptx.ShapeType.rect, {
    x: 3.5, y: 3.2, w: 3, h: 0.04,
    fill: { color: template.colors.accent },
  });
}
