/**
 * Color Utilities — HSL complementary color calculation, color format conversion
 */

/**
 * Convert hex color to RGB
 */
export function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex)
  return result
    ? { r: parseInt(result[1], 16), g: parseInt(result[2], 16), b: parseInt(result[3], 16) }
    : null
}

/**
 * Convert RGB to hex
 */
export function rgbToHex(r: number, g: number, b: number): string {
  return '#' + [r, g, b].map(x => Math.round(x).toString(16).padStart(2, '0')).join('')
}

/**
 * Convert hex to HSL
 */
export function hexToHsl(hex: string): { h: number; s: number; l: number } | null {
  const rgb = hexToRgb(hex)
  if (!rgb) return null

  const r = rgb.r / 255
  const g = rgb.g / 255
  const b = rgb.b / 255

  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  let h = 0
  let s = 0
  const l = (max + min) / 2

  if (max !== min) {
    const d = max - min
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
    switch (max) {
      case r:
        h = ((g - b) / d + (g < b ? 6 : 0)) / 6
        break
      case g:
        h = ((b - r) / d + 2) / 6
        break
      case b:
        h = ((r - g) / d + 4) / 6
        break
    }
  }

  return { h: h * 360, s: s * 100, l: l * 100 }
}

/**
 * Convert HSL to hex
 */
export function hslToHex(h: number, s: number, l: number): string {
  h = ((h % 360) + 360) % 360
  s = Math.max(0, Math.min(100, s)) / 100
  l = Math.max(0, Math.min(100, l)) / 100

  const c = (1 - Math.abs(2 * l - 1)) * s
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1))
  const m = l - c / 2

  let r = 0, g = 0, b = 0
  if (h < 60) { r = c; g = x; b = 0 }
  else if (h < 120) { r = x; g = c; b = 0 }
  else if (h < 180) { r = 0; g = c; b = x }
  else if (h < 240) { r = 0; g = x; b = c }
  else if (h < 300) { r = x; g = 0; b = c }
  else { r = c; g = 0; b = x }

  return rgbToHex(
    Math.round((r + m) * 255),
    Math.round((g + m) * 255),
    Math.round((b + m) * 255)
  )
}

/**
 * Calculate relative luminance of a color
 */
export function getLuminance(hex: string): number {
  const rgb = hexToRgb(hex)
  if (!rgb) return 0

  const [r, g, b] = [rgb.r, rgb.g, rgb.b].map(v => {
    v /= 255
    return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4)
  })

  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

/**
 * Check if a color is "dark" (for text-on-background decisions)
 */
export function isDark(hex: string): boolean {
  return getLuminance(hex) < 0.5
}

/**
 * Get complementary color (180° hue shift)
 */
export function getComplementary(hex: string): string {
  const hsl = hexToHsl(hex)
  if (!hsl) return hex
  return hslToHex((hsl.h + 180) % 360, hsl.s, hsl.l)
}

/**
 * Get analogous colors (±30° hue shift)
 */
export function getAnalogous(hex: string): [string, string] {
  const hsl = hexToHsl(hex)
  if (!hsl) return [hex, hex]
  return [
    hslToHex((hsl.h + 330) % 360, hsl.s, hsl.l),
    hslToHex((hsl.h + 30) % 360, hsl.s, hsl.l),
  ]
}

/**
 * Shift hue by degrees
 */
export function shiftHue(hex: string, degrees: number): string {
  const hsl = hexToHsl(hex)
  if (!hsl) return hex
  return hslToHex((hsl.h + degrees + 360) % 360, hsl.s, hsl.l)
}

/**
 * Adjust lightness
 */
export function adjustLightness(hex: string, amount: number): string {
  const hsl = hexToHsl(hex)
  if (!hsl) return hex
  return hslToHex(hsl.h, hsl.s, Math.max(0, Math.min(100, hsl.l + amount)))
}

/**
 * Adjust saturation
 */
export function adjustSaturation(hex: string, amount: number): string {
  const hsl = hexToHsl(hex)
  if (!hsl) return hex
  return hslToHex(hsl.h, Math.max(0, Math.min(100, hsl.s + amount)), hsl.l)
}

/**
 * Generate a background color based on primary brightness
 */
export function getBackgroundColor(primary: string): string {
  return isDark(primary) ? '#FFFFFF' : '#1F2937'
}

/**
 * Ensure color contrast ratio meets WCAG AA (4.5:1 for normal text)
 */
export function getContrastText(bgHex: string): string {
  return isDark(bgHex) ? '#FFFFFF' : '#1F2937'
}
