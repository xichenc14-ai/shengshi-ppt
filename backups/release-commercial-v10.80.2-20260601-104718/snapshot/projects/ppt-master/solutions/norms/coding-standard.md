# 编码规范 — SVG/Canvas 渲染

> 版本：v1.0
> 日期：2026-05-16
> 适用范围：logic-diagram-engine

---

## 一、渲染技术原则

1. **SVG 优先** — 所有逻辑图形默认使用 SVG 渲染
2. **Canvas 降级条件** — 节点数 > 50 或动画场景，降级到 Canvas 2D
3. **禁止混合渲染** — 单一图形组件不得同时使用 SVG 和 Canvas
4. **矢量优先** — 导出场景必须保证输出为矢量格式

---

## 二、SVG 渲染规范

### 2.1 基础规则

```typescript
// ✅ 正确：SVG 根元素必须指定 namespace + viewBox
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 400">

// ❌ 错误：缺少 viewBox（无法缩放）
<svg xmlns="http://www.w3.org/2000/svg">
```

### 2.2 节点形状

| 形状 | SVG Element | 适用场景 |
|------|------------|---------|
| 矩形 | `<rect>` | 标准节点，最常用 |
| 圆角矩形 | `<rect rx="8" ry="8">` | 现代风格卡片 |
| 圆形 | `<circle>` | 中心节点、循环关系 |
| 菱形 | `<polygon>` | 判断/条件节点 |
| 胶囊形 | `<rect rx="高度一半">` | 步骤编号 |
| 图标占位 | `<rect>+<text>` 或 `<image>` | 带图标的节点 |

### 2.3 连接线

```typescript
// 直线
<line x1="0" y1="0" x2="100" y2="0" stroke="currentColor" />

// 折线（直角）
<polyline points="0,0 50,0 50,100" fill="none" stroke="currentColor" />

// 曲线（贝塞尔）
<path d="M0,0 C50,0 50,100 100,100" fill="none" stroke="currentColor" />

// 箭头（使用 marker-end）
<defs>
  <marker id="arrow" markerWidth="10" markerHeight="10" refX="9" refY="3" orient="auto">
    <path d="M0,0 L0,6 L9,3 z" fill="currentColor" />
  </marker>
</defs>
<line x1="0" y1="0" x2="100" y2="0" stroke="currentColor" marker-end="url(#arrow)" />
```

### 2.4 标签文本

```typescript
// ✅ 正确：text-anchor 用于水平对齐，dominant-baseline 用于垂直对齐
<text x="50" y="50" text-anchor="middle" dominant-baseline="middle" font-size="14">
  节点文字
</text>

// 换行处理：使用 <tspan> 或 手动折行
<text>
  <tspan x="50" dy="0">第一行</tspan>
  <tspan x="50" dy="1.2em">第二行</tspan>
</text>
```

### 2.5 颜色和样式

```typescript
// ✅ 正确：通过 CSS 变量或 currentColor 实现主题切换
style="fill: var(--node-bg, #ffffff); stroke: var(--node-border, #333333);"

// ❌ 错误：硬编码颜色（无法主题切换）
style="fill: #ffffff; stroke: #333333;"
```

### 2.6 性能优化

```typescript
// ✅ 正确：使用 will-change 提示浏览器进行优化
<g class="diagram-nodes" will-change="transform">

// ✅ 正确：复杂图形使用 clipPath 减少重绘区域
<clipPath id="clip-viewport">
  <rect x="0" y="0" width="800" height="400" />
</clipPath>

// ✅ 正确：避免在 SVG 中使用滤镜（性能损耗大）
// ❌ 避免：<filter> 标签用于生产渲染
```

---

## 三、Canvas 渲染规范

### 3.1 降级触发条件

```typescript
// 降级到 Canvas 的条件
const shouldUseCanvas = (nodeCount: number, enableAnimation: boolean): boolean => {
  return nodeCount > 50 || enableAnimation === true;
};
```

### 3.2 Canvas 基础规则

```typescript
// ✅ 正确：高清屏适配（devicePixelRatio）
const canvas = document.getElementById('canvas') as HTMLCanvasElement;
const ctx = canvas.getContext('2d')!;
const dpr = window.devicePixelRatio || 1;
canvas.width = 800 * dpr;
canvas.height = 400 * dpr;
ctx.scale(dpr, dpr);

// ✅ 正确：高清屏适配后坐标使用物理像素
ctx.beginPath();
ctx.moveTo(0, 0);        // ← 这是逻辑像素，scale 后自动放大
ctx.lineTo(100, 100);
```

### 3.3 字体加载

```typescript
// Canvas 中文字体必须等待加载完成后再渲染
const FONT_FAMILY = '"PingFang SC", "Microsoft YaHei", sans-serif';
let fontLoaded = false;

document.fonts.ready.then(() => {
  fontLoaded = true;
});

// 渲染前检查
if (fontLoaded) {
  ctx.font = `14px ${FONT_FAMILY}`;
  ctx.fillText('节点文字', x, y);
}
```

---

## 四、布局算法规范

### 4.1 布局接口定义

```typescript
interface LayoutContext {
  nodes: Array<{ id: string; width: number; height: number; label: string }>;
  containerWidth: number;
  containerHeight: number;
  direction?: 'horizontal' | 'vertical';
}

interface LayoutResult {
  positions: Array<{ id: string; x: number; y: number }>;
  connectors: Array<{ from: string; to: string; type: ConnectorType }>;
}

// 所有布局算法必须实现 LayoutContext → LayoutResult
```

### 4.2 布局计算规则

```typescript
// ✅ 统一使用 px 作为单位
// ✅ 节点间距由布局参数控制，不硬编码
// ✅ 返回值中 x/y 为节点左上角坐标（容错性更强）
// ✅ 连接线信息独立返回，不混入节点坐标
```

---

## 五、代码风格

```typescript
// ✅ 正确：所有渲染相关函数返回 SVG 字符串（模板方式）
function renderParallelCardList(nodes: Node[], theme: Theme): string {
  return `<svg ...>${/* 渲染逻辑 */}</svg>`;
}

// ✅ 正确：Canvas 渲染使用离屏 canvas 预渲染复杂图形
const offscreen = document.createElement('canvas');
const offCtx = offscreen.getContext('2d')!;

// ❌ 错误：在渲染循环中进行 DOM 操作
// ❌ 错误：直接修改已有 SVG DOM（应整体替换）
```

---

*本规范为初稿，开发过程中持续更新。*