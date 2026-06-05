# Gamma API 参数审查报告

> **版本:** v10.14
> **审查日期:** 2026-04-26
> **审查范围:** 省心PPT传给Gamma API的所有参数

---

## 📋 审查结论

**总体评级:** ✅ **PASS WITH MINOR WARNINGS**

大部分参数符合Gamma API规范，但有以下需要关注的点：

---

## 1. themeId ✅ 已修复

**问题:** 前端传入的主题ID可能不是Gamma标准ID（如中文名、别名、无效ID）

**修复方案:**
- 新增 `gamma-theme-mapping.ts`（102个Gamma标准主题）
- API调用前使用 `getGammaThemeId()` 转换
- 无效ID fallback到 `'consultant'`

**Gamma API规范:**
- 必须是 `/themes` 端点返回的标准ID
- 自定义主题需要用户workspace创建
- 错误ID会导致400 Bad Request

---

## 2. fontId ⚠️ 未使用

**Gamma API规范:**
- Gamma API不支持 `fontId` 参数
- 字体由主题决定
- 无法在API级别自定义字体

**省心PPT现状:**
- ❌ 不传 `fontId`（正确）
- ✅ 字体通过 `additionalInstructions` 指定风格描述

---

## 3. colorSchemeId ⚠️ 未使用

**Gamma API规范:**
- Gamma API不支持 `colorSchemeId` 参数
- 颜色由主题决定
- 无法在API级别自定义配色

**省心PPT现状:**
- ❌ 不传 `colorSchemeId`（正确）
- ✅ 配色通过 `themeId` 选择

---

## 4. format ✅ 符合规范

**Gamma API规范:**
```
enum: ["presentation", "document", "social", "webpage"]
```

**省心PPT现状:**
- ✅ 固定使用 `'presentation'`
- ✅ 符合API规范

---

## 5. size ⚠️ 使用 cardOptions.dimensions

**Gamma API规范:**
```
cardOptions.dimensions: ["fluid", "16x9", "4x3", "pageless", "letter", "a4", "1x1", "4x5", "9x16"]
```

**省心PPT现状:**
- ✅ 使用 `cardOptions.dimensions: '16x9'`
- ✅ 符合API规范

---

## 6. textMode ✅ 已修复（V8.2）

**Gamma API规范:**
```
enum: ["generate", "condense", "preserve"]
```

**省心PPT现状:**
- ✅ 固定使用 `'preserve'`
- ✅ 符合API规范
- V8.2已修复：大纲由outline API预处理，Gamma只负责排版

---

## 7. textOptions ✅ 基本符合

### 7.1 textOptions.amount

**Gamma API规范:**
```
enum: ["brief", "medium", "detailed", "extensive"]
```

**省心PPT现状:**
- ✅ 使用 `'medium'`
- ✅ 符合API规范
- ⚠️ 注意：在 `preserve` 模式下，Gamma会忽略此参数

### 7.2 textOptions.tone

**Gamma API规范:**
```
type: string (maxLength: 500)
自由文本，描述写作风格
```

**省心PPT现状:**
- ✅ 传入 `'professional'` / `'casual'` / `'creative'` / `'bold'` / `'traditional'`
- ✅ 符合API规范（自由文本）
- ⚠️ 注意：在 `preserve` 模式下，Gamma会忽略此参数

### 7.3 textOptions.audience

**Gamma API规范:**
```
type: string (maxLength: 500)
自由文本，描述目标受众
```

**省心PPT现状:**
- ⚠️ 未使用（可选参数）
- 💡 建议：可在用户选择场景时传入（如 `"企业高管"`、`"培训学员"`）

### 7.4 textOptions.language ✅ 符合规范

**Gamma API规范:**
```
enum: ["en", "zh-cn", "zh-tw", "ko", "ja", ...] （50+语言）
```

**省心PPT现状:**
- ✅ 固定使用 `'zh-cn'`
- ✅ 符合API规范

---

## 8. imageOptions ✅ 已修复（V10.14）

### 8.1 imageOptions.source ✅ 符合规范

**Gamma API规范:**
```
enum: [
  "webAllImages",
  "webFreeToUse",
  "webFreeToUseCommercially",
  "aiGenerated",
  "pictographic",
  "giphy",
  "pexels",
  "placeholder",
  "noImages",
  "themeAccent"
]
```

**省心PPT现状:**
- ✅ 使用有效值：
  - `'noImages'`（纯文字）
  - `'themeAccent'`（主题套图）
  - `'webFreeToUseCommercially'`（网图）
  - `'aiGenerated'`（AI图）
- ⚠️ `'pictographic'` 可能不稳定（Gamma文档未明确）
- 💡 建议：优先使用 `'webFreeToUseCommercially'`（免费且稳定）

### 8.2 imageOptions.model ✅ 符合规范

**Gamma API规范:**
```
enum: [
  "dall-e-3",
  "imagen-3-flash",
  "imagen-3-pro",
  "imagen-4-pro",
  "imagen-4-ultra",
  "flux-kontext-fast",
  "flux-kontext-pro",
  ... （30+模型）
]
```

**省心PPT现状:**
- ✅ 使用 `'imagen-3-flash'`（普通AI图，2 credits/图）
- ✅ 使用 `'imagen-3-pro'`（高端AI图，8 credits/图）
- ✅ 符合API规范

### 8.3 imageOptions.style ✅ 符合规范

**Gamma API规范:**
```
type: string (maxLength: 5000)
自由文本，描述图片风格
```

**省心PPT现状:**
- ✅ 传入风格描述（如 `"flat illustration, minimalist, clean background"`）
- ✅ 符合API规范

---

## 9. cardOptions ✅ 符合规范

**Gamma API规范:**
```
cardOptions.dimensions: ["fluid", "16x9", "4x3", "pageless", "letter", "a4", "1x1", "4x5", "9x16"]
cardOptions.headerFooter: { ... } （可选）
```

**省心PPT现状:**
- ✅ 使用 `dimensions: '16x9'`
- ⚠️ 未使用 `headerFooter`（可选参数）
- ✅ 符合API规范

---

## 10. sharingOptions ⚠️ 未使用

**Gamma API规范:**
```
sharingOptions: {
  workspaceAccess: ["edit", "comment", "view", "noAccess", "fullAccess"],
  externalAccess: ["edit", "comment", "view", "noAccess"],
  emailOptions: { ... }
}
```

**省心PPT现状:**
- ⚠️ 未传 `sharingOptions`
- Gamma默认权限：`workspaceAccess: "edit"`, `externalAccess: "view"`
- 💡 建议：如有权限需求，可添加此参数

---

## 11. cardSplit ✅ 符合规范

**Gamma API规范:**
```
enum: ["inputTextBreaks", "auto"]
```

**省心PPT现状:**
- ✅ 使用 `'inputTextBreaks'`（强制精确分页）
- ✅ 符合API规范
- V8.2已修复：配合 `textMode: 'preserve'` 使用

---

## 12. additionalInstructions ✅ 符合规范

**Gamma API规范:**
```
type: string (maxLength: 5000)
自由文本，额外指令
```

**省心PPT现状:**
- ✅ 传入完整排版规则（~2000字符）
- ✅ 符合API规范
- 💡 建议：保持长度 <3000字符以避免截断风险

---

## 13. numCards ✅ 符合规范

**Gamma API规范:**
```
type: number (minimum: 1)
目标卡片数量
```

**省心PPT现状:**
- ✅ 默认值 `8`，用户可自定义
- ✅ 符合API规范

---

## 14. exportAs ✅ 符合规范

**Gamma API规范:**
```
enum: ["pptx", "pdf", "png"]
```

**省心PPT现状:**
- ✅ 默认值 `'pdf'`，支持 `'pptx'`
- ✅ 符合API规范

---

## 15. folderIds ⚠️ 未使用

**Gamma API规范:**
```
type: array<string> (maxItems: 10)
将生成结果放入指定文件夹
```

**省心PPT现状:**
- ⚠️ 未传 `folderIds`
- 生成结果默认在用户根目录
- 💡 建议：如有文件夹管理需求，可添加此参数

---

## 📊 参数对比表

| 参数 | Gamma API规范 | 省心PPT现状 | 状态 |
|------|--------------|------------|------|
| `themeId` | 标准主题ID | ✅ 已映射 | ✅ PASS |
| `fontId` | ❌ 不支持 | ❌ 未使用 | ✅ PASS |
| `colorSchemeId` | ❌ 不支持 | ❌ 未使用 | ✅ PASS |
| `format` | enum: presentation等 | ✅ presentation | ✅ PASS |
| `cardOptions.dimensions` | enum: 16x9等 | ✅ 16x9 | ✅ PASS |
| `textMode` | enum: generate/condense/preserve | ✅ preserve | ✅ PASS |
| `textOptions.amount` | enum: brief/medium等 | ✅ medium | ✅ PASS |
| `textOptions.tone` | string (maxLength: 500) | ✅ 自由文本 | ✅ PASS |
| `textOptions.audience` | string (可选) | ⚠️ 未使用 | ⚠️ OPTIONAL |
| `textOptions.language` | enum: zh-cn等 | ✅ zh-cn | ✅ PASS |
| `imageOptions.source` | enum: 10种 | ✅ 有效值 | ✅ PASS |
| `imageOptions.model` | enum: 30+模型 | ✅ imagen-3-flash | ✅ PASS |
| `imageOptions.style` | string (maxLength: 5000) | ✅ 风格描述 | ✅ PASS |
| `sharingOptions` | object (可选) | ⚠️ 未使用 | ⚠️ OPTIONAL |
| `cardSplit` | enum: inputTextBreaks/auto | ✅ inputTextBreaks | ✅ PASS |
| `additionalInstructions` | string (maxLength: 5000) | ✅ ~2000字符 | ✅ PASS |
| `numCards` | number (min: 1) | ✅ 8 | ✅ PASS |
| `exportAs` | enum: pptx/pdf/png | ✅ pdf | ✅ PASS |
| `folderIds` | array (可选) | ⚠️ 未使用 | ⚠️ OPTIONAL |

---

## 🔧 V10.14修复清单

1. ✅ 新增 `gamma-theme-mapping.ts`（102个Gamma标准主题）
2. ✅ 修改 `gamma/route.ts`：import + 调用 `getGammaThemeId()`
3. ✅ 修改 `gamma-direct/route.ts`：import + 调用 `getGammaThemeId()`
4. ✅ 创建参数审查报告 `GAMMA-PARAMS-AUDIT.md`

---

## 💡 未来优化建议

### 优先级 P1（建议近期实现）
- 添加 `textOptions.audience` 支持（场景选择时传入）
- 验证 `imageOptions.source: 'pictographic'` 稳定性

### 优先级 P2（可选）
- 添加 `sharingOptions` 支持（权限管理）
- 添加 `folderIds` 支持（文件夹分类）

### 优先级 P3（长期）
- 调用 `/themes` API 动态获取主题列表（替代静态映射）

---

## 📚 参考文档

- [Gamma API官方文档](https://developers.gamma.app/)
- [POST /generations](https://developers.gamma.app/generations/create-generation)
- [Image models](https://developers.gamma.app/reference/image-model-accepted-values)
- [Output languages](https://developers.gamma.app/reference/output-language-accepted-values)

---

_审查完成: 2026-04-26 | v10.14_