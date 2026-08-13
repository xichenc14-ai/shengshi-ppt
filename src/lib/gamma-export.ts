// Gamma independent export client.
// Docs: https://developers.gamma.app

export const GAMMA_API_BASE = 'https://public-api.gamma.app/v1.0';
export const GAMMA_UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

export type GammaExportFormat = 'pdf' | 'pptx' | 'png';
export type GammaExportStatus = 'pending' | 'processing' | 'completed' | 'failed';

export type GammaExportError = {
  reason?: string;
  message?: string;
};

export type GammaExport = {
  exportId: string;
  gammaId: string;
  exportAs: GammaExportFormat;
  status: GammaExportStatus;
  exportUrl?: string;
  error?: GammaExportError;
};

export const GAMMA_EXPORT_FORMATS: readonly GammaExportFormat[] = ['pdf', 'pptx', 'png'];

// Kept for the legacy preview/export routes during the rolling deployment.
export function getGammaAdditionalExportUnsupportedMessage(format: 'pdf' | 'pptx'): string {
  return `当前旧导出链路不支持对已生成文稿再次导出 ${format.toUpperCase()}，请使用新的独立导出流程。`;
}

export function isGammaExportFormat(value: unknown): value is GammaExportFormat {
  return GAMMA_EXPORT_FORMATS.includes(value as GammaExportFormat);
}

export function getArtifactMimeType(format: GammaExportFormat): string {
  switch (format) {
    case 'pdf':
      return 'application/pdf';
    case 'pptx':
      return 'application/vnd.openxmlformats-officedocument.presentationml.presentation';
    case 'png':
      return 'application/zip';
  }
}

export function getArtifactExtension(format: GammaExportFormat): string {
  return format === 'png' ? 'zip' : format;
}

function readErrorMessage(payload: unknown, fallback: string): string {
  if (payload && typeof payload === 'object') {
    const record = payload as Record<string, unknown>;
    const nested = record.error && typeof record.error === 'object'
      ? record.error as Record<string, unknown>
      : null;
    return String(nested?.message || record.message || record.error || fallback);
  }
  return fallback;
}

async function parseJsonOrText(response: Response): Promise<unknown> {
  const text = await response.text();
  if (!text) return {};
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

export async function createGammaExport(
  apiKey: string,
  gammaId: string,
  format: GammaExportFormat
): Promise<GammaExport> {
  const response = await fetch(`${GAMMA_API_BASE}/gammas/${encodeURIComponent(gammaId)}/export`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-API-KEY': apiKey,
      'User-Agent': GAMMA_UA,
    },
    body: JSON.stringify({ exportAs: format }),
    signal: AbortSignal.timeout(30_000),
  });

  const payload = await parseJsonOrText(response);
  if (!response.ok) {
    throw new Error(`Gamma ${format.toUpperCase()} 导出任务创建失败: ${response.status} ${readErrorMessage(payload, '上游服务错误')}`);
  }

  const data = payload as Record<string, unknown>;
  const exportId = String(data.exportId || data.id || '').trim();
  if (!exportId) throw new Error('Gamma 导出接口未返回 exportId');

  return {
    exportId,
    gammaId,
    exportAs: format,
    status: normalizeGammaExportStatus(data.status),
    exportUrl: typeof data.exportUrl === 'string' ? data.exportUrl : undefined,
  };
}

export async function getGammaExport(
  apiKey: string,
  exportId: string
): Promise<GammaExport> {
  const response = await fetch(`${GAMMA_API_BASE}/exports/${encodeURIComponent(exportId)}`, {
    headers: {
      'X-API-KEY': apiKey,
      'User-Agent': GAMMA_UA,
    },
    signal: AbortSignal.timeout(30_000),
  });

  const payload = await parseJsonOrText(response);
  if (!response.ok) {
    throw new Error(`Gamma 导出状态查询失败: ${response.status} ${readErrorMessage(payload, '上游服务错误')}`);
  }

  const data = payload as Record<string, unknown>;
  const exportIdFromPayload = String(data.exportId || data.id || exportId).trim();
  const format = isGammaExportFormat(data.exportAs)
    ? data.exportAs
    : isGammaExportFormat(data.format)
      ? data.format
      : 'pdf';

  return {
    exportId: exportIdFromPayload,
    gammaId: String(data.gammaId || '').trim(),
    exportAs: format,
    status: normalizeGammaExportStatus(data.status),
    exportUrl: typeof data.exportUrl === 'string' ? data.exportUrl : undefined,
    error: data.error && typeof data.error === 'object'
      ? {
        reason: String((data.error as Record<string, unknown>).reason || ''),
        message: String((data.error as Record<string, unknown>).message || ''),
      }
      : undefined,
  };
}

export function normalizeGammaExportStatus(value: unknown): GammaExportStatus {
  const status = String(value || '').toLowerCase();
  if (status === 'completed' || status === 'complete' || status === 'ready') return 'completed';
  if (status === 'failed' || status === 'error') return 'failed';
  if (status === 'processing' || status === 'in_progress') return 'processing';
  return 'pending';
}

export function isValidPdfBuffer(buffer: Buffer): boolean {
  return buffer.length >= 5 && buffer.subarray(0, 5).toString('ascii') === '%PDF-';
}

export function isValidZipBuffer(buffer: Buffer): boolean {
  return buffer.length >= 4
    && buffer[0] === 0x50
    && buffer[1] === 0x4b
    && [0x03, 0x05, 0x07].includes(buffer[2]);
}

export function isValidPptxBuffer(buffer: Buffer): boolean {
  if (!isValidZipBuffer(buffer)) return false;
  return buffer.includes(Buffer.from('[Content_Types].xml'))
    && buffer.includes(Buffer.from('ppt/presentation.xml'));
}

export function isValidPngZipBuffer(buffer: Buffer): boolean {
  if (!isValidZipBuffer(buffer)) return false;
  return buffer.toString('latin1').toLowerCase().includes('.png');
}

export function validateGammaExportBuffer(format: GammaExportFormat, buffer: Buffer): boolean {
  if (format === 'pdf') return isValidPdfBuffer(buffer);
  if (format === 'pptx') return isValidPptxBuffer(buffer);
  return isValidPngZipBuffer(buffer);
}
