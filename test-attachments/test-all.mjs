import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import JSZip from 'jszip';

const __dirname = dirname(fileURLToPath(import.meta.url));
const testDir = __dirname;

// ===== PDF 解析（复制自 route.ts） =====
async function parsePdfWithPdfJs(buffer) {
  const { getDocument } = await import('pdfjs-dist/legacy/build/pdf.mjs');
  const doc = await getDocument({ data: new Uint8Array(buffer) }).promise;
  const parts = [];
  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i);
    const content = await page.getTextContent();
    const pageText = content.items.map(item => item.str).join(' ').trim();
    if (pageText) parts.push(pageText);
  }
  return parts.join('\n\n');
}

async function parsePdfWithPdfParse(buffer) {
  const pdfParse = (await import('pdf-parse')).default;
  const pdfData = await pdfParse(buffer);
  return pdfData.text || '';
}

// ===== Excel 解析 =====
async function parseExcel(buffer) {
  const XLSX = await import('xlsx');
  const workbook = XLSX.read(buffer, { type: 'buffer' });
  const sheets = [];
  for (const sheetName of workbook.SheetNames) {
    const sheet = workbook.Sheets[sheetName];
    const csv = XLSX.utils.sheet_to_csv(sheet);
    if (csv.trim()) sheets.push(`【${sheetName}】\n${csv}`);
  }
  return sheets.join('\n\n') || `[Excel文件，无数据]`;
}

// ===== Word 解析 =====
async function parseWord(buffer) {
  const zip = await JSZip.loadAsync(buffer);
  const docXml = await zip.file('word/document.xml')?.async('text');
  if (docXml) {
    const texts = docXml.match(/<w:t[^>]*>([^<]*)<\/w:t>/g) || [];
    const plainText = texts.map(t => t.replace(/<[^>]+>/g, '')).filter(Boolean).join('\n').trim();
    if (plainText.length > 10) return plainText;
    return `[Word: 解析内容为空]`;
  }
  return `[Word: 解析失败]`;
}

// ===== PPT 解析 =====
async function parsePpt(buffer) {
  const zip = await JSZip.loadAsync(buffer);
  const slides = [];
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
      if (slideText) slides.push(slideText);
    }
  }
  return slides.length > 0 ? slides.join('\n\n') : `[PPT: 无文本内容]`;
}

// ===== 主测试 =====
async function testFile(fileName) {
  const filePath = join(testDir, fileName);
  const buffer = readFileSync(filePath);
  const ext = fileName.toLowerCase().split('.').pop();
  let text = '';
  let status = '❌';

  try {
    if (ext === 'pdf') {
      try {
        text = await parsePdfWithPdfJs(buffer);
        if (text.trim()) status = '✅';
        else text = '[空内容]';
      } catch {
        try {
          text = await parsePdfWithPdfParse(buffer);
          if (text.trim()) status = '✅';
        } catch { text = '[解析失败]'; }
      }
    } else if (ext === 'xlsx' || ext === 'xls' || ext === 'csv') {
      text = await parseExcel(buffer);
      status = text.includes('[Excel文件') ? '⚠️' : '✅';
    } else if (ext === 'docx' || ext === 'doc') {
      text = await parseWord(buffer);
      status = text.includes('[Word') ? '⚠️' : '✅';
    } else if (ext === 'pptx' || ext === 'ppt') {
      text = await parsePpt(buffer);
      status = text.includes('[PPT') ? '⚠️' : '✅';
    } else if (ext === 'txt' || ext === 'md') {
      text = buffer.toString('utf-8');
      status = text.trim() ? '✅' : '⚠️';
    } else if (['png', 'jpg', 'jpeg', 'gif', 'webp'].includes(ext)) {
      text = `[图片: ${fileName}]`;
      status = '📷'; // 图片不支持文本提取
    } else {
      text = `[不支持: ${fileName}]`;
      status = '➖';
    }
  } catch (e) {
    text = `[错误: ${e.message}]`;
  }

  const preview = text.slice(0, 80).replace(/\n/g, ' ');
  console.log(`${status} ${fileName}`);
  console.log(`   预览: ${preview}${text.length > 80 ? '...' : ''}`);
  console.log(`   长度: ${text.length} 字符`);
  console.log('');
  return { fileName, status, text, length: text.length };
}

const files = [
  '1-文本.txt',
  '2-表格.csv',
  '3-文档.md',
  '4-Word文档.docx',
  '5-Excel表格.xlsx',
  '6-PDF文档.pdf',
  '7-PNG图片.png',
  '8-JPG图片.jpg',
  '9-PPT演示.pptx',
];

console.log('🧪 省心PPT 附件解析测试\n');
console.log('=' .repeat(50));

const results = [];
for (const f of files) {
  results.push(await testFile(f));
}

console.log('=' .repeat(50));
console.log('\n📊 测试汇总:');
const passed = results.filter(r => r.status === '✅').length;
const warned = results.filter(r => r.status === '⚠️').length;
const failed = results.filter(r => r.status === '❌').length;
const skipped = results.filter(r => r.status === '📷' || r.status === '➖').length;
console.log(`✅ 通过: ${passed}`);
console.log(`⚠️ 警告: ${warned}`);
console.log(`❌ 失败: ${failed}`);
console.log(`📷/➖ 跳过: ${skipped} (图片/不支持格式)`);
