import { describe, expect, it } from 'vitest';
import {
  getArtifactExtension,
  getArtifactMimeType,
  isValidPdfBuffer,
  isValidPngZipBuffer,
  isValidPptxBuffer,
  isValidZipBuffer,
  validateGammaExportBuffer,
} from '@/lib/gamma-export';

describe('Gamma independent export contracts', () => {
  it('uses ZIP as the download container for PNG exports', () => {
    expect(getArtifactExtension('png')).toBe('zip');
    expect(getArtifactMimeType('png')).toBe('application/zip');
  });

  it('validates PDF signatures', () => {
    expect(isValidPdfBuffer(Buffer.from('%PDF-1.7\n'))).toBe(true);
    expect(isValidPdfBuffer(Buffer.from('not-a-pdf'))).toBe(false);
    expect(validateGammaExportBuffer('pdf', Buffer.from('%PDF-1.7\n'))).toBe(true);
  });

  it('validates PPTX package markers and PNG ZIP markers', () => {
    const pptx = Buffer.from('PK\x03\x04 [Content_Types].xml ppt/presentation.xml');
    const pngZip = Buffer.from('PK\x03\x04 slides/01.png');
    expect(isValidZipBuffer(pptx)).toBe(true);
    expect(isValidPptxBuffer(pptx)).toBe(true);
    expect(isValidPngZipBuffer(pngZip)).toBe(true);
    expect(validateGammaExportBuffer('pptx', pptx)).toBe(true);
    expect(validateGammaExportBuffer('png', pngZip)).toBe(true);
  });
});
