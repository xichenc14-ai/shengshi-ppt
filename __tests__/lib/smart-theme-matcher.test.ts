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
});
