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

  it('treats mode=smart as auto workflow for legacy callers', () => {
    const normalized = normalizeUserInput({
      topic: '北京旅游完全指南',
      mode: 'smart',
      imageSource: 'smart',
    });

    expect(normalized.mode).toBe('smart');
    expect(normalized.auto).toBe(true);
    expect(normalized.imageSource).toBe('smart');
  });

  it('maps app image modes to Gamma sources', () => {
    expect(buildGammaImageOptions('theme-img', 'consultant').source).toBe('themeAccent');
    expect(buildGammaImageOptions('theme-img', 'founder').source).toBe('themeAccent');
    expect(buildGammaImageOptions('themeAccent', 'consultant').source).toBe('themeAccent');
    expect(buildGammaImageOptions('weballimages', 'consultant').source).toBe('pexels');
    expect(buildGammaImageOptions('webfreetouse', 'consultant').source).toBe('pexels');
    expect(buildGammaImageOptions('noImages', 'consultant').source).toBe('noImages');
    expect(buildGammaImageOptions('ai-pro', 'consultant')).toMatchObject({
      source: 'aiGenerated',
      model: 'imagen-3-pro',
    });
  });

  it('keeps explicit imageSource priority over stale imageOptions.source', () => {
    const options = buildGammaImageOptions('pexels', 'consultant', {
      source: 'themeAccent',
    });
    expect(options.source).toBe('pexels');
  });

  it('strips stale ai model/style fields when source is not aiGenerated', () => {
    const options = buildGammaImageOptions('theme-img', 'consultant', {
      source: 'aiGenerated',
      model: 'imagen-3-pro',
      style: 'cinematic',
      prompt: 'custom prompt',
    });
    expect(options.source).toBe('themeAccent');
    expect(options).not.toHaveProperty('model');
    expect(options).not.toHaveProperty('style');
    expect(options).not.toHaveProperty('prompt');
  });

  it('never silently changes an explicit image source', () => {
    expect(buildGammaImageOptions('theme-img').source).toBe('themeAccent');
    expect(buildGammaImageOptions('web').source).toBe('pexels');
    expect(buildGammaImageOptions('noImages').source).toBe('noImages');
    expect(buildGammaImageOptions('ai').source).toBe('aiGenerated');
  });
});
