# P5 执行方案：主题色系管理

**版本:** v1.0
**日期:** 2026-05-16
**负责人:** tech-lead

---

## 1. 目标

建立对标 Gamma 的专业色系系统，支持品牌色、渐变、主题切换，覆盖省心PPT全场景色彩需求。

---

## 2. 对标分析：Gamma 色系系统

### Gamma 色彩特征
| 通道 | 色系 |
|------|------|
| Primary | 靛蓝 + 紫 → 渐变主色 |
| Secondary | 暖橙 + 珊瑚色 |
| Accent | 高饱和青色 |
| Background | 极浅灰 + 纯白 |
| Surface | 半透明白 + 毛玻璃 |
| Text | 近黑 + 深灰 |
| Border | 极浅灰 |

---

## 3. 技术方案

### 3.1 色彩数据模型

```typescript
interface ThemeColor {
  primary: string;       // #6366f1
  primaryGradient: string; // linear-gradient(135deg, #6366f1, #8b5cf6)
  secondary: string;      // #f97316
  accent: string;        // #06b6d4
  background: string;    // #fafafa
  surface: string;       // rgba(255,255,255,0.8)
  text: string;          // #171717
  textMuted: string;     // #525252
  border: string;        // #e5e5e5
  success: string;       // #22c55e
  warning: string;       // #eab308
  danger: string;        // #ef4444
}
```

### 3.2 层级定义

```
Brand Colors (品牌原色)
    ↓
Theme Colors (语义化主题色)
    ↓
Design Tokens (设计令牌)
    ↓
Tailwind CSS Variables (运行时变量)
```

### 3.3 文件结构

```
src/styles/
├── themes/
│   ├── brand-colors.ts      ← 品牌原色定义
│   ├── theme-default.ts     ← 默认主题（对标Gamma亮色）
│   ├── theme-dark.ts       ← 暗色主题
│   ├── theme-brand.ts      ← 品牌定制主题
│   └── index.ts
├── tokens/
│   └── design-tokens.ts     ← 设计令牌（中间层）
└── globals.css             ← CSS变量声明
```

---

## 4. 执行步骤

### Step 1：提取品牌色彩资产
- 从现有素材提取主色
- 定义 5~8 色品牌调色板
- 建立颜色语义映射

### Step 2：设计令牌层
```typescript
// Design Token 示例
const tokens = {
  color: {
    'brand-primary': '#6366f1',
    'brand-secondary': '#f97316',
    // ...
  }
}
```

### Step 3：Tailwind v4 CSS 变量集成
```css
/* globals.css */
@theme {
  --color-brand-primary: #6366f1;
  --color-brand-secondary: #f97316;
  /* ... */
}
```

### Step 4：Gradient 系统
```typescript
const gradients = {
  'brand-hero': 'linear-gradient(135deg, var(--color-brand-primary), var(--color-brand-secondary))',
  'surface-glass': 'linear-gradient(180deg, rgba(255,255,255,0.1), rgba(255,255,255,0.05))',
  // ...
}
```

### Step 5：ThemeData 接口扩展
```typescript
interface ThemeData {
  id: string;
  name: string;
  colors: ThemeColor;
  gradients: Record<string, string>;
  borderRadius: string;
  shadow: string;
}
```

### Step 6：运行时主题切换
- 支持亮色 / 暗色 / 品牌定制三模式
- 存储：localStorage + CSS 变量实时刷新

---

## 5. 优先级排序

| Step | 内容 | 优先级 | 预计工时 |
|------|------|--------|----------|
| 1 | 品牌色彩提取 | P1 | 0.5d |
| 2 | 设计令牌层 | P1 | 0.5d |
| 3 | Tailwind CSS 变量 | P1 | 1d |
| 4 | Gradient 系统 | P2 | 0.5d |
| 5 | ThemeData 接口 | P1 | 0.5d |
| 6 | 主题切换运行时 | P2 | 1d |
| **合计** | | | **3.5d** |

---

## 6. 验收标准

- [ ] 亮色 / 暗色 / 品牌主题三模式可用
- [ ] 渐变色系统完整（≥ 8 种预设渐变）
- [ ] Tailwind CSS 变量全局覆盖，无硬编码颜色
- [ ] ThemeData 接口与现有 ThemeData 向后兼容
- [ ] 主题切换无闪烁（FOUC = 0）
- [ ] 色彩对比度 WCAG AA 通过（文本 / 背景）