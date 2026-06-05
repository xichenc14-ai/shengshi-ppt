/**
 * chart-engine.ts
 * 图表核心逻辑：验证 / 解析 / 渲染
 *
 * API:
 *   validateChartData(type, raw) → ValidationResult
 *   parseExcelFile(file) → ImportedData
 *   parseCSV(text) → ImportedData
 *   renderChartToImage(type, data, theme, size) → Promise<string>  // base64 PNG
 *   embedChartInSlide(slide, chartImage, position, title?) → void
 */

import type {
  ChartType,
  ChartDataPoint,
  ValidationResult,
  ThemeColors,
} from './chart-types';
import { parseExcel, parseCSV, parseExcelFile } from './data-import';

type PptxSlide = {
  addImage: (options: Record<string, unknown>) => void;
  addText: (text: string, options?: Record<string, unknown>) => void;
};

// ─────────────────────────────────────────────
// Validation
// ─────────────────────────────────────────────

export function validateChartData(type: ChartType, raw: unknown): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!raw) {
    errors.push('数据不能为空');
    return { valid: false, errors, warnings };
  }

  if (type === 'pie') {
    if (!Array.isArray(raw)) {
      errors.push('饼图数据必须是数组格式');
    } else {
      raw.forEach((item, i: number) => {
        const row = item as Partial<ChartDataPoint>;
        if (typeof row.name !== 'string' || !row.name) {
          errors.push(`第 ${i + 1} 项缺少名称`);
        }
        if (typeof row.value !== 'number' || isNaN(row.value)) {
          errors.push(`第 ${i + 1} 项数值无效`);
        }
        if (typeof row.value === 'number' && row.value < 0) {
          warnings.push(`第 ${i + 1} 项数值为负数`);
        }
      });
    }
  } else {
    if (!Array.isArray(raw)) {
      errors.push('数据必须是数组格式');
    } else {
      raw.forEach((item, i: number) => {
        const row = item as Partial<ChartDataPoint>;
        if (typeof row.name !== 'string' || !row.name) {
          errors.push(`第 ${i + 1} 项缺少名称`);
        }
        if (typeof row.value !== 'number' || isNaN(row.value)) {
          errors.push(`第 ${i + 1} 项数值无效`);
        }
        if (typeof row.value === 'number' && row.value < 0) {
          warnings.push(`第 ${i + 1} 项数值为负数`);
        }
      });
    }
  }

  return { valid: errors.length === 0, errors, warnings };
}

// ─────────────────────────────────────────────
// Parse (re-export from data-import)
// ─────────────────────────────────────────────

export { parseExcel, parseCSV, parseExcelFile };

// ─────────────────────────────────────────────
// Chart to Image rendering  (deferred to chart-engine-client.tsx)
// ─────────────────────────────────────────────

/**
 * renderChartToImage — placeholder; actual rendering is in chart-engine-client.tsx
 * This file exports validation + parse + embed APIs.
 * For server-side chart-to-PNG rendering, use chart-engine-client.tsx.
 */
export async function renderChartToImage(
  _type: ChartType,
  _data: ChartDataPoint[],
  _theme: ThemeColors,
  _size: { width: number; height: number },
  _scale = 2
): Promise<string> {
  throw new Error(
    'renderChartToImage is available only in browser context. ' +
    'Import from ~/chart-engine-client.tsx instead.'
  );
}

// ─────────────────────────────────────────────
// PPT Embed
// ─────────────────────────────────────────────

export interface EmbedPosition {
  x: number;  // EMU (English Metric Units) — 1 inch = 914400 EMU
  y: number;
  w: number;
  h: number;
}

/**
 * embedChartInSlide — 将图表 PNG base64 嵌入 PPT slide
 */
export function embedChartInSlide(
  slide: PptxSlide,
  chartImage: string,
  position: EmbedPosition,
  title?: string
): void {
  if (title) {
    slide.addText(title, {
      x: position.x / 914400,
      y: (position.y - 300000) / 914400,
      w: position.w / 914400,
      h: 300000 / 914400,
      fontSize: 14,
      color: '333333',
      bold: true,
    });
  }

  slide.addImage({
    data: chartImage,
    x: position.x / 914400,
    y: position.y / 914400,
    w: position.w / 914400,
    h: position.h / 914400,
  });
}
