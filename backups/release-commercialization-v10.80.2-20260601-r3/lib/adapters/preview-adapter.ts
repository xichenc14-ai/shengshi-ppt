/**
 * preview-adapter - extractPreviewFromGamma
 * 从 Gamma API 响应提取规范化 PreviewInfo
 *
 * 状态映射（gamma → PreviewStatus）：
 *   pending              → pending
 *   processing/in_progress → loading
 *   completed/done      → ready
 *   failed/error        → failed
 */

import { PreviewInfo, PreviewStatus, PreviewErrorCode } from '@/types/preview';

type GammaStatus = string;

function mapGammaStatus(raw: GammaStatus): PreviewStatus {
  switch (raw) {
    case 'pending':
      return 'pending';
    case 'processing':
    case 'in_progress':
      return 'loading';
    case 'completed':
    case 'done':
      return 'ready';
    case 'failed':
    case 'error':
      return 'failed';
    default:
      return 'failed';
  }
}

/**
 * 从 Gamma API 响应提取 PreviewInfo
 * @param gammaData Gamma API 返回的完整 JSON
 * @returns PreviewInfo 兼容结构
 */
export function extractPreviewFromGamma(gammaData: Record<string, unknown>): PreviewInfo {
  // generationId
  const generationId = (gammaData.generationId as string)
    || (gammaData.id as string)
    || '';

  // status → canonical PreviewStatus
  const rawStatus = (gammaData.status as string) || 'pending';
  const status: PreviewStatus = mapGammaStatus(rawStatus);

  // gammaUrl
  let gammaUrl: string | null = null;
  if (gammaData.gammaUrl && typeof gammaData.gammaUrl === 'string') {
    gammaUrl = gammaData.gammaUrl;
  } else if (gammaData.webUrl && typeof gammaData.webUrl === 'string') {
    gammaUrl = gammaData.webUrl;
  } else if (gammaData.url && typeof gammaData.url === 'string') {
    gammaUrl = gammaData.url;
  } else if (gammaData.link && typeof gammaData.link === 'string') {
    gammaUrl = gammaData.link;
  }

  // exportUrl + exportFormat
  let exportUrl: string | null = null;
  let exportFormat: PreviewInfo['exportFormat'] = 'unknown';

  if (typeof gammaData.exportUrl === 'string' && gammaData.exportUrl) {
    exportUrl = gammaData.exportUrl;
    const lower = gammaData.exportUrl.toLowerCase();
    if (lower.includes('.pptx') || lower.includes('/pptx/')) {
      exportFormat = 'pptx';
    } else if (lower.includes('.pdf') || lower.includes('/pdf/')) {
      exportFormat = 'pdf';
    }
  }

  if (status === 'ready' && !exportUrl) {
    const exports = gammaData.exports as Array<Record<string, unknown>> | undefined;
    if (Array.isArray(exports) && exports.length > 0) {
      const firstExport = exports[0];
      if (firstExport.url && typeof firstExport.url === 'string') {
        exportUrl = firstExport.url;
      }
      const format = (firstExport.format as string) || (firstExport.type as string) || '';
      if (format.includes('pptx')) {
        exportFormat = 'pptx';
      } else if (format.includes('pdf')) {
        exportFormat = 'pdf';
      }
    }
  }

  // title
  let title: string | null = null;
  if (typeof gammaData.title === 'string' && gammaData.title) {
    title = gammaData.title;
  } else if (typeof gammaData.name === 'string' && gammaData.name) {
    title = gammaData.name;
  }

  // error
  let error: PreviewInfo['error'] = null;
  if (status === 'failed') {
    const msg = (gammaData.error as string)
      || (gammaData.message as string)
      || '生成失败';
    error = {
      code: 'GENERATION_FAILED' as PreviewErrorCode,
      message: msg,
      fallbackAction: 'download_pptx',
    };
  }

  return {
    generationId,
    status,
    gammaUrl,
    exportUrl,
    exportFormat,
    title,
    embedAllowed: false,
    embedNote: 'Gamma X-Frame-Options: SAMEORIGIN，不允许嵌入',
    error,
  };
}
