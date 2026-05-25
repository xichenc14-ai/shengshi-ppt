/**
 * ThemePalette — Displays a theme's color palette with chart color swatches
 */

import React from 'react'
import { getThemeTokens } from '../../lib/theme/getThemeTokens'

interface ThemePaletteProps {
  themeId: string
  showLabels?: boolean
  size?: 'sm' | 'md' | 'lg'
}

export const ThemePalette: React.FC<ThemePaletteProps> = ({
  themeId,
  showLabels = true,
  size = 'md',
}) => {
  const tokens = getThemeTokens(themeId)

  const swatchSize = { sm: 24, md: 36, lg: 48 }[size]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {/* Core 3 colors */}
      <div style={{ display: 'flex', gap: 8 }}>
        {tokens.theme.colors.map((color, i) => (
          <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
            <div
              style={{
                width: swatchSize,
                height: swatchSize,
                borderRadius: 6,
                backgroundColor: color,
                border: '1px solid rgba(0,0,0,0.06)',
              }}
            />
            {showLabels && (
              <span style={{ fontSize: 10, color: '#6B7280' }}>
                {i === 0 ? '主' : i === 1 ? '强调' : '背景'}
              </span>
            )}
          </div>
        ))}
      </div>

      {/* Chart palette */}
      {tokens.chartColors.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {showLabels && (
            <span style={{ fontSize: 10, color: '#9CA3AF', marginBottom: 2 }}>图表色板</span>
          )}
          <div style={{ display: 'flex', gap: 4 }}>
            {tokens.chartColors.slice(0, 6).map((color, i) => (
              <div
                key={i}
                style={{
                  width: swatchSize,
                  height: swatchSize / 2,
                  borderRadius: 4,
                  backgroundColor: color,
                  border: '1px solid rgba(0,0,0,0.04)',
                }}
                title={color}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

export default ThemePalette
