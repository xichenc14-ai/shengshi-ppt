# 测试规范 — 逻辑图形库

> 版本：v1.0
> 日期：2026-05-16
> 适用范围：logic-diagram-engine

---

## 一、测试策略

### 1.1 测试金字塔

```
        /\
       /  \     E2E 测试（少量关键流程）
      /----\
     /      \   集成测试（API 接口全链路）
    /--------\
   /          \  单元测试（核心算法 + Matcher）
  /------------\
```

- **单元测试** — 覆盖率主力，重点覆盖布局算法、Matcher、打分逻辑
- **集成测试** — 覆盖 parse → match → render 全链路
- **E2E 测试** — 仅关键路径（如输入文本 → SVG 输出）

### 1.2 测试框架

| 层级 | 工具 |
|------|------|
| 单元测试 + 集成测试 | Vitest |
| 类型检查 | TypeScript strict mode |
| E2E | Playwright（复用现有浏览器自动化基础设施） |

---

## 二、单元测试规范

### 2.1 布局算法测试

```typescript
// ✅ 正确：每个布局算法必须有单元测试
import { describe, it, expect } from 'vitest';
import { LinearLayout } from './LinearLayout';

describe('LinearLayout', () => {
  it('水平布局：节点应从左到右排列', () => {
    const nodes = [
      { id: 'n1', width: 100, height: 40, label: '节点1' },
      { id: 'n2', width: 100, height: 40, label: '节点2' },
    ];
    const result = LinearLayout.execute(nodes, {
      containerWidth: 800,
      containerHeight: 400,
      direction: 'horizontal',
    });
    expect(result.positions[0].x).toBeLessThan(result.positions[1].x);
  });

  it('垂直布局：节点应从上到下排列', () => {
    // ...
  });

  it('边界条件：单节点应居中', () => {
    const nodes = [{ id: 'n1', width: 100, height: 40, label: '节点1' }];
    const result = LinearLayout.execute(nodes, { containerWidth: 800, containerHeight: 400 });
    expect(result.positions[0].x).toBe(350); // (800 - 100) / 2
  });
});
```

### 2.2 Matcher 测试

```typescript
describe('Matcher', () => {
  it('关键词"首先/然后/最终"应匹配递进关系', () => {
    const result = Matcher.match('首先进行市场调研，然后制定策略，最终落地执行');
    expect(result.type).toBe('progressive');
    expect(result.score).toBeGreaterThan(0.6);
  });

  it('关键词"VS/对比"应匹配对比关系', () => {
    const result = Matcher.match('方案A VS 方案B 对比分析');
    expect(result.type).toBe('comparison');
  });

  it('无法识别时应返回最低匹配度而非抛出异常', () => {
    const result = Matcher.match('这是一段没有任何逻辑关键词的普通文本');
    expect(result.score).toBeLessThan(0.3);
  });
});
```

### 2.3 Parser 测试

```typescript
describe('Parser', () => {
  it('应正确提取节点数量', () => {
    const result = Parser.parse('第一点：市场调研\n第二点：策略制定\n第三点：执行落地');
    expect(result.nodeCount).toBe(3);
  });

  it('应正确处理无明确分隔符的文本（自然段落）', () => {
    const result = Parser.parse('我们需要关注三个方向：品牌建设、产品优化、市场拓展');
    expect(result.nodeCount).toBeGreaterThanOrEqual(1);
  });
});
```

---

## 三、集成测试规范

### 3.1 API 端到端测试

```typescript
describe('POST /api/diagram/parse', () => {
  it('输入步骤类文本应返回递进关系推荐', async () => {
    const response = await fetch('/api/diagram/parse', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: '第一步调研市场，第二步制定方案，第三步落地执行' }),
    });
    const data = await response.json();
    expect(data.detectedType).toBe('progressive');
    expect(data.suggestedLayouts.length).toBeGreaterThan(0);
  });
});

describe('POST /api/diagram/render', () => {
  it('渲染结果应为有效 SVG 字符串', async () => {
    const response = await fetch('/api/diagram/render', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 'parallel',
        layoutId: 'card-list',
        nodes: [
          { id: 'n1', label: '功能一' },
          { id: 'n2', label: '功能二' },
        ],
      }),
    });
    const data = await response.json();
    expect(data.svg).toMatch(/^<svg/);
    expect(data.svg).toContain('xmlns');
  });
});
```

---

## 四、测试覆盖要求

### 4.1 覆盖率门槛

| 模块 | 覆盖率目标 |
|------|-----------|
| layouts/* | ≥ 90% |
| engine/Matcher.ts | ≥ 85% |
| engine/Parser.ts | ≥ 80% |
| engine/Renderer.ts | ≥ 70%（SVG 渲染较难覆盖） |
| 整体 | ≥ 80% |

### 4.2 边界条件必须覆盖

```typescript
// 以下场景必须有测试：
1. 空节点列表 [] → 应返回空布局或有明确空状态处理
2. 单节点 → 应正常渲染（居中）
3. 节点数超出 maxNodes → 应有截断或报错
4. 超长文本标签 → 应有截断处理
5. 特殊字符（&、<、>、"）→ 应做转义处理
6. 负数/零值坐标 → 应有边界保护
```

---

## 五、可访问性测试

```typescript
// SVG 图形必须满足：
1. 所有文本节点有对应的 aria-label
2. 图形颜色对比度符合 WCAG 2.1 AA 标准（4.5:1）
3. 支持键盘导航（Tab 焦点到图形时可见焦点框）
4. 使用 role="img" 标记

示例：
<svg role="img" aria-label="并列关系：三列卡片布局">
  <title>并列关系布局</title>
  ...
</svg>
```

---

## 六、持续集成要求

```yaml
# .github/workflows/test.yml（示意）
- name: Unit Tests
  run: npm run test -- --coverage

- name: Integration Tests
  run: npm run test -- --testPathPattern=integration

- name: Type Check
  run: npm run typecheck

- name: Coverage Report
  uses: codecov/codecov-action@v3
```

---

*本规范为初稿，开发过程中持续更新。*