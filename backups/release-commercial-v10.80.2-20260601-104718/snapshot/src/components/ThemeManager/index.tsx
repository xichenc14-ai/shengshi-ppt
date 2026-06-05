/**
 * ThemeManager — Entry point
 *
 * Provides theme management components:
 * - ThemePalette: Display a theme's color palette
 * - BrandColorImport: Extract brand colors from logo images
 * - GradientPicker: Select background gradients
 *
 * Also re-exports the core theme API from lib/theme
 */

export { ThemePalette } from './ThemePalette'
export { BrandColorImport } from './BrandColorImport'
export { GradientPicker } from './GradientPicker'

// Re-export theme API
export {
  getThemeTokens,
  getActiveThemes,
  injectThemeVars,
} from '../../lib/theme/getThemeTokens'

export type { ThemeToken } from '../../lib/theme/getThemeTokens'

export {
  extractBrandColors,
  extractBrandColorsFast,
} from '../../lib/theme/color-extraction'

export {
  generateChartPalette,
  generateHarmoniousPalette,
  buildPaletteFromTheme,
} from '../../lib/theme/palette-generator'

export {
  getComplementary,
  getContrastText,
  isDark,
  hexToHsl,
  hslToHex,
} from '../../lib/theme/color-utils'
