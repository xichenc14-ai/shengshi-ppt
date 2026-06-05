# MiniMax API 官方文档

> **版本**: v1.2
> **来源**: https://www.minimaxi.com/document
> **最后更新**: 2026-05-10
> **状态**: 已调研

---

## 基本信息

- **API Endpoint**: `https://api.minimaxi.com/v1/chat/completions`
- **认证方式**: `Authorization: Bearer ${API_KEY}` header
- **用途**: 文本生成、大纲生成、内容分析

---

## 可用模型

| 模型 | 用途 | 上下文窗口 | 输出限制 |
|------|------|-----------|----------|
| MiniMax-M2.7 | 文本对话 | **200K tokens** | 8192 tokens |
| MiniMax-M2 | 文本对话 | 200K tokens | 8192 tokens |
| MiniMax-VL-01 | 图片理解 | - | - |
| image-01 | 图片生成 | - | - |

### 在省心PPT中的使用

| 场景 | 使用的模型 | 说明 |
|------|-----------|------|
| outline API（大纲生成） | MiniMax-M2.7 | 200K上下文，8192输出 |
| 图片理解（understand-image） | MiniMax-VL-01 | 多模态模型 |
| 图片生成 | image-01 | 通过 REST API 调用 |

---

## 调用示例

```typescript
// 项目中的调用方式（outline API）
const response = await fetch('https://api.minimaxi.com/v1/chat/completions', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${MINIMAX_API_KEY}`
  },
  body: JSON.stringify({
    model: "MiniMax-M2.7",
    messages: [
      { role: "system", content: "系统提示" },
      { role: "user", content: "用户输入" }
    ],
    temperature: 0.7,
    max_tokens: 8192
  })
});
```

### 图片输入格式

MiniMax-VL-01 支持 base64 图片输入：

```typescript
{
  model: "MiniMax-VL-01",
  messages: [
    {
      role: "user",
      content: [
        { type: "image_url", image_url: { url: "data:image/jpeg;base64,..." } },
        { type: "text", text: "请描述这张图片" }
      ]
    }
  ]
}
```

---

## 输入格式支持

| 格式 | 支持情况 | 说明 |
|------|---------|------|
| 纯文本 | ✅ 是 | 最常用 |
| Markdown | ✅ 是 | 可处理 |
| Base64图片 | ✅ 是 | 通过 image_url 类型 |
| 文件上传 | ❌ 否 | 需 base64 编码 |

---

## 上下文窗口与输出限制

| 参数 | 值 | 说明 |
|------|-----|------|
| 上下文窗口 | **200K tokens** | 输入+输出共享（根据兮晨哥哥反馈更正） |
| 输出限制 | 8192 tokens | 单次最大输出 |
| Temperature | 0.0-1.0 | 默认0.7 |

> **注意**：虽然上下文窗口达到 200K，但输出限制仍为 8192 tokens。当输入文本较长时，实际可用输出空间 = 8192 - 输入token数。建议输入文本控制在 10万字以内。

---

## 速率限制

> 参考值（具体以账户实际限制为准）：
> - 标准账户：60 RPM
> - 企业账户：请咨询 MiniMax

---

## 在项目中的使用场景

1. **outline API** (`/api/outline`) - 生成 PPT 大纲，textMode=generate/condense/preserve
2. **understand-image API** (`/api/understand-image`) - 图片内容理解

---

## 架构决策

### AI 统一使用 MiniMax

省心PPT已在 v10.45 版本中统一所有 AI 服务至 MiniMax：
- 移除 GLM（智谱）客户端
- 移除 Kimi（月之暗面）客户端
- 统一使用 MiniMax-M2.7 进行文本生成
- 图片理解使用 MiniMax-VL-01

**原因**：兮晨哥哥要求统一使用原生 MiniMax key，简化架构，降低多provider维护成本。

---

## 更新日志

| 日期 | 版本 | 更新内容 |
|------|------|----------|
| 2026-05-10 | v1.2 | 上下文窗口更正为 200K（官网数据） |
| 2026-05-10 | v1.1 | 补充架构决策、AI统一说明 |
| 2026-05-10 | v1.0 | 初始文档 |
