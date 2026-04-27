import { describe, it, expect } from 'vitest';
import {
  THEME_DATABASE,
  COLOR_CATEGORIES,
  getThemeById,
  getThemesByCategory,
  recommendTheme,
} from '@/lib/theme-database';

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

  it('all themeIds should be valid non-empty strings', () => {
    for (const theme of THEME_DATABASE) {
      expect(typeof theme.id).toBe('string');
      expect(theme.id.length).toBeGreaterThan(0);
      expect(theme.id).not.toContain(' ');
    }
  });

  it('every theme should have valid category', () => {
    const validCategories = ['blue', 'gray', 'purple', 'brown', 'pink', 'warm', 'gold'];
    for (const theme of THEME_DATABASE) {
      expect(validCategories, `theme ${theme.id} has invalid category ${theme.category}`).toContain(theme.category);
    }
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
