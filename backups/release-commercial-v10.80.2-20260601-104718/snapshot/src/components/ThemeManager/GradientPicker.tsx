/**
 * GradientPicker — Linear gradient selector for PPT backgrounds
 */

import React, { useState } from 'react'

interface GradientPickerProps {
  primaryColor: string
  onChange?: (gradient: { from: string; to: string; angle: number }) => void
}

const PRESET_GRADIENTS: Array<{ from: string; to: string; label: string }> = [
  { from: '#2563EB', to: '#7C3AED', label: '蓝紫渐变' },
  { from: '#F97316', to: '#EC4899', label: '橙粉渐变' },
  { from: '#1F2937', to: '#111827', label: '深灰渐变' },
  { from: '#7C3AED', to: '#06B6D4', label: '紫青渐变' },
  { from: '#F59E0B', to: '#EF4444', label: '金红渐变' },
  { from: '#10B981', to: '#06B6D4', label: '绿青渐变' },
]

const ANGLES = [0, 45, 90, 135, 180, 225, 270, 315]

export const GradientPicker: React.FC<GradientPickerProps> = ({ primaryColor, onChange }) => {
  const [gradient, setGradient] = useState<{ from: string; to: string; angle: number }>({
    from: primaryColor,
    to: primaryColor,
    angle: 135,
  })

  const handleChange = (updates: Partial<typeof gradient>) => {
    const next = { ...gradient, ...updates }
    setGradient(next)
    onChange?.(next)
  }

  const gradientStyle = {
    background: `linear-gradient(${gradient.angle}deg, ${gradient.from}, ${gradient.to})`,
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Preview */}
      <div
        style={{
          ...gradientStyle,
          height: 80,
          borderRadius: 12,
          border: '1px solid rgba(0,0,0,0.08)',
        }}
      />

      {/* Preset gradients */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <label style={{ fontSize: 12, color: '#6B7280' }}>预设渐变</label>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {PRESET_GRADIENTS.map((g, i) => (
            <button
              key={i}
              onClick={() => handleChange({ from: g.from, to: g.to })}
              style={{
                width: 48,
                height: 32,
                borderRadius: 6,
                background: `linear-gradient(135deg, ${g.from}, ${g.to})`,
                border: '1px solid rgba(0,0,0,0.08)',
                cursor: 'pointer',
                padding: 0,
              }}
              title={g.label}
            />
          ))}
        </div>
      </div>

      {/* From/To colors */}
      <div style={{ display: 'flex', gap: 12 }}>
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 4 }}>
          <label style={{ fontSize: 12, color: '#6B7280' }}>起始色</label>
          <input
            type="color"
            value={gradient.from}
            onChange={e => handleChange({ from: e.target.value })}
            style={{ width: '100%', height: 36, borderRadius: 6, border: '1px solid rgba(0,0,0,0.08)', cursor: 'pointer' }}
          />
        </div>
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 4 }}>
          <label style={{ fontSize: 12, color: '#6B7280' }}>结束色</label>
          <input
            type="color"
            value={gradient.to}
            onChange={e => handleChange({ to: e.target.value })}
            style={{ width: '100%', height: 36, borderRadius: 6, border: '1px solid rgba(0,0,0,0.08)', cursor: 'pointer' }}
          />
        </div>
      </div>

      {/* Angle selector */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        <label style={{ fontSize: 12, color: '#6B7280' }}>角度</label>
        <div style={{ display: 'flex', gap: 6 }}>
          {ANGLES.map(a => (
            <button
              key={a}
              onClick={() => handleChange({ angle: a })}
              style={{
                width: 36,
                height: 28,
                borderRadius: 4,
                border: gradient.angle === a ? '2px solid #2563EB' : '1px solid rgba(0,0,0,0.1)',
                background: gradient.angle === a ? '#EFF6FF' : 'transparent',
                cursor: 'pointer',
                fontSize: 11,
                color: gradient.angle === a ? '#2563EB' : '#6B7280',
              }}
            >
              {a}°
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

export default GradientPicker
