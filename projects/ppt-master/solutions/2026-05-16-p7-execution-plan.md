# P7 执行方案：组合图形填充

**版本:** v1.0
**日期:** 2026-05-16
**负责人:** tech-lead

---

## 1. 目标

构建 SVG 图案填充库，支持纹理/图案填充，实现更丰富的图形表现力。

---

## 2. 技术方案

### 2.1 SVG Pattern 填充原理
```svg
<defs>
  <pattern id="pattern-dots" width="20" height="20" patternUnits="userSpaceOnUse">
    <circle cx="10" cy="10" r="3" fill="#6366f1"/>
  </pattern>
</defs>
<rect width="100%" height="100%" fill="url(#pattern-dots)"/>
```

### 2.2 图案分类

| 类别 | 图案类型 | 示例 |
|------|----------|------|
| **Dot Patterns** | 点状 | 圆点、方点、菱形点 |
| **Line Patterns** | 线状 | 横线、竖线、斜线、波浪线 |
| **Grid Patterns** | 网格 | 正方网格、六边形网格、三角网格 |
| **Geometric** | 几何 | 星形、箭头、人字纹、锯齿 |
| **Organic** | 有机 | 泡沫、水纹、草地、云朵 |
| **Brand** | 品牌 | Logo 纹理、渐变图案、定制花纹 |

### 2.3 文件结构

```
src/components/pattern-fills/
├── patterns/
│   ├── dots/
│   ├── lines/
│   ├── grids/
│   ├── geometric/
│   ├── organic/
│   └── brand/
├── PatternSVG.tsx          ← 图案渲染组件
├── PatternCanvas.tsx       ← 图案画布（预览）
├── usePatternFill.ts       ← Hook：注册/切换图案
└── index.ts
```

---

## 3. 执行步骤

### Step 1：SVG Pattern 定义文件库
- 每个图案独立 `.svg` 文件或 TypeScript 定义
- 图案参数化（颜色、密度、角度）

### Step 2：PatternSVG 组件
```typescript
interface PatternSVGProps {
  patternId: string;
  fill: string;
  stroke?: string;
  opacity?: number;
  scale?: number;
  angle?: number;
}
```

### Step 3：图案预览画布（PatternCanvas）
- 独立页面展示所有图案
- 支持颜色/密度实时预览
- 导出为 PNG / SVG

### Step 4：usePatternFill Hook
```typescript
function usePatternFill() {
  const registerPattern = (id: string, pattern: PatternDef) => ...
  const applyPattern = (elementId: string, patternId: string) => ...
  return { registerPattern, applyPattern }
}
```

### Step 5：与现有图形系统集成
- 支持 `fill={patternId}` 的快捷用法
- 与逻辑图形库（P4）打通

### Step 6：图案扩展机制
- 开放自定义图案上传（SVG 文件）
- 图案市场化支持（未来）

---

## 4. 优先级排序

| Step | 内容 | 优先级 | 预计工时 |
|------|------|--------|----------|
| 1 | SVG Pattern 基础库（≥ 30 种） | P1 | 1.5d |
| 2 | PatternSVG 组件 | P1 | 0.5d |
| 3 | PatternCanvas 预览画布 | P2 | 1d |
| 4 | usePatternFill Hook | P2 | 0.5d |
| 5 | 集成到逻辑图形库 | P2 | 0.5d |
| 6 | 自定义图案上传机制 | P3 | 1d |
| **合计** | | | | **5d** |

---

## 5. 验收标准

- [ ] 图案库 ≥ 30 种预设图案
- [ ] 图案颜色/密度可参数化配置
- [ ] PatternCanvas 可预览并导出图案
- [ ] `fill={patternId}` 用法生效
- [ ] 与 P4 逻辑图形库集成可用
- [ ] 自定义 SVG 上传图案可用
- [ ] 图案在任意缩放级别无失真