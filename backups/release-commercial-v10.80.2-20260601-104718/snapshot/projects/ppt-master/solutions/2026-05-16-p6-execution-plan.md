# P6 执行方案：布局设计

**版本:** v1.0
**日期:** 2026-05-16
**负责人:** tech-lead

---

## 1. 目标

实现自由拖拽布局引擎，支持网格系统和 snap-to-grid 吸附，实现类 PPT 的精确布局体验。

---

## 2. 核心模块

### 2.1 拖拽系统（Drag & Drop）
- **技术选型:** React DnD / dnd-kit / custom pointer events
- **推荐:** `dnd-kit`（Tree-shakable、Accessible、TypeScript 原生）

### 2.2 网格系统（Grid System）
- **网格单元:** 可配置（默认 20px / 40px 两档）
- **可见性:** 可切换显示/隐藏
- **辅助线:** 智能对齐辅助线（Smart Guides）

### 2.3 Snap-to-Grid 吸附
- **吸附阈值:** 可配置（默认 8px）
- **吸附方向:** 水平 + 垂直 + 对角
- **实时预览:** 拖拽时显示吸附位置虚线

---

## 3. 文件结构

```
src/components/layout/
├── LayoutCanvas.tsx        ← 主画布（拖拽容器）
├── DraggableElement.tsx    ← 可拖拽元素封装
├── GridOverlay.tsx         ← 网格覆盖层
├── SmartGuides.tsx         ← 智能对齐辅助线
├── SnapEngine.ts           ← 吸附引擎（纯函数）
└── index.ts
```

---

## 4. 执行步骤

### Step 1：LayoutCanvas 画布核心
- 全屏/固定尺寸画布
- 支持缩放（zoom 0.25x ~ 4x）
- 支持平移（pan）
- 背景网格渲染

### Step 2：DraggableElement 可拖拽封装
```typescript
interface DraggableElementProps {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation?: number;
  children: React.ReactNode;
  onDragStart?: () => void;
  onDragEnd?: (pos: Position) => void;
}
```

### Step 3：SnapEngine 吸附引擎
```typescript
// 核心吸附算法
function snapToGrid(pos: Position, gridSize: number, threshold: number): Position
function snapToElement(pos: Position, siblings: Element[]): Position  // 对齐吸附
```

### Step 4：GridOverlay 网格层
- SVG 或 Canvas 渲染网格线
- 动态响应 zoom 级别（远看稀疏，近看密集）

### Step 5：SmartGuides 智能辅助线
- 检测最近元素边缘
- 显示临时对齐参考线
- 与 snapToGrid 协同工作

### Step 6：状态管理
- 使用 Zustand / Jotai 管理元素位置状态
- 支持 Undo / Redo（历史栈）
- 防抖保存（debounce 500ms）

---

## 5. 优先级排序

| Step | 内容 | 优先级 | 预计工时 |
|------|------|--------|----------|
| 1 | LayoutCanvas 画布核心 | P1 | 1d |
| 2 | DraggableElement 封装 | P1 | 1d |
| 3 | SnapEngine 吸附引擎 | P1 | 1d |
| 4 | GridOverlay 网格层 | P2 | 0.5d |
| 5 | SmartGuides 智能辅助线 | P2 | 1d |
| 6 | 状态管理 + Undo/Redo | P2 | 1d |
| **合计** | | | | **5.5d** |

---

## 6. 验收标准

- [ ] 元素可自由拖拽，无卡顿（60fps）
- [ ] Snap-to-Grid 吸附准确（误差 ≤ 1px）
- [ ] Smart Guides 智能对齐辅助线可用
- [ ] 画布支持缩放（0.25x ~ 4x）+ 平移
- [ ] Undo / Redo 可用（≥ 50 步历史）
- [ ] 移动端（touch events）基本可用
- [ ] 元素旋转功能可用