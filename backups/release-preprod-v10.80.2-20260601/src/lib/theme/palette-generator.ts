/**
 * Palette Generator — Generate chart color palettes from a primary color
 * Creates 5-8 color palettes suitable for multi-series charts
 */

import { hexToHsl, hslToHex, shiftHue, adjustLightness, adjustSaturation } from './color-utils'

/**
 * Generate a 6-color chart palette from a primary color.
 * Colors are distributed around the hue wheel at 30° intervals.
 */
export function generateChartPalette(primary: string, count: number = 6): string[] {
  const hsl = hexToHsl(primary)
  if (!hsl) return [primary]

  const palette: string[] = []
  const baseHue = hsl.h

  for (let i = 0; i < count; i++) {
    const hue = (baseHue + i * (360 / count)) % 360
    // Slightly vary saturation and lightness for visual distinction
    const sat = Math.min(100, Math.max(40, hsl.s + (i % 2 === 0 ? 0 : 10)))
    const lit = Math.min(90, Math.max(35, hsl.l + (i % 3 === 0 ? 5 : i % 3 === 1 ? -5 : 0)))
    palette.push(hslToHex(hue, sat, lit))
  }

  return palette
}

/**
 * Generate a harmonious 5-color palette using analogous + complementary approach
 */
export function generateHarmoniousPalette(primary: string): string[] {
  const hsl = hexToHsl(primary)
  if (!hsl) return [primary]

  return [
    hslToHex((hsl.h + 0) % 360, hsl.s, hsl.l),          // primary
    hslToHex((hsl.h + 60) % 360, hsl.s * 0.9, hsl.l),  // analogous 1
    hslToHex((hsl.h + 180) % 360, hsl.s, hsl.l * 0.9), // complementary
    hslToHex((hsl.h + 240) % 360, hsl.s * 0.85, hsl.l * 1.1), // split comp 1
    hslToHex((hsl.h + 300) % 360, hsl.s * 0.9, hsl.l),  // analogous 2
  ]
}

/**
 * Generate palette for dark backgrounds (colors must be bright enough)
 */
export function generateDarkPalette(primary: string, count: number = 6): string[] {
  const hsl = hexToHsl(primary)
  if (!hsl) return [primary]

  const palette: string[] = []
  for (let i = 0; i < count; i++) {
    const hue = (hsl.h + i * (360 / count)) % 360
    // High saturation, medium-high lightness for dark bg visibility
    const sat = Math.min(100, Math.max(60, hsl.s))
    const lit = Math.min(80, Math.max(50, 60 + (i % 2 === 0 ? 10 : 0)))
    palette.push(hslToHex(hue, sat, lit))
  }

  return palette
}

/**
 * Generate a warm-to-cool gradient palette (for backgrounds or fills)
 */
export function generateGradientPalette(from: string, to: string, steps: number = 5): string[] {
  const fromHsl = hexToHsl(from)
  const toHsl = hexToHsl(to)
  if (!fromHsl || !toHsl) return [from, to]

  const palette: string[] = []
  for (let i = 0; i < steps; i++) {
    const t = i / (steps - 1)
    const h = fromHsl.h + (toHsl.h - fromHsl.h) * t
    const s = fromHsl.s + (toHsl.s - fromHsl.s) * t
    const l = fromHsl.l + (toHsl.l - fromHsl.l) * t
    palette.push(hslToHex(h, s, l))
  }

  return palette
}

/**
 * Auto-generate a palette field for a theme based on its primary color.
 * Used when a theme doesn't have an explicit palette defined.
 */
export function inferPalette(colors: [string, string, string]): string[] {
  const [primary] = colors
  // Generate 6-color palette based on primary
  return generateChartPalette(primary, 6)
}

/**
 * Build a complete palette from a 3-color theme definition
 */
export function buildPaletteFromTheme(primary: string, accent: string, background: string): string[] {
  const primaryPalette = generateChartPalette(primary, 4)
  const accentHsl = hexToHsl(accent)

  // Ensure accent is included and chart palette is 6 colors
  const palette = [...primaryPalette]
  if (!palette.includes(accent)) {
    palette[1] = accent
  }

  // Ensure we have at least 6 colors
  while (palette.length < 6) {
    palette.push(shiftHue(primary, palette.length * 30))
  }

  return palette.slice(0, 8) // max 8 colors
}
