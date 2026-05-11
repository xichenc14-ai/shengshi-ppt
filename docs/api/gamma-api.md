# Gamma API 官方文档备份

> **版本**: v1.1
> **来源**: https://gamma.app/docs 或官方渠道
> **最后更新**: 2026-05-10
> **状态**: 已调研

---

## 基本信息

- **API Base URL**: `https://public-api.gamma.app/v1.0`
- **认证方式**: `X-API-KEY` header
- **用户代理**: `Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36`

---

## 创建生成任务 (POST /generations)

### 请求格式
```json
{
  "inputText": "string",
  "textMode": "preserve | generate | condense",
  "format": "presentation",
  "numCards": 8,
  "exportAs": "pptx | pdf",
  "themeId": "string",
  "additionalInstructions": "string",
  "textOptions": {
    "amount": "brief | medium | full",
    "tone": "string",
    "language": "zh-cn"
  },
  "imageOptions": {
    "source": "noImages | themeAccent | webFreeToUseCommercially | aiGenerated | pictographic",
    "prompt"?: "string"
  },
  "cardOptions": {
    "dimensions": "16x9 | 4x3"
  }
}
```

### textMode 行为说明

| 模式 | 行为 | 说明 |
|------|------|------|
| preserve | 保留原文 | 严格按照输入分页，不扩写不精简 |
| generate | AI扩充 | 根据主题从零生成内容 |
| condense | AI精简 | 提炼核心内容，压缩篇幅 |

### textMode 在省心PPT架构中的使用

> **重要架构决策**：省心PPT的Gamma API textMode固定为 `'preserve'`。

**原因**：
- 省心PPT的内容扩写/精简逻辑在 `outline API` 预处理阶段完成
- outline API 根据用户选择的 textMode（generate/condense/preserve）生成对应风格的大纲
- Gamma API 在此架构中仅承担**排版渲染**职责，不做内容创作
- 将 textMode 固定为 preserve 确保Gamma忠实呈现outline API已处理的内容

### 附件格式支持

> **仅支持 Markdown 文本**，不支持文件上传附件。
> inputText 直接传入 Markdown 格式的字符串内容。

### 限制参数

| 参数 | 限制值 | 说明 |
|------|--------|------|
| numCards | 1-100 | 建议8-20 |
| inputText | - | 建议单次不超过5000字 |
| numCards * inputText | - | 总内容限制：建议不超过40000字 |

---

## 查询生成状态 (GET /generations/{id})

### 响应格式
```json
{
  "id": "string",
  "status": "pending | completed | failed",
  "exportUrl"?: "string",
  "gammaUrl"?: "string",
  "error"?: "string"
}
```

---

## 轮询策略

- **轮询间隔**: 3秒
- **超时时间**: 180秒（3分钟）
- **最大轮询次数**: 60次

---

## imageOptions.source 可选值

| 值 | 说明 | Credits |
|----|------|---------|
| noImages | 纯文字，无图片 | 免费 |
| themeAccent | 主题强调图（Gamma内置） | 免费 |
| webFreeToUseCommercially | 网络免费商用图片 | 免费 |
| aiGenerated | AI生成图片 | 2-10 credits/图 |
| pictographic | 插图模式 | 免费 |

### 深色主题配图注意事项

深色主题（founder/aurora/electric/blues/gamma/luxe/aurum）下 `themeAccent` 可能显示为占位符，建议改用 `webFreeToUseCommercially`。

---

## 已知问题

1. **slides 参数**: 不支持，会导致 400 错误
2. **深色主题配图**: 深色主题下 themeAccent 显示占位符，建议改用 webFreeToUseCommercially
3. **inputTextBreaks 参数**: 已废弃，使用可能导致空白页

---

## 速率限制

> 待确认（建议实现密钥池轮询 + 熔断降级）

---

## 更新日志

| 日期 | 版本 | 更新内容 |
|------|------|----------|
| 2026-05-10 | v1.1 | 补充 textMode 架构说明、附件格式、已知限制 |
| 2026-05-10 | v1.0 | 初始文档 |
