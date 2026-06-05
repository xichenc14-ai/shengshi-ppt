import { describe, it, expect } from 'vitest';
import {
  THEME_DATABASE,
  COLOR_CATEGORIES,
  UNMATCHED_THEMES,
  FIXED_CATEGORY_THEME_IDS,
  RECOMMENDED_THEME_IDS,
  getThemeById,
  getRecommendedThemes,
  getThemesByCategory,
  recommendTheme,
  getThemeCategoryByBackground,
} from '@/lib/theme-database';
import { getAllGammaThemes } from '@/lib/gamma-theme-mapping';

describe('THEME_DATABASE', () => {
  it('should be a non-empty array', () => {
    expect(Array.isArray(THEME_DATABASE)).toBe(true);
    expect(THEME_DATABASE.length).toBeGreaterThan(0);
  });

  it('every theme should have required fields', () => {
    const required = ['id', 'name', 'nameZh', 'colors', 'category', 'categoryZh', 'emoji', 'style', 'scenes'];
    for (const theme of THEME_DATABASE) {
      for (const field of required) {
        expect(theme, `theme ${theme.id} missing ${field}`).toHaveProperty(field);
      }
    }
  });

  it('every theme should have at least 1 color', () => {
    for (const theme of THEME_DATABASE) {
      expect(theme.colors.length, `theme ${theme.id} has no colors`).toBeGreaterThanOrEqual(1);
    }
  });

  it('should have no duplicate ids', () => {
    const ids = THEME_DATABASE.map(t => t.id);
    const unique = new Set(ids);
    expect(unique.size).toBe(ids.length);
  });

  it('should exclude deprecated or unavailable gamma theme ids', () => {
    const ids = new Set(THEME_DATABASE.map((t) => t.id));
    expect(ids.has('icebreaker')).toBe(false);
    expect(ids.has('festival')).toBe(false);
    expect(ids.has('lunar-new-year')).toBe(false);
    expect(ids.has('luxe')).toBe(false);
  });

  it('should only contain themes that Gamma API currently supports', () => {
    const gammaIds = new Set(getAllGammaThemes());
    for (const theme of THEME_DATABASE) {
      expect(gammaIds.has(theme.id), `theme ${theme.id} is not in Gamma /themes`).toBe(true);
    }
  });

  it('all themeIds should be valid non-empty strings', () => {
    for (const theme of THEME_DATABASE) {
      expect(typeof theme.id).toBe('string');
      expect(theme.id.length).toBeGreaterThan(0);
      expect(theme.id).not.toContain(' ');
    }
  });

  it('every theme should have valid category', () => {
    const validCategories = ['blue', 'orangeBrown', 'yellowCream', 'green', 'whiteGray', 'black', 'purplePink'];
    for (const theme of THEME_DATABASE) {
      expect(validCategories, `theme ${theme.id} has invalid category ${theme.category}`).toContain(theme.category);
    }
  });

  it('each theme should only appear once across color families', () => {
    const allIds = Object.values(FIXED_CATEGORY_THEME_IDS).flat();
    expect(new Set(allIds).size).toBe(allIds.length);
  });

  it('each color family should have at most 10 themes', () => {
    for (const [family, ids] of Object.entries(FIXED_CATEGORY_THEME_IDS)) {
      expect(ids.length, `family ${family} has more than 10 themes`).toBeLessThanOrEqual(10);
    }
  });

  it('should not have unmatched themes with current gamma theme set', () => {
    expect(UNMATCHED_THEMES).toEqual([]);
  });
});

describe('COLOR_CATEGORIES', () => {
  it('should be a non-empty array', () => {
    expect(COLOR_CATEGORIES.length).toBeGreaterThan(0);
  });

  it('should have unique ids', () => {
    const ids = COLOR_CATEGORIES.map(c => c.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('should follow fixed category order', () => {
    expect(COLOR_CATEGORIES.map((c) => c.id)).toEqual([
      'blue',
      'orangeBrown',
      'yellowCream',
      'green',
      'whiteGray',
      'black',
      'purplePink',
    ]);
  });
});

describe('getThemeById', () => {
  it('should return a theme for a valid id', () => {
    const theme = getThemeById('consultant');
    expect(theme).toBeDefined();
    expect(theme!.id).toBe('consultant');
  });

  it('should return undefined for an invalid id', () => {
    expect(getThemeById('nonexistent')).toBeUndefined();
  });

  it('should use canonical theme names that match current Gamma positioning', () => {
    expect(getThemeById('cigar')?.nameZh).toBe('深棕雪茄');
  });
});

describe('getThemesByCategory', () => {
  it('should return themes for a valid category', () => {
    const blueThemes = getThemesByCategory('blue');
    expect(blueThemes.length).toBeGreaterThan(0);
    blueThemes.forEach(t => expect(t.category).toBe('blue'));
  });

  it('should return empty array for invalid category', () => {
    expect(getThemesByCategory('nonexistent')).toEqual([]);
  });
});

describe('getThemeCategoryByBackground', () => {
  it('should classify dark chromatic colors by hue, not by darkness', () => {
    expect(getThemeCategoryByBackground('#052E16')).toBe('green'); // 深绿
    expect(getThemeCategoryByBackground('#451A03')).toBe('orangeBrown'); // 深棕
    expect(getThemeCategoryByBackground('#1E3A5F')).toBe('blue'); // 深蓝
  });

  it('should classify neutral backgrounds into black/white only', () => {
    expect(getThemeCategoryByBackground('#111827')).toBe('black');
    expect(getThemeCategoryByBackground('#E5E7EB')).toBe('whiteGray');
  });

  it('should keep purple-magenta backgrounds out of blue category', () => {
    expect(getThemeCategoryByBackground('#7C3AED')).toBe('purplePink');
  });
});

describe('recommendTheme', () => {
  it('should return a theme for a known scene', () => {
    const theme = recommendTheme('商务汇报');
    expect(theme).toBeDefined();
    expect(theme!.scenes).toContain('商务汇报');
  });

  it('should fallback to first theme for unknown scene', () => {
    const theme = recommendTheme('完全不存在的场景');
    expect(theme).toBeDefined();
    expect(theme!.id).toBe(THEME_DATABASE[0].id);
  });
});

describe('recommended theme metadata', () => {
  it('should keep recommended theme ids aligned to the shared theme database', () => {
    expect(RECOMMENDED_THEME_IDS).toContain('howlite');
    expect(RECOMMENDED_THEME_IDS).not.toContain('default-light');
    expect(getRecommendedThemes().map((theme) => theme.id)).toEqual(Array.from(RECOMMENDED_THEME_IDS));
  });
});
