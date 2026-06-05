/**
 * Theme Tokens — Unified API for all theme colors
 * All components MUST use this API; no hardcoded colors allowed
 */

import { getThemeById, THEME_DATABASE, type ThemeData } from '../theme-database'
import { inferPalette } from './palette-generator'
import { isDark, getContrastText } from './color-utils'

// Re-export ThemeData for consumers
export type { ThemeData } from '../theme-database'

export interface ThemeToken {
  // Core 3 colors
  primary: string       // colors[0] — main brand color
  accent: string         // colors[1] — secondary/emphasis color
  background: string     // colors[2] — background/tertiary color

  // Chart palette (5-8 colors)
  chartColors: string[]

  // Text colors
  textDark: string
  textLight: string
  textMuted: string

  // Borders and dividers
  border: string
  divider: string

  // Gradient (optional)
  gradient?: { from: string; to: string; angle: number }

  // Status colors (fixed, not theme-dependent)
  success: string
  warning: string
  error: string

  // Metadata
  isDark: boolean
  isDeprecated: boolean
  replacedBy?: string

  // Full theme data
  theme: ThemeData
}

/**
 * Get all theme tokens for a given theme ID.
 * This is the primary API for accessing theme colors.
 *
 * @example
 * const tokens = getThemeTokens('consultant')
 * <div style={{ background: tokens.primary }} />
 */
export function getThemeTokens(themeId: string): ThemeToken {
  const theme = getThemeById(themeId)

  if (!theme) {
    // Fallback to default light theme
    const fallback = getThemeById('default-light')
    if (!fallback) {
      throw new Error(`Theme not found: ${themeId} and no fallback available`)
    }
    return buildTokens(fallback)
  }

  return buildTokens(theme)
}

/**
 * Build tokens from a theme, inferring missing fields
 */
function buildTokens(theme: ThemeData): ThemeToken {
  const [primary, accent, background] = theme.colors

  // Build palette (from theme or infer from primary)
  const chartColors = theme.palette || inferPalette([primary, accent, background])

  // Determine dark mode
  const dark = isDark(primary)

  // Background: if primary is dark, bg should be light
  const resolvedBg = background || (dark ? '#FFFFFF' : '#1F2937')

  // Text colors
  const textDark = dark ? '#FFFFFF' : '#1F2937'
  const textLight = dark ? '#1F2937' : '#FFFFFF'
  const textMuted = dark ? '#9CA3AF' : '#6B7280'

  // Border/divider
  const border = dark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)'
  const divider = dark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)'

  return {
    primary,
    accent,
    background: resolvedBg,
    chartColors,
    textDark,
    textLight,
    textMuted,
    border,
    divider,
    gradient: theme.gradient,
    success: '#10B981',
    warning: '#F59E0B',
    error: '#EF4444',
    isDark: dark,
    isDeprecated: theme.isDeprecated ?? false,
    replacedBy: theme.replacedBy,
    theme,
  }
}

/**
 * Get all active (non-deprecated) themes
 */
export function getActiveThemes(): ThemeData[] {
  return THEME_DATABASE.filter(t => !(t.isDeprecated))
}

/**
 * Get theme by ID (passthrough from theme-database)
 */
export { getThemeById } from '../theme-database'

/**
 * Inject theme tokens as CSS variables on :root
 */
export function injectThemeVars(themeId: string): void {
  const tokens = getThemeTokens(themeId)
  const root = document.documentElement

  root.style.setProperty('--color-primary', tokens.primary)
  root.style.setProperty('--color-accent', tokens.accent)
  root.style.setProperty('--color-background', tokens.background)
  root.style.setProperty('--color-chart-1', tokens.chartColors[0] || tokens.primary)
  root.style.setProperty('--color-chart-2', tokens.chartColors[1] || tokens.accent)
  root.style.setProperty('--color-chart-3', tokens.chartColors[2] || '#888888')
  root.style.setProperty('--color-chart-4', tokens.chartColors[3] || '#888888')
  root.style.setProperty('--color-chart-5', tokens.chartColors[4] || '#888888')
  root.style.setProperty('--color-text-dark', tokens.textDark)
  root.style.setProperty('--color-text-light', tokens.textLight)
  root.style.setProperty('--color-text-muted', tokens.textMuted)
  root.style.setProperty('--color-border', tokens.border)
  root.style.setProperty('--color-divider', tokens.divider)
  root.style.setProperty('--color-success', tokens.success)
  root.style.setProperty('--color-warning', tokens.warning)
  root.style.setProperty('--color-error', tokens.error)
}
