/**
 * dataParser.ts — Excel/CSV 数据解析器
 * 支持从 Excel (.xlsx/.xls) 和 CSV 文件中解析图表数据
 */

import * as XLSX from 'xlsx';

// ============ 类型定义 ============

export interface ParsedDataRow {
  [key: string]: string | number;
}

export interface ParseResult {
  headers: string[];
  data: ParsedDataRow[];
  sheetName?: string;
  fileName?: string;
}

export interface ParseOptions {
  headerRow?: number;     // 表头所在行（0-indexed），默认0
  dataStartRow?: number;  // 数据起始行，默认1
  dataColumn?: string;   // 数据所在列，如 'A' 或 'name'
  valueColumn?: string;  // 数值所在列，如 'B' 或 'value'
  skipEmpty?: boolean;   // 是否跳过空行
  trimStrings?: boolean; // 是否去除字符串首尾空格
}

const DEFAULT_OPTIONS: ParseOptions = {
  headerRow: 0,
  dataStartRow: 1,
  skipEmpty: true,
  trimStrings: true,
};

// ============ CSV 解析 ============

/**
 * 解析 CSV 字符串
 * @param csvText CSV 文件内容
 * @param options 解析选项
 */
export function parseCSV(csvText: string, options: Partial<ParseOptions> = {}): ParseResult {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const lines = csvText.split(/\r?\n/).filter(line => {
    if (opts.skipEmpty) return line.trim().length > 0;
    return true;
  });

  if (lines.length === 0) {
    return { headers: [], data: [] };
  }

  // 解析表头
  const headerLine = lines[opts.headerRow ?? 0];
  const headers = parseCSVLine(headerLine).map(h =>
    opts.trimStrings ? h.trim() : h
  );

  // 解析数据行
  const dataStart = opts.dataStartRow ?? 1;
  const data: ParsedDataRow[] = [];

  for (let i = dataStart; i < lines.length; i++) {
    const values = parseCSVLine(lines[i]);
    if (values.length === 0) continue;

    const row: ParsedDataRow = {};
    headers.forEach((header, idx) => {
      const raw = values[idx] ?? '';
      const value = opts.trimStrings ? raw.trim() : raw;
      row[header] = parseNumber(value);
    });
    data.push(row);
  }

  return { headers, data };
}

/**
 * 解析单行 CSV（处理引号包裹的字段）
 */
function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === ',' && !inQuotes) {
      result.push(current);
      current = '';
    } else {
      current += ch;
    }
  }
  result.push(current);
  return result;
}

// ============ Excel 解析 ============

/**
 * 解析 Excel 文件（.xlsx / .xls）
 * @param arrayBuffer 文件二进制数据
 * @param options 解析选项
 */
export function parseExcel(arrayBuffer: ArrayBuffer, options: Partial<ParseOptions> = {}): ParseResult {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const workbook = XLSX.read(arrayBuffer, { type: 'array', cellDates: true });

  // 默认取第一个 sheet
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];

  return parseSheet(sheet, opts, sheetName);
}

/**
 * 解析 Excel Sheet 为通用数据
 */
export function parseSheet(
  sheet: XLSX.WorkSheet,
  options: Partial<ParseOptions> = {},
  sheetName?: string
): ParseResult {
  const opts = { ...DEFAULT_OPTIONS, ...options };

  // 转换为行数据
  const range = XLSX.utils.decode_range(sheet['!ref'] ?? 'A1');
  const allRows: string[][] = [];

  for (let R = range.s.r; R <= range.e.r; R++) {
    const row: string[] = [];
    for (let C = range.s.c; C <= range.e.c; C++) {
      const addr = XLSX.utils.encode_cell({ r: R, c: C });
      const cell = sheet[addr];
      if (!cell) {
        row.push('');
      } else if (cell.t === 'n' || cell.t === 's' || cell.t === 'str') {
        row.push(String(cell.v ?? ''));
      } else if (cell.t === 'd') {
        row.push(String((cell.v as Date).toLocaleDateString()));
      } else {
        row.push(String(cell.v ?? ''));
      }
    }
    allRows.push(row);
  }

  if (allRows.length === 0) {
    return { headers: [], data: [], sheetName };
  }

  // 表头
  const headers = (allRows[opts.headerRow ?? 0] ?? []).map(h =>
    opts.trimStrings ? h.trim() : h
  ).filter(h => h.length > 0);

  // 数据行
  const dataStart = opts.dataStartRow ?? 1;
  const data: ParsedDataRow[] = [];

  for (let i = dataStart; i < allRows.length; i++) {
    const values = allRows[i];
    if (opts.skipEmpty && values.every(v => v.trim() === '')) continue;

    const row: ParsedDataRow = {};
    headers.forEach((header, idx) => {
      const raw = values[idx] ?? '';
      const value = opts.trimStrings ? raw.trim() : raw;
      row[header] = parseNumber(value);
    });
    data.push(row);
  }

  return { headers, data, sheetName };
}

// ============ 工具函数 ============

/**
 * 尝试将字符串解析为数字，失败则返回原字符串
 */
export function parseNumber(value: string | number): string | number {
  if (typeof value === 'number') return value;
  if (typeof value !== 'string') return value;

  const trimmed = value.trim();
  if (trimmed === '') return 0;

  // 尝试解析百分比
  if (trimmed.endsWith('%')) {
    const num = parseFloat(trimmed.slice(0, -1));
    if (!isNaN(num)) return num / 100;
  }

  // 尝试解析普通数字
  const num = parseFloat(trimmed);
  if (!isNaN(num) && isFinite(num)) return num;

  return trimmed;
}

/**
 * 将解析结果转换为 ChartDataPoint[]
 * 自动检测 name/value 列
 */
export function toChartDataPoints(result: ParseResult): Array<{ name: string; value: number }> {
  const { headers, data } = result;

  // 查找 name 列（不区分大小写）
  const nameCol = headers.find(h =>
    ['name', 'label', 'title', 'category', 'x', 'date', 'time', '月份', '名称', '项目'].includes(
      h.toLowerCase()
    )
  ) ?? headers[0];

  // 查找 value 列（不区分大小写）
  const valueCol = headers.find(h =>
    ['value', 'val', 'num', 'count', 'amount', 'y', '销量', '数值', '数据'].includes(
      h.toLowerCase()
    )
  ) ?? headers.find(h => headers.indexOf(h) !== headers.indexOf(nameCol)) ?? headers[1];

  return data.map(row => ({
    name: String(row[nameCol] ?? ''),
    value: typeof row[valueCol] === 'number' ? row[valueCol] as number : parseFloat(String(row[valueCol] ?? '0')) || 0,
  }));
}

/**
 * 解析 File 对象（Excel 或 CSV）
 */
export async function parseFile(file: File, options: Partial<ParseOptions> = {}): Promise<ParseResult> {
  const extension = file.name.split('.').pop()?.toLowerCase();

  if (extension === 'csv') {
    const text = await file.text();
    const result = parseCSV(text, options);
    result.fileName = file.name;
    return result;
  }

  if (extension === 'xlsx' || extension === 'xls') {
    const buffer = await file.arrayBuffer();
    const result = parseExcel(buffer, options);
    result.fileName = file.name;
    return result;
  }

  throw new Error(`Unsupported file type: .${extension}. Supported: .csv, .xlsx, .xls`);
}

/**
 * 检测文件是否为 Excel 文件
 */
export function isExcelFile(file: File): boolean {
  const ext = file.name.split('.').pop()?.toLowerCase();
  return ext === 'xlsx' || ext === 'xls';
}

/**
 * 检测文件是否为 CSV 文件
 */
export function isCSVFile(file: File): boolean {
  const ext = file.name.split('.').pop()?.toLowerCase();
  return ext === 'csv';
}
