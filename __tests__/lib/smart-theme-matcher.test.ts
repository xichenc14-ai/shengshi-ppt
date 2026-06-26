import { describe, expect, it } from 'vitest';
import { resolveSmartThemeId } from '@/lib/smart-theme-matcher';

describe('resolveSmartThemeId', () => {
  it('matches blue business requests to the business blue theme', () => {
    const match = resolveSmartThemeId({
      text: '做一份城市发展介绍，蓝色主题，专业汇报',
      scene: '商务汇报',
      tone: 'professional',
    });

    expect(match?.themeId).toBe('petrol');
    expect(match?.locked).toBe(true);
  });

  it('matches blue education requests to a lighter education-oriented blue', () => {
    const match = resolveSmartThemeId({
      text: '澎湃中学校园介绍，蓝色系，轻松活泼',
      scene: '培训课件',
      tone: 'casual',
    });

    expect(match?.themeId).toBe('icebreaker');
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
    expect(['gold-leaf', 'icebreaker', 'blues', 'pearl', 'blue-steel', 'marine']).toContain(match?.themeId);
  });

  it('uses the curated recommended default when no signal is supplied', () => {
    const match = resolveSmartThemeId({
      text: '帮我整理一份演示文稿',
    });

    expect(match.themeId).toBe('pearl');
    expect(match.locked).toBe(false);
  });

  it('matches travel content by scene and elements', () => {
    const match = resolveSmartThemeId({
      text: '香港五日游攻略，包含城市漫步、景点行程和地道美食',
      tone: 'casual',
    });

    expect(['finesse', 'elysia', 'oasis']).toContain(match.themeId);
    expect(match.themeId).not.toBe('consultant');
  });

  it('matches AI data content to a technology theme', () => {
    const match = resolveSmartThemeId({
      text: '人工智能产品的数据分析与可视化发布报告',
      tone: 'bold',
    });

    expect(['verdigris', 'aurora', 'blue-steel', 'petrol']).toContain(match.themeId);
  });

  it.each([
    ['年度工作复盘与明年规划', ['gold-leaf', 'blues', 'pearl', 'icebreaker', 'marine']],
    ['中学课堂教学课件', ['finesse', 'cornfield', 'zephyr', 'seafoam', 'pearl', 'oatmeal', 'keepsake']],
    ['护肤品牌新品发布方案', ['twilight', 'coral-glow', 'creme', 'peach', 'gamma', 'atmosphere', 'rush']],
    ['医疗健康科普与康复指南', ['seafoam', 'sage', 'tranquil', 'vanilla']],
    ['非遗古镇传统文化介绍', ['kraft', 'marine', 'sage', 'gleam', 'cornfield', 'finesse']],
  ])('classifies content profile: %s', (text, expectedThemes) => {
    const match = resolveSmartThemeId({ text });
    expect(expectedThemes).toContain(match.themeId);
    expect(match.themeId).not.toBe('consultant');
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

  it.each([
    ['国风水墨山水与古诗词赏析', ['kraft', 'marine', 'sage', 'gleam']],
    ['商务风格企业经营汇报', ['gold-leaf', 'icebreaker', 'blues', 'pearl', 'blue-steel', 'marine']],
    ['精美高级作品集展示', ['lux', 'twilight', 'dune', 'finesse', 'vortex', 'gold-leaf', 'creme', 'prism']],
    ['通用教学课件和课堂培训', ['finesse', 'cornfield', 'zephyr', 'seafoam', 'pearl', 'oatmeal', 'keepsake']],
    ['清新可爱的儿童活动分享', ['twilight', 'lavender', 'atmosphere', 'coral-glow', 'peach', 'seafoam', 'daydream']],
  ])('uses refreshed theme profile: %s', (text, expectedThemes) => {
    const match = resolveSmartThemeId({ text });
    expect(expectedThemes).toContain(match.themeId);
  });

  it('prioritizes an explicitly named current theme', () => {
    const match = resolveSmartThemeId({
      text: '请用深海远岚这种墨色山水感觉做一份古风介绍',
    });

    expect(match.themeId).toBe('marine');
    expect(match.themeLabel).toBe('深海远岚');
  });
});
