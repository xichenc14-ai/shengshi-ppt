import { describe, expect, it } from 'vitest';
import { resolveSmartThemeId } from '@/lib/smart-theme-matcher';

describe('resolveSmartThemeId', () => {
  it('matches blue business requests to the business blue theme', () => {
    const match = resolveSmartThemeId({
      text: '做一份城市发展介绍，蓝色主题，专业汇报',
      scene: '商务汇报',
      tone: 'professional',
    });

    expect(match?.themeId).toBe('consultant');
    expect(match?.locked).toBe(true);
  });

  it('matches blue education requests to a lighter education-oriented blue', () => {
    const match = resolveSmartThemeId({
      text: '澎湃中学校园介绍，蓝色系，轻松活泼',
      scene: '培训课件',
      tone: 'casual',
    });

    expect(match?.themeId).toBe('cornflower');
    expect(match?.locked).toBe(true);
  });

  it('uses scene and style when no explicit color is supplied', () => {
    const match = resolveSmartThemeId({
      text: '咖啡文化指南，温暖生活方式',
      scene: '餐饮美食',
      tone: 'casual',
    });

    expect(match?.themeId).toBe('finesse');
    expect(match?.locked).toBe(false);
  });

  it('does not drift to white minimal themes without explicit white intent', () => {
    const match = resolveSmartThemeId({
      text: '城市发展季度汇报，强调专业可信和数据表达',
      scene: '商务汇报',
      tone: 'professional',
    });

    expect(['howlite', 'default-light', 'gleam']).not.toContain(match?.themeId);
    expect(match?.themeId).toBe('consultant');
  });

  it('matches romantic content to a non-white emotional theme', () => {
    const match = resolveSmartThemeId({
      text: '遇见你，相知相守的浪漫故事分享',
      scene: '婚礼庆典',
      tone: 'casual',
    });

    expect(match?.themeId).toBe('coral-glow');
    expect(['howlite', 'default-light', 'gleam']).not.toContain(match?.themeId);
  });
});
