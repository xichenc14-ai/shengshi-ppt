# BUG-TRACE-THEME.md — 主题选择无效根因调查报告

> **调查日期：** 2026-04-26
> **问题：** 用户选择主题后，PPT 总是一个风格，主题选择无效
> **调查范围：** 仅研究，不改代码

---

## 一、主题选择完整数据流（ASCII 图）

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              用户界面层                                      │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  [专业模式]                         [省心模式]                              │
│  ThemeSelector.tsx                 outline API 返回                         │
│       │                                 │                                  │
│       ↓                                 ↓                                  │
│  onChange(theme.id)               od.themeId                               │
│       │                                 │                                  │
│       ↓                                 ↓                                  │
│  setDirectTheme(theme.id)         smartGammaPayload.themeId               │
│       │                                 │                                  │
│       │  ┌──────────────────────────────┘                                  │
│       │  │                                                                  │
├───────│──│──────────────────────────────────────────────────────────────────┤
│       │  │                     前端状态层                                   │
│       ↓  ↓                                                                  │
│  directTheme = 'consultant'     ← 省心PPT自定义ID                          │
│  或 'blues', 'icebreaker' 等                                               │
│       │                                                                     │
│       ↓                                                                     │
├───────│─────────────────────────────────────────────────────────────────────┤
│       │                       API调用层                                     │
│       ↓                                                                     │
│  generateDirect() / confirmAndGenerate()                                   │
│       │                                                                     │
│       ↓                                                                     │
│  fetch('/api/gamma-direct', {                                             │
│    body: JSON.stringify({                                                  │
│      themeId: directTheme,  ← 传递 'consultant' 等自定义ID                 │
│      ...                                                                    │
│    })                                                                       │
│  })                                                                         │
│       │                                                                     │
│       ↓                                                                     │
├───────│─────────────────────────────────────────────────────────────────────┤
│       │                       后端路由层                                    │
│       ↓                                                                     │
│  /api/gamma/route.ts                                                       │
│  或 /api/gamma-direct/route.ts                                             │
│       │                                                                     │
│       ↓                                                                     │
│  const finalThemeId = themeId || sceneConfig.themeId                       │
│  // themeId = 'consultant' (省心PPT自定义)                                  │
│       │                                                                     │
│       ↓                                                                     │
│  gammaPayload = {                                                          │
│    themeId: finalThemeId,  ← 传给Gamma API                                 │
│    ...                                                                      │
│  }                                                                          │
│       │                                                                     │
│       ↓                                                                     │
├───────│─────────────────────────────────────────────────────────────────────┤
│       │                       Gamma API层                                  │
│       ↓                                                                     │
│  POST https://public-api.gamma.app/v1.0/generations                        │
│       │                                                                     │
│       ↓                                                                     │
│  themeId: 'consultant'  ← ⚠️ Gamma不认识这个ID！                           │
│       │                                                                     │
│       ↓                                                                     │
│  Gamma忽略无效themeId → 使用workspace默认主题                              │
│       │                                                                     │
│       ↓                                                                     │
│  返回固定的默认风格PPT                                                     │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 二、每个环节的代码证据

### 2.1 前端主题选择 UI

**文件：** `src/components/ThemeSelector.tsx`

```tsx
// 第 55-68 行：用户点击主题后调用 onChange
<button
  key={theme.id}
  onClick={() => onChange(theme.id)}
  className={...}
>
  {/* theme.id 来自 theme-database.ts */}
</button>
```

**证据：** 用户选择后，`theme.id` 被传递给父组件的 `onChange` 回调。

---

### 2.2 主题数据库（省心PPT自定义）

**文件：** `src/lib/theme-database.ts`

```ts
// 第 7-45 行：省心PPT自定义的主题 ID
export const THEME_DATABASE: ThemeData[] = [
  { id: 'consultant', name: 'Consultant', nameZh: '商务蓝', ... },
  { id: 'icebreaker', name: 'Icebreaker', nameZh: '蓝白友好', ... },
  { id: 'blues', name: 'Blues', nameZh: '高端深蓝', ... },
  { id: 'default-light', name: 'Basic Light', nameZh: '经典白', ... },
  { id: 'aurora', name: 'Aurora', nameZh: '极光紫', ... },
  // ... 共 52 个主题
];
```

**证据：** 这些 `id` 是**省心PPT自己定义的语义化名称**（如 `consultant`, `blues`），**不是 Gamma API 的真实主题 ID**。

---

### 2.3 前端状态存储

**文件：** `src/app/page.tsx`

```tsx
// 第 49 行：专业模式主题状态
const [directTheme, setDirectTheme] = useState('consultant');

// 第 163-164 行：ThemeSelector 传值
<ThemeSelector value={directTheme} onChange={setDirectTheme} />
```

**证据：** 用户选择的主题 ID 存储在 `directTheme` state，默认值 `'consultant'`。

---

### 2.4 传给 Gamma API（专业模式直通）

**文件：** `src/app/page.tsx` → `generateDirect()` 函数

```tsx
// 第 184-193 行：调用 gamma-direct API
const gRes = await fetch('/api/gamma-direct', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    inputText: finalInputText,
    themeId: directTheme,        // ← ⚠️ 直接传递 'consultant' 等
    numCards: pages,
    imageSource: directImgMode,
    tone: directTone,
    textMode: directTextMode,
    exportAs: 'pptx',
  }),
});
```

**证据：** `directTheme`（如 `'consultant'`）直接传给 `/api/gamma-direct`。

---

### 2.5 传给 Gamma API（省心模式/大纲确认）

**文件：** `src/app/page.tsx` → `confirmAndGenerate()` 函数

```tsx
// 第 418-423 行：构建 themeId
const finalThemeId = (theme !== 'auto' ? theme : outlineResult.themeId) || 'consultant';

// 第 425-437 行：传给 gamma API
const gammaRequestBody: any = {
  inputText: md,
  textMode: 'preserve',
  format: 'presentation',
  numCards: editedSlides.length,
  exportAs: 'pptx',
  themeId: finalThemeId,         // ← ⚠️ 传递 'consultant' 等
  tone: finalTone,
  ...
};
```

**证据：** `finalThemeId` 也是省心PPT自定义的主题 ID（如 `'consultant'`）。

---

### 2.6 后端路由接收并传递

**文件：** `src/app/api/gamma/route.ts`

```ts
// 第 23-47 行：接收 themeId
const {
  inputText,
  themeId,       // ← 从请求体读取
  ...
} = body;

// 第 94 行：如果没有传，用默认
const finalThemeId = themeId || sceneConfig.themeId;

// 第 126-135 行：构建 Gamma payload
const gammaPayload: Record<string, any> = {
  inputText: finalInputText,
  textMode: 'preserve',
  format,
  numCards,
  exportAs,
  themeId: finalThemeId,        // ← ⚠️ 传给 Gamma API
  additionalInstructions: finalAdditionalInstructions,
  imageOptions: finalImageOptions,
};
```

**证据：** 后端接收 `themeId` 并直接传递给 Gamma API，**没有任何转换或验证**。

---

### 2.7 Gamma API 文档（真实主题 ID 格式）

**文件：** `docs/gamma-api-pages/workspace_list-themes.md`

```json
// Gamma API 返回的主题格式示例
{
  "id": "abc123def456ghi",      // ← ⚠️ 这是 Gamma 的真实 ID 格式！
  "name": "Consultant",
  "type": "standard"
}
```

**文件：** `docs/gamma-api-pages/guides_generate-api-parameters-explained.md`

```markdown
#### `themeId` *(optional, defaults to workspace default theme)*

Defines which theme from Gamma will be used for the output.

- Use `GET /v1.0/themes` to list themes from your workspace
- Or copy the theme ID directly from the app
```

**证据：** Gamma API 的 `themeId` 需要从 `GET /v1.0/themes` API 获取，格式是类似 `"abc123def456ghi"` 的字符串，**不是** `"consultant"` 这样的语义化名称。

---

## 三、根因定位

### 🔴 根因：主题 ID 不匹配

**具体位置：** `src/lib/theme-database.ts` 第 7-45 行

**问题描述：**

省心PPT使用自己定义的语义化主题 ID（如 `'consultant'`, `'blues'`, `'aurora'` 等），直接传递给 Gamma API。

但 Gamma API **不认识这些 ID**，需要使用 Gamma workspace 的真实主题 ID（格式类似 `"abc123def456ghi"`）。

当 Gamma 收到无效的 `themeId` 时，**会忽略它**，使用 workspace 默认主题，导致所有 PPT 都是同一个风格。

---

### 根因链条

```
1. theme-database.ts 定义了 52 个自定义主题 ID（'consultant' 等）
   ↓
2. ThemeSelector 让用户选择，onChange(theme.id) 传值
   ↓
3. 前端存储到 directTheme 或 smartGammaPayload.themeId
   ↓
4. 调用 API 时直接传 'consultant' 给 /api/gamma
   ↓
5. 后端 gamma/route.ts 接收并直接传给 Gamma API
   ↓
6. Gamma API 不认识 'consultant' → 忽略 → 使用默认主题
   ↓
7. 所有 PPT 都是默认风格（主题选择无效）
```

---

## 四、修复方案

### 方案 A：建立 ID 映射表（推荐）

**思路：** 在后端维护一个映射表，将省心PPT的自定义 ID 映射到 Gamma 的真实主题 ID。

**具体改什么：**

1. **新增文件：** `src/lib/gamma-theme-mapping.ts`

```ts
// 省心PPT ID → Gamma ID 映射表
export const THEME_ID_MAPPING: Record<string, string> = {
  'consultant': 'gamma_consultant_abc123',  // 需要从 Gamma API 获取真实 ID
  'blues': 'gamma_blues_xyz789',
  'aurora': 'gamma_aurora_def456',
  // ... 其他主题映射
};
```

2. **修改文件：** `src/app/api/gamma/route.ts` 第 94 行附近

```ts
// 原代码
const finalThemeId = themeId || sceneConfig.themeId;

// 改为
const gammaThemeId = THEME_ID_MAPPING[themeId] || themeId || sceneConfig.themeId;
// 如果映射表里有，用映射值；否则原样传递（兼容真实 Gamma ID）
```

3. **修改文件：** `src/app/api/gamma-direct/route.ts` 同样位置

```ts
const finalThemeId = THEME_ID_MAPPING[themeId] || themeId || SCENE_CONFIGS.biz.themeId;
```

**获取 Gamma 真实 ID 的方法：**

调用 `GET https://public-api.gamma.app/v1.0/themes` API，获取 workspace 所有主题的真实 ID，然后建立映射表。

---

### 方案 B：前端直接使用 Gamma 主题 ID

**思路：** 修改 `theme-database.ts`，直接使用 Gamma 的真实主题 ID。

**具体改什么：**

1. 先调用 Gamma API 获取主题列表
2. 更新 `theme-database.ts` 的所有 `id` 字段为真实 Gamma ID
3. 更新前端 ThemeSelector 的显示名称匹配

**缺点：** 需要 Gamma workspace 有对应主题，且主题名称可能与省心PPT定义的不同。

---

### 方案 C：动态查询 Gamma 主题（最优）

**思路：** 后端在启动时或定期调用 `GET /themes` 获取真实主题，自动匹配。

**具体改什么：**

1. **新增脚本：** `scripts/sync-gamma-themes.ts`

```ts
// 调用 Gamma API 获取主题
const gammaThemes = await fetch('https://public-api.gamma.app/v1.0/themes', {
  headers: { 'X-API-KEY': apiKey }
});

// 根据名称匹配，生成映射文件
// 或者存到数据库
```

2. **后端启动时加载映射：** `src/lib/gamma-config.ts`

```ts
export async function getGammaThemeId(shengxinThemeId: string): Promise<string> {
  // 从缓存/数据库查询映射
  // 或按名称模糊匹配
}
```

3. **API 调用时转换：**

```ts
const gammaThemeId = await getGammaThemeId(themeId);
```

---

## 五、验证建议

### 验证 Gamma 是否忽略无效 themeId

**测试脚本：**

```bash
# 使用有效的 Gamma themeId
curl -X POST https://public-api.gamma.app/v1.0/generations \
  -H "X-API-KEY: $GAMMA_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"inputText":"test", "themeId":"valid_gamma_id"}'

# 使用无效的 themeId（如 'consultant')
curl -X POST https://public-api.gamma.app/v1.0/generations \
  -H "X-API-KEY: $GAMMA_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"inputText":"test", "themeId":"consultant"}'
```

**预期结果：**
- 有效 ID → 返回对应主题风格的 PPT
- 无效 ID → 返回默认主题（或返回错误，需实测确认）

---

## 六、补充发现

### 6.1 省心PPT主题与 Gamma 主题的对应关系

`theme-database.ts` 的主题命名（如 `consultant`, `blues`, `aurora`）可能参考了 Gamma 的主题名称，但 **ID 格式完全不同**：

| 省心PPT ID | 省心PPT名称 | Gamma 可能对应主题 | Gamma 真实 ID 格式 |
|-----------|------------|------------------|-------------------|
| `consultant` | 商务蓝 | Consultant | `abc123...` |
| `blues` | 高端深蓝 | Blues | `xyz789...` |
| `aurora` | 极光紫 | Aurora | `def456...` |

**需要确认 Gamma workspace 是否有对应主题。**

---

### 6.2 已废弃主题的提示

`theme-database.ts` 中有 3 个废弃主题：

```ts
{ id: 'festival', ..., _deprecated: true, _replacedBy: 'aurum' },
{ id: 'lunar-new-year', ..., _deprecated: true, _replacedBy: 'aurum' },
{ id: 'luxe', ..., _deprecated: true, _replacedBy: 'cigar' },
```

**注释说明：**
> ⚠️ festival 主题不存在于 Gamma API，AI可能仍返回此 ID，需在运行时映射为 aurum

**证据：** 开发者已经意识到某些主题 ID 不存在于 Gamma API，但**没有对所有主题建立映射**。

---

## 七、总结

| 项目 | 结论 |
|------|------|
| **根因** | 省心PPT传递的主题 ID（`'consultant'` 等）不是 Gamma API 认识的真实 ID，Gamma 忽略无效 ID，使用默认主题 |
| **根因位置** | `src/lib/theme-database.ts` 定义了自定义 ID，整个数据流没有转换为 Gamma 真实 ID |
| **修复方向** | 建立主题 ID 映射表，或动态查询 Gamma 主题 API 获取真实 ID |
| **优先级** | 🔴 P0（核心功能失效） |

---

_调查完成，未修改任何代码_