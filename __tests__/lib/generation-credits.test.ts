import { describe, expect, it } from 'vitest';

import { estimateGenerationCredits } from '@/lib/generation-credits';

describe('generation credit rates', () => {
  it('keeps the base rate at 4 credits per page', () => {
    expect(estimateGenerationCredits({ numPages: 8 }).totalCredits).toBe(32);
  });

  it('keeps standard AI images at 4 credits each', () => {
    const result = estimateGenerationCredits({
      numPages: 4,
      imageSource: 'aiGenerated',
      imageModel: 'imagen-3-flash',
      estimatedImages: 2,
    });
    expect(result.baseCredits).toBe(16);
    expect(result.imageCreditsPerImage).toBe(4);
    expect(result.imageCredits).toBe(8);
  });

  it('keeps premium AI images at 14 credits each', () => {
    const result = estimateGenerationCredits({
      numPages: 4,
      imageSource: 'aiGenerated',
      imageModel: 'imagen-3-pro',
      estimatedImages: 2,
    });
    expect(result.imageCreditsPerImage).toBe(14);
    expect(result.imageCredits).toBe(28);
  });
});
