import { describe, expect, it } from 'vitest';

import { estimateGenerationCredits } from '@/lib/generation-credits';

describe('generation credit rates', () => {
  it('keeps the base rate at 3 credits per page', () => {
    expect(estimateGenerationCredits({ numPages: 8 }).totalCredits).toBe(24);
  });

  it('keeps standard AI images at 3 credits each', () => {
    const result = estimateGenerationCredits({
      numPages: 4,
      imageSource: 'aiGenerated',
      imageModel: 'imagen-3-flash',
      estimatedImages: 2,
    });
    expect(result.baseCredits).toBe(12);
    expect(result.imageCreditsPerImage).toBe(3);
    expect(result.imageCredits).toBe(6);
  });

  it('keeps premium AI images at 10 credits each', () => {
    const result = estimateGenerationCredits({
      numPages: 4,
      imageSource: 'aiGenerated',
      imageModel: 'imagen-3-pro',
      estimatedImages: 2,
    });
    expect(result.imageCreditsPerImage).toBe(10);
    expect(result.imageCredits).toBe(20);
  });
});
