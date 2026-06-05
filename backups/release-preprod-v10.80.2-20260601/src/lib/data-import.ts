/**
 * data-import.ts
 * Excel / CSV 数据导入解析
 * 使用 xlsx (SheetJS) 库
 */

import * as XLSX from 'xlsx';
import type { ImportedData } from './chart-types';
export type { ImportedData } from './chart-types';

/**
 * parseExcel — 解析 Excel 文件内容（粘贴文本或文件内容）
 * 自动识别数据范围和列头，多系列自动归类
 */
export async function parseExcel(input: string): Promise<ImportedData> {
  try {
    // Detect format: base64 binary vs raw tab-separated text
    const trimmed = input.trim();
    const isBase64 = trimmed.length > 500 && /^[A-Za-z0-9+/=]+$/.test(trimmed.replace(/\s/g, ''));

    if (isBase64) {
      const binary = atob(trimmed);
      const buf = new ArrayBuffer(binary.length);
      const arr = new Uint8Array(buf);
      for (let i = 0; i < binary.length; i++) arr[i] = binary.charCodeAt(i);
      const wb = XLSX.read(arr, { type: 'array' });
      const name = wb.SheetNames[0];
      const sheet = wb.Sheets[name];
      const json = XLSX.utils.sheet_to_json(sheet, { header: 1 }) as unknown[][];
      return parse2DArray(json);
    }

    // Raw text — split by newlines
    const lines = trimmed.split('\n').filter((l) => l.trim());
    if (lines.length < 2) throw new Error('数据至少需要标题行和一行数据');

    // Detect delimiter: tab = Excel paste, comma = CSV
    const delimiter = lines[0].includes('\t') ? '\t' : ',';
    return parse2DArray(lines.map((line) => line.split(delimiter).map((c) => c.trim())));
  } catch {
    // Fallback: treat as CSV
    return parseCSV(input);
  }
}

/**
 * parseCSV — 解析 CSV 文本
 */
export function parseCSV(text: string): ImportedData {
  const lines = text.split('\n').filter((l) => l.trim());
  const rows = lines.map((line) => {
    const cells: string[] = [];
    let cur = '';
    let inQuotes = false;
    for (const ch of line) {
      if (ch === '"') {
        inQuotes = !inQuotes;
      } else if (ch === ',' && !inQuotes) {
        cells.push(cur.trim());
        cur = '';
      } else {
        cur += ch;
      }
    }
    cells.push(cur.trim());
    return cells;
  });
  return parse2DArray(rows);
}

/**
 * parse2DArray — 将 string[][] 解析为 ImportedData
 * 首行为列头，其余为数据行
 * 相同列标题自动归为同一 series
 */
function parse2DArray(rows: string[][]): ImportedData {
  if (rows.length < 2) {
    throw new Error('数据至少需要标题行和一行数据');
  }

  const headers = rows[0];
  const dataRows = rows.slice(1);
  const categories: string[] = [];
  const seriesMap: Map<string, number[]> = new Map();

  for (const row of dataRows) {
    const cat = row[0] ?? '';
    if (!cat) continue;
    categories.push(cat);

    for (let col = 1; col < headers.length; col++) {
      const header = headers[col] || `列${col}`;
      const raw = (row[col] ?? '0').replace(/,/g, '');
      const num = parseFloat(raw);
      if (isNaN(num)) continue; // skip non-numeric

      if (!seriesMap.has(header)) seriesMap.set(header, []);
      seriesMap.get(header)!.push(num);
    }
  }

  // Ensure all series have same length as categories (fill with 0)
  const seriesNames = Array.from(seriesMap.keys());
  for (const name of seriesNames) {
    const arr = seriesMap.get(name)!;
    while (arr.length < categories.length) arr.push(0);
  }

  const series = seriesNames.map((name) => ({ name, data: seriesMap.get(name)! }));

  return {
    headers,
    rows: dataRows,
    series,
    categories,
  };
}

/**
 * parseExcelFile — 解析浏览器 File 对象
 */
export async function parseExcelFile(file: File): Promise<ImportedData> {
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, { type: 'array' });
  const name = wb.SheetNames[0];
  const sheet = wb.Sheets[name];
  const json = XLSX.utils.sheet_to_json(sheet, { header: 1 }) as unknown[][];
  return parse2DArray(json);
}
