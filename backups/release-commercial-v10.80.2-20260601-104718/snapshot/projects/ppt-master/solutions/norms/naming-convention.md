# 命名规范 — 逻辑图形库组件

> 版本：v1.0
> 日期：2026-05-16
> 适用范围：logic-diagram-engine

---

## 一、文件命名

### 1.1 类型定义文件（types/）

```
{逻辑类型}.json

示例：
parallel.json       ✓
parallel-relation.json   ✗ （过长）
parallel_type.json      ✗ （下划线不符合）
```

| 逻辑类型 | 文件名 |
|---------|--------|
| 并列关系 | `parallel.json` |
| 递进关系 | `progressive.json` |
| 时间序列 | `timeline.json` |
| 对比关系 | `comparison.json` |
| 因果关系 | `cause-effect.json` |
| 循环关系 | `cyclic.json` |
| 层级关系 | `hierarchical.json` |
| 包含/矩阵 | `matrix.json` |

### 1.2 布局算法文件（layouts/）

```
{Layout类型}Layout.ts

示例：
LinearLayout.ts
RadialLayout.ts
TreeLayout.ts
GridLayout.ts
```

### 1.3 主题文件（themes/）

```
{主题名}.json

示例：
modern.json
gradient.json
corporate.json
```

---

## 二、TypeScript 类型命名

### 2.1 接口与类型

| 类型 | 命名规则 | 示例 |
|------|---------|------|
| 接口 | `PascalCase`，前缀描述对象 | `LogicNode`, `LayoutResult`, `ConnectorConfig` |
| 类型别名 | `PascalCase` | `LogicType`, `LayoutId`, `ThemeColors` |
| 枚举成员 | `PascalCase` | `LogicType.Parallel`, `ConnectorType.Arrow` |
| 联合类型字面量 | `camelCase` | `'parallel'`, `'progressive'` |

```typescript
// ✅ 正确
interface LogicNode {
  id: string;
  label: string;
  sublabel?: string;
  icon?: string;
}

type LogicType = 'parallel' | 'progressive' | 'timeline' | 'comparison' | 'cause-effect' | 'cyclic' | 'hierarchical' | 'matrix';

type LayoutId = string;

interface LayoutResult {
  positions: Array<{ id: string; x: number; y: number }>;
  connectors: Array<{ from: string; to: string; type: ConnectorType }>;
}

// ❌ 错误
interface node { }              // 未使用 PascalCase
type logic_type = string;        // 下划线命名
enum LOGIC_TYPE { }              // 全大写枚举
```

### 2.2 事件和回调

```typescript
// ✅ 正确：事件处理器使用 on 前缀，返回 void
type OnLayoutChange = (layout: LayoutResult) => void;
type OnNodeSelect = (nodeId: string) => void;
type OnRenderStart = () => void;

// ❌ 错误
type handleLayoutChange = ...;  // 未使用 on 前缀
type layoutChangeHandler = ...;  // 过长的后缀
```

---

## 三、变量命名

### 3.1 通用规则

| 类型 | 命名规则 | 示例 |
|------|---------|------|
| 局部变量 | `camelCase` | `nodeList`, `layoutConfig` |
| 常量 | `camelCase` + 适当大写 | `DEFAULT_NODE_WIDTH = 120` |
| 类成员 | `camelCase` | `this.nodeMap` |
| 私有成员 | `_camelCase` | `this._cachedLayout` |

```typescript
// ✅ 正确
const MAX_NODE_COUNT = 100;
let currentLayout: LayoutResult | null = null;

// ❌ 错误
const max_node_count = 100;     // 下划线
let CurrentLayout: any;          // 大写开头（误认为类型）
```

### 3.2 特定领域命名

| 概念 | 变量名 | 说明 |
|------|--------|------|
| 节点列表 | `nodes` | 数组类型 |
| 单个节点 | `node` | 单个对象 |
| 节点ID | `nodeId` | 唯一标识 |
| 布局ID | `layoutId` | 布局类型标识 |
| 连接线类型 | `connectorType` | `'straight' \| 'elbow' \| 'curve' \| 'arrow'` |
| 主题颜色 | `themeColors` | 主题颜色映射 |

---

## 四、目录和目录内命名

### 4.1 目录结构

```
logic-diagram-engine/
├── src/
│   ├── engine/          # 引擎核心（含 Parser/Matcher/Renderer）
│   ├── layouts/         # 布局算法
│   ├── shapes/          # 图形单元
│   ├── themes/          # 主题
│   ├── api/             # API 接口
│   └── utils/           # 工具函数
```

### 4.2 导出约定

```typescript
// index.ts 中统一导出公共 API
export { LogicDiagramEngine } from './engine/LogicDiagramEngine';
export { parse } from './api/parse';
export { render } from './api/render';
export type { LogicNode, LogicType, LayoutResult, ThemeColors } from './types';
```

---

## 五、JSON Schema 字段命名

```typescript
// ✅ 正确：JSON 中使用 camelCase（保持 JSON 自然风格）
{
  "type": "progressive",
  "name": "递进关系",
  "nameEn": "Progressive",
  "minNodes": 2,
  "maxNodes": 8,
  "layouts": [
    {
      "layoutId": "linear-horizontal",  // ✓ camelCase
      "nodeRange": [2, 5],
      "renderParams": {                  // ✓ camelCase
        "direction": "left-to-right",
        "nodeSpacing": 120
      }
    }
  ]
}

// ❌ 错误：snake_case（JSON 通常不用下划线）
{
  "layout_id": "linear-horizontal",
  "node_range": [2, 5]
}
```

---

## 六、测试文件命名

```
{被测文件}.test.ts

示例：
LinearLayout.test.ts
Matcher.test.ts
Parser.test.ts
```

---

*本规范为初稿，开发过程中持续更新。*