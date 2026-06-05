# P8 执行方案：图片渐变

**版本:** v1.0
**日期:** 2026-05-16
**负责人:** tech-lead

---

## 1. 目标

实现图片渐变蒙版效果，支持 CSS `mask-image` + SVG `mask` 双轨方案，实现专业级图片渐变融合能力。

---

## 2. 技术方案对比

### 2.1 方案 A：CSS mask-image（推荐）

```css
.element {
  -webkit-mask-image: linear-gradient(to right, #000 0%, transparent 100%);
  mask-image: linear-gradient(to right, #000 0%, transparent 100%);
}
```

| 优势 | 劣势 |
|------|------|
| 浏览器原生支持（Chromium 99+） | Safari 支持稍晚 |
| 性能好（GPU 加速） | 需 webkit 前缀 |
| 可叠加多层 | |

### 2.2 方案 B：SVG mask（备选）

```svg
<mask id="gradient-mask">
  <linearGradient id="grad1" x1="0%" y1="0%" x2="100%" y2="0%">
    <stop offset="0%" style="stop-color:black;stop-opacity:1" />
    <stop offset="100%" style="stop-color:black;stop-opacity:0" />
  </linearGradient>
  <rect width="100%" height="100%" fill="url(#grad1)"/>
</mask>
<image href="photo.jpg" mask="url(#gradient-mask)"/>
```

| 优势 | 劣势 |
|------|------|
| 跨浏览器兼容性更好 | 配置复杂 |
| 可复用 SVG 资源 | 性能略差 |

---

## 3. 蒙版类型定义

| 蒙版类型 | 说明 | 参数 |
|----------|------|------|
| `linear-top` | 上→下渐隐 | direction, stop |
| `linear-bottom` | 下→上渐隐 | direction, stop |
| `linear-left` | 左→右渐隐 | direction, stop |
| `linear-right` | 右→左渐隐 | direction, stop |
| `linear-diagonal` | 对角线渐隐 | angle, stop |
| `radial-center` | 中心径向渐隐 | center, radius |
| `radial-corner` | 角落径向渐隐 | corner, radius |
| `vignette` | 暗角效果 | intensity |
| `layer-blur` | 模糊叠加 | blurRadius |
| `color-overlay` | 颜色叠加 | color, opacity |

---

## 4. 文件结构

```
src/components/image-gradient/
├── ImageGradient.tsx         ← 主组件（双轨蒙版）
├── GradientMask.tsx          ← 蒙版渲染逻辑
├── PresetMasks.tsx           ← 预设蒙版库（10种）
├── MaskCanvas.tsx            ← 蒙版预览画布
├── useImageMask.ts           ← Hook：应用蒙版
└── index.ts
```

---

## 5. 执行步骤

### Step 1：ImageGradient 主组件
```typescript
interface ImageGradientProps {
  src: string;
  maskType: MaskType;
  direction?: 'top' | 'bottom' | 'left' | 'right' | 'diagonal';
  angle?: number;           // 对角线用（0-360）
  stopPoints?: number[];   // 渐变停止点 [0, 0.5, 1]
  opacity?: number;
  fallbackMask?: MaskType; // Safari 回退方案
}
```

### Step 2：PresetMasks 预设蒙版库
- 10 种预设蒙版（见上表）
- 支持单选/组合使用

### Step 3：MaskCanvas 蒙版预览画布
- 实时预览蒙版效果
- 支持参数调整
- 导出蒙版为 CSS / SVG 代码

### Step 4：useImageMask Hook
```typescript
function useImageMask() {
  const applyMask = (imageEl: HTMLImageElement, mask: MaskDef) => ...
  const removeMask = (imageEl: HTMLImageElement) => ...
  return { applyMask, removeMask }
}
```

### Step 5：透明度控制系统
```typescript
interface TransparencyControl {
  globalAlpha: number;     // 整体透明度 0-1
  channelAlpha: {
    red: number;           // R通道透明度
    green: number;         // G通道透明度
    blue: number;          // B通道透明度
  }
  maskAlpha: number;       // 蒙版透明度
}
```

### Step 6：跨浏览器兼容性处理
- CSS `@supports` 检测
- 自动降级到 SVG mask（Safari < 16）
- 降级时保留核心功能

---

## 6. 优先级排序

| Step | 内容 | 优先级 | 预计工时 |
|------|------|--------|----------|
| 1 | ImageGradient 主组件 | P1 | 1d |
| 2 | PresetMasks 预设库 | P1 | 0.5d |
| 3 | MaskCanvas 预览画布 | P2 | 1d |
| 4 | useImageMask Hook | P2 | 0.5d |
| 5 | 透明度控制系统 | P2 | 0.5d |
| 6 | 跨浏览器兼容处理 | P1 | 1d |
| **合计** | | | **4.5d** |

---

## 7. 验收标准

- [ ] 10 种预设蒙版可用（linear × 5 + radial × 2 + vignette + blur + overlay）
- [ ] CSS mask-image 主方案在 Chromium 浏览器正常
- [ ] SVG mask 降级方案在 Safari 正常
- [ ] MaskCanvas 可预览并导出蒙版代码
- [ ] 透明度控制各通道独立可调
- [ ] 蒙版与图片无缝融合（无硬边缘）
- [ ] 移动端（iOS Safari 16+）测试通过