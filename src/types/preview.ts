/**
 * PreviewInfo - D4 canonical type
 * 用于 /api/preview 返回规范化预览信息
 */

export type PreviewStatus =
  | 'pending'
  | 'loading'
  | 'ready'
  | 'partial'
  | 'failed';

export type PreviewErrorCode =
  | 'MISSING_ID'
  | 'GENERATION_PENDING'
  | 'GENERATION_FAILED'
  | 'EXPORT_TIMEOUT'
  | 'EXPORT_FAILED'
  | 'PDF_NOT_AVAILABLE'
  | 'GAMMA_URL_NOT_AVAILABLE';

export interface PreviewError {
  code: PreviewErrorCode;
  message: string;
  fallbackAction?: 'download_pptx' | 'download_pdf' | 'open_external';
}

export interface PreviewInfo {
  generationId: string;
  status: PreviewStatus;
  gammaUrl: string | null;
  exportUrl: string | null;
  exportFormat: 'pptx' | 'pdf' | 'unknown';
  title: string | null;
  embedAllowed: boolean;
  embedNote: string | null;
  error: PreviewError | null;
}
