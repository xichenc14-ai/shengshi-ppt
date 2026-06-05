/**
 * BrandColorImport — K-means brand color extraction from logo images
 * Generates recommended themes based on extracted colors
 */

import React, { useState, useRef } from 'react'
import Image from 'next/image'
import { extractBrandColors } from '../../lib/theme/color-extraction'
import { getComplementary, getBackgroundColor } from '../../lib/theme/color-utils'
import { buildPaletteFromTheme } from '../../lib/theme/palette-generator'

interface BrandColorImportProps {
  onApply?: (theme: {
    primary: string
    accent: string
    background: string
    palette: string[]
  }) => void
}

export const BrandColorImport: React.FC<BrandColorImportProps> = ({ onApply }) => {
  const [imageUrl, setImageUrl] = useState<string>('')
  const [extractedColors, setExtractedColors] = useState<string[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [recommendedThemes, setRecommendedThemes] = useState<Array<{
    primary: string
    accent: string
    background: string
    palette: string[]
  }>>([])
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleExtract = async () => {
    if (!imageUrl.trim()) return
    setLoading(true)
    setError(null)

    try {
      const colors = await extractBrandColors(imageUrl, 3)
      setExtractedColors(colors)

      // Generate 3 recommended themes
      const primary = colors[0]
      const accent = getComplementary(primary)
      const background = getBackgroundColor(primary)
      const palette = buildPaletteFromTheme(primary, accent, background)

      // Build 3 variations
      const themes = [
        // Theme 1: Default
        { primary, accent, background, palette },
        // Theme 2: Softer accent
        { primary, accent: colors[1] || accent, background, palette },
        // Theme 3: Light background variant
        { primary, accent, background: '#FFFFFF', palette },
      ]

      setRecommendedThemes(themes)
    } catch (err) {
      setError(err instanceof Error ? err.message : '提取颜色失败')
    } finally {
      setLoading(false)
    }
  }

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = async (ev) => {
      const dataUrl = ev.target?.result as string
      setImageUrl(dataUrl)
    }
    reader.readAsDataURL(file)
  }

  const handleApply = (theme: typeof recommendedThemes[0]) => {
    onApply?.(theme)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <label style={{ fontSize: 13, fontWeight: 500, color: '#374151' }}>上传 Logo 图片</label>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleFileUpload}
            style={{ fontSize: 13 }}
          />
          <button
            onClick={handleExtract}
            disabled={!imageUrl || loading}
            style={{
              padding: '6px 16px',
              background: loading ? '#9CA3AF' : '#2563EB',
              color: '#FFF',
              border: 'none',
              borderRadius: 6,
              fontSize: 13,
              cursor: loading ? 'not-allowed' : 'pointer',
            }}
          >
            {loading ? '提取中...' : '提取颜色'}
          </button>
        </div>
        {imageUrl && (
          <Image
            src={imageUrl}
            alt="Preview"
            width={200}
            height={100}
            unoptimized
            style={{ maxWidth: 200, maxHeight: 100, borderRadius: 8, objectFit: 'contain' }}
          />
        )}
      </div>

      {error && (
        <div style={{ color: '#EF4444', fontSize: 13 }}>{error}</div>
      )}

      {extractedColors.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <label style={{ fontSize: 13, fontWeight: 500, color: '#374151' }}>
            提取到 {extractedColors.length} 个主色
          </label>
          <div style={{ display: 'flex', gap: 8 }}>
            {extractedColors.map((color, i) => (
              <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                <div
                  style={{
                    width: 48,
                    height: 48,
                    borderRadius: 8,
                    backgroundColor: color,
                    border: '1px solid rgba(0,0,0,0.08)',
                  }}
                />
                <span style={{ fontSize: 10, fontFamily: 'monospace', color: '#6B7280' }}>{color}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {recommendedThemes.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <label style={{ fontSize: 13, fontWeight: 500, color: '#374151' }}>
            推荐主题（点击应用）
          </label>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {recommendedThemes.map((theme, i) => (
              <div
                key={i}
                onClick={() => handleApply(theme)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 16,
                  padding: 12,
                  border: '1px solid rgba(0,0,0,0.08)',
                  borderRadius: 8,
                  cursor: 'pointer',
                  background: '#FAFAFA',
                }}
              >
                <div style={{ display: 'flex', gap: 6 }}>
                  {[theme.primary, theme.accent, theme.background].map((color, j) => (
                    <div
                      key={j}
                      style={{
                        width: 32,
                        height: 32,
                        borderRadius: 6,
                        backgroundColor: color,
                        border: '1px solid rgba(0,0,0,0.06)',
                      }}
                    />
                  ))}
                </div>
                <div style={{ fontSize: 13, color: '#374151' }}>主题 {i + 1}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

export default BrandColorImport
