import { describe, expect, it } from 'vitest';
import { buildGammaImageOptions, normalizeUserInput } from '@/lib/adapters/ppt-param-adapter';

describe('ppt-param-adapter', () => {
  it('keeps canonical aliases from being overwritten by raw fields', () => {
    const normalized = normalizeUserInput({
      inputText: '主题',
      slideCount: 12,
      numCards: 8,
      imageMode: 'web',
      directImgMode: 'theme-img',
    });

    expect(normalized.topic).toBe('主题');
    expect(normalized.inputText).toBe('主题');
    expect(normalized.pageCount).toBe(12);
    expect(normalized.imageSource).toBe('web');
  });

  it('maps app image modes to Gamma sources and avoids themeAccent on dark themes', () => {
    expect(buildGammaImageOptions('theme-img', 'consultant').source).toBe('themeAccent');
    expect(buildGammaImageOptions('theme-img', 'founder').source).toBe('webFreeToUseCommercially');
    expect(buildGammaImageOptions('weballimages', 'consultant').source).toBe('webFreeToUseCommercially');
    expect(buildGammaImageOptions('webfreetouse', 'consultant').source).toBe('webFreeToUseCommercially');
    expect(buildGammaImageOptions('ai-pro', 'consultant')).toMatchObject({
      source: 'aiGenerated',
      model: 'imagen-3-pro',
    });
  });
});
