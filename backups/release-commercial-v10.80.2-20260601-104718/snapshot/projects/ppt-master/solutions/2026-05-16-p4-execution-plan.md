# P4 执行方案：逻辑图形库

**版本:** v1.0
**日期:** 2026-05-16
**负责人:** tech-lead

---

## 1. 目标

构建一套覆盖 8 类逻辑关系的 SVG 图形组件库，支持省心PPT的图形填充需求。

---

## 2. 技术选型

| 技术 | 决策 | 原因 |
|------|------|------|
| SVG 为主 | ✅ | 可缩放、可脚本化、文件体积小 |
| Canvas 辅助 | ⚠️ | 仅用于高性能渲染候选（如大量动画场景） |
| React Component | ✅ | 与项目技术栈一致（Next.js 15 + React 19） |

---

## 3. 8 类逻辑关系与布局映射

### 3.1 并列关系（Parallel）
- **SVG 布局变体:** 5 种
  - `parallel-h`（水平并排）
  - `parallel-v`（垂直堆叠）
  - `parallel-grid`（2×2 网格）
  - `parallel-cards`（卡片式）
  - `parallel-timeline`（时间轴并排）

### 3.2 递进关系（Progressive）
- **SVG 布局变体:** 4 种
  - `progressive-arrow`（箭头递进）
  - `progressive-steps`（步骤递进）
  - `progressive-funnel`（漏斗递进）
  - `progressive-pyramid`（金字塔）

### 3.3 时间序列（Timeline）
- **SVG 布局变体:** 4 种
  - `timeline-linear`（线性时间轴）
  - `timeline-branch`（分叉时间轴）
  - `timeline-radial`（放射状）
  - `timeline-calendar`（日历视图）

### 3.4 对比关系（Contrast）
- **SVG 布局变体:** 4 种
  - `contrast-vs`（VS 对抗式）
  - `contrast-table`（表格对比）
  - `contrast-balance`（天平式）
  - `contrast-swipe`（滑块对比）

### 3.5 因果关系（Cause-Effect）
- **SVG 布局变体:** 4 种
  - `cause-effect-chain`（因果链）
  - `cause-effect-wheel`（因果轮）
  - `cause-effect-fishbone`（鱼骨图）
  - `cause-effect-flow`（因果流程图）

### 3.6 循环关系（Cyclic）
- **SVG 布局变体:** 5 种
  - `cyclic-circle`（圆形循环）
  - `cyclic-wheel`（齿轮循环）
  - `cyclic-infinity`（无穷符号）
  - `cyclic-pentagon`（五边形循环）
  - `cyclic-diamond`（菱形循环）

### 3.7 层级关系（Hierarchical）
- **SVG 布局变体:** 4 种
  - `hierarchical-org`（组织架构）
  - `hierarchical-tree`（树状图）
  - `hierarchical-matrix`（矩阵层级）
  - `hierarchical-radial`（放射层级）

### 3.8 包含关系（Containment）
- **SVG 布局变体:** 4 种
  - `containment-venn`（维恩图）
  - `containment-bubble`（气泡包含）
  - `containment concentric`（同心圆）
  - `containment-sunburst`（旭日图）

**合计:** 43 种布局变体（与背景一致）

---

## 4. 执行步骤

### Step 1：建立组件目录结构
```
src/components/logic-graphics/
├── parallel/
│   ├── ParallelH.tsx
│   ├── ParallelV.tsx
│   ├── ParallelGrid.tsx
│   ├── ParallelCards.tsx
│   └── ParallelTimeline.tsx
├── progressive/
├── timeline/
├── contrast/
├── cause-effect/
├── cyclic/
├── hierarchical/
├── containment/
└── index.ts  ← 统一导出
```

### Step 2：定义 Shape 接口（TypeScript）
```typescript
interface LogicShapeProps {
  width?: number;
  height?: number;
  color?: string;
  fill?: string;
  stroke?: string;
  data: LogicDataPoint[];
}
```

### Step 3：逐类实现 SVG 组件
优先级：
1. **P1（高优先级）:** 并列、递进、时间序列 → 最常用
2. **P2（中优先级）:** 对比、因果、循环 → 常见
3. **P3（低优先级）:** 层级、包含 → 专业场景

### Step 4：主题变量集成
- 所有颜色通过 Tailwind CSS 变量注入
- 支持 `fill`、`stroke`、`text` 三种色彩配置通道

### Step 5：性能验证
- 测试 SVG 渲染性能（100+ 节点）
- Canvas fallback 降级策略

---

## 5. 优先级排序

| 优先级 | 类型 | 变体数量 | 预计工时 |
|--------|------|----------|----------|
| P1 | 并列 + 递进 + 时间序列 | 13 | 3d |
| P2 | 对比 + 因果 + 循环 | 13 | 2.5d |
| P3 | 层级 + 包含 | 8 | 1.5d |
| **合计** | | **43** | **7d** |

---

## 6. 验收标准

- [ ] 43 种布局变体全部实现
- [ ] TypeScript 类型完整，无 `any`
- [ ] SVG 缩放不失真（100% / 50% / 200%）
- [ ] 主题色变量正确注入（fill / stroke / text 三通道）
- [ ] 单元测试覆盖 > 80%
- [ ] 组件可独立预览（Storybook 或独立页面）