import { describe, expect, it } from 'vitest';
import { extractPreviewFromGamma } from '@/lib/adapters/preview-adapter';

describe('preview-adapter', () => {
  it('extracts Gamma canonical urls returned by generation status', () => {
    const preview = extractPreviewFromGamma({
      generationId: 'gen-1',
      status: 'completed',
      gammaUrl: 'https://gamma.app/docs/gen-1',
      exportUrl: 'https://assets.api.gamma.app/export/pptx/gen-1/file.pptx',
      title: '测试PPT',
    });

    expect(preview.status).toBe('ready');
    expect(preview.gammaUrl).toBe('https://gamma.app/docs/gen-1');
    expect(preview.exportUrl).toBe('https://assets.api.gamma.app/export/pptx/gen-1/file.pptx');
    expect(preview.exportFormat).toBe('pptx');
  });
});
