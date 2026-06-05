import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

const execFileAsync = promisify(execFile);

const PPTX_MIME = 'application/vnd.openxmlformats-officedocument.presentationml.presentation';
const PDF_MIME = 'application/pdf';
const SOFFICE_CANDIDATES = ['/opt/homebrew/bin/soffice', 'soffice', 'libreoffice'];

function sanitizeBaseName(rawName: string): string {
  const trimmed = (rawName || 'shengxin-ppt').trim() || 'shengxin-ppt';
  const normalized = trimmed.replace(/[^\w\u4e00-\u9fff.-]/g, '_');
  return normalized.replace(/\.pdf$/i, '').replace(/\.pptx$/i, '') || 'shengxin-ppt';
}

async function tryExternalConverter(pptxBuffer: Buffer, baseName: string): Promise<Buffer | null> {
  const serviceUrl = process.env.PDF_CONVERTER_URL?.trim();
  if (!serviceUrl) return null;

  const response = await fetch(serviceUrl, {
    method: 'POST',
    headers: {
      'Content-Type': PPTX_MIME,
      'X-Filename': `${baseName}.pptx`,
      'Accept': PDF_MIME,
    },
    body: new Uint8Array(pptxBuffer),
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => '');
    throw new Error(`外部 PDF 转换服务失败: ${response.status}${detail ? ` ${detail.slice(0, 180)}` : ''}`);
  }

  return Buffer.from(await response.arrayBuffer());
}

async function tryLocalSoffice(pptxBuffer: Buffer, baseName: string): Promise<Buffer | null> {
  const tempDir = await mkdtemp(path.join(tmpdir(), 'shengxin-pdf-'));
  const pptxPath = path.join(tempDir, `${baseName}.pptx`);
  const pdfPath = path.join(tempDir, `${baseName}.pdf`);

  try {
    await writeFile(pptxPath, pptxBuffer);

    let converted = false;
    for (const command of SOFFICE_CANDIDATES) {
      try {
        await execFileAsync(command, ['--headless', '--convert-to', 'pdf', '--outdir', tempDir, pptxPath], {
          timeout: 120000,
        });
        converted = true;
        break;
      } catch (error: any) {
        if (error?.code === 'ENOENT') continue;
        throw new Error(`本地 PDF 转换失败: ${error instanceof Error ? error.message : String(error)}`);
      }
    }

    if (!converted) return null;
    return await readFile(pdfPath);
  } finally {
    await rm(tempDir, { recursive: true, force: true }).catch(() => undefined);
  }
}

export async function convertPptxToPdf(pptxBuffer: Buffer, rawName: string): Promise<Buffer> {
  const baseName = sanitizeBaseName(rawName);

  const externalPdf = await tryExternalConverter(pptxBuffer, baseName);
  if (externalPdf) return externalPdf;

  const localPdf = await tryLocalSoffice(pptxBuffer, baseName);
  if (localPdf) return localPdf;

  throw new Error('当前环境未配置 PDF 转换器。生产环境需要配置 PDF_CONVERTER_URL，或在可执行环境中提供 soffice/libreoffice。');
}
