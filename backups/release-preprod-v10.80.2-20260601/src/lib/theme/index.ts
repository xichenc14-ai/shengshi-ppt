/**
 * Theme System — Public API
 *
 * Usage:
 *   import { getThemeTokens, getActiveThemes } from '@/lib/theme'
 *   const tokens = getThemeTokens('consultant')
 */

// Unified token API (primary interface)
export { getThemeTokens, getActiveThemes, injectThemeVars } from './getThemeTokens'
export type { ThemeToken } from './getThemeTokens'

// Color utilities
export {
  hexToRgb, rgbToHex, hexToHsl, hslToHex,
  isDark, getLuminance, getComplementary, getAnalogous,
  shiftHue, adjustLightness, adjustSaturation,
  getBackgroundColor, getContrastText,
} from './color-utils'

// Palette generation
export {
  generateChartPalette, generateHarmoniousPalette,
  generateDarkPalette, generateGradientPalette,
  inferPalette, buildPaletteFromTheme,
} from './palette-generator'

// Brand color extraction
export { extractBrandColors, extractBrandColorsFast } from './color-extraction'

// Re-export ThemeData type
export type { ThemeData } from '../theme-database'
export { THEME_DATABASE, COLOR_CATEGORIES, getThemesByCategory, getThemeById, recommendTheme } from '../theme-database'
