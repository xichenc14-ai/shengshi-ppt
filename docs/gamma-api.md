# Gamma API 技术文档

> 整理自 https://developers.gamma.app/
> 最后更新：2026-04-20

---

## 概述

Gamma API 通过单次调用生成 **演示文稿（presentation）、文档（document）、网页（webpage）和社会化内容（social）**，支持品牌定制、导出和分享。

**基础 URL：** `https://public-api.gamma.app/v1.0`

---

## 认证

**请求头（必须）：**

| 请求头 | 值 | 必填 |
|--------|-----|------|
| `X-API-KEY` | 你的 API Key | ✅ |
| `Content-Type` | `application/json` | POST 请求必填 |

> ⚠️ **401 常见原因：** Gamma 使用自定义请求头 `X-API-KEY`，**不是** `Authorization: Bearer`。

**Key 获取地址：** https://gamma.app/settings/api-keys

**权限要求：** Pro / Ultra / Teams / Business plan（部分 Connector 无需 API Key）

**Machine-readable docs：** https://developers.gamma.app/llms.txt

---

## 快速开始

### 第一步：发起生成

```bash
curl -X POST https://public-api.gamma.app/v1.0/generations \
  -H "Content-Type: application/json" \
  -H "X-API-KEY: $GAMMA_API_KEY" \
  -d '{
    "inputText": "Q3 产品发布策略",
    "textMode": "generate",
    "format": "presentation",
    "numCards": 10,
    "exportAs": "pdf"
  }'
```

**响应：**

```json
{
  "generationId": "abc123xyz"
}
```

### 第二步：轮询结果

轮询 `GET /v1.0/generations/{generationId}`，每 5 秒一次，直到 `status` 变为 `completed` 或 `failed`。

**轮询响应（completed）：**

```json
{
  "generationId": "abc123xyz",
  "status": "completed",
  "gammaUrl": "https://gamma.app/docs/abc123",
  "exportUrl": "https://gamma.app/export/abc123.pdf",
  "credits": {
    "deducted": 15,
    "remaining": 485
  }
}
```

### 第三步：使用产物

- 在线访问：`gammaUrl`
- 导出文件：`exportUrl`（如果指定了 `exportAs`）

---

## 接口列表

| 接口 | 方法 | 说明 |
|------|------|------|
| `/generations` | POST | 从文本生成 |
| `/generations/from-template` | POST | 从模板生成 |
| `/generations/{id}` | GET | 查询生成状态 |
| `/themes` | GET | 列出工作区主题 |
| `/folders` | GET | 列出工作区文件夹 |

---

## POST /generations — 从文本生成

### 请求体参数

| 参数 | 类型 | 说明 |
|------|------|------|
| `inputText` | string | 输入内容或指令 |
| `textMode` | string | `generate`（生成）/ `condense`（压缩）/ `preserve`（保留） |
| `format` | string | `presentation` / `document` / `webpage` / `social` |
| `numCards` | number | 卡片张数（PPT页数） |
| `exportAs` | string | 导出格式：`pdf` / `pptx` / `png` |
| `themeId` | string | 主题 ID（可选，从 `/themes` 获取） |
| `imageOptions.source` | string | `aiGenerated` / `webFreeToUseCommercially` / `noImages` |
| `textOptions.tone` | string | 语气（可选） |
| `textOptions.audience` | string | 受众（可选） |
| `textOptions.language` | string | 语言（可选，见语言参考表） |
| `sharingOptions.accessLevel` | string | `workspace` / `anyone_with_link` / `anyone_on_internet` |
| `folderIds` | string[] | 文件夹 ID 数组（可选） |

### 返回字段

| 字段 | 说明 |
|------|------|
| `generationId` | 生成任务 ID，用于后续查询 |
| `status` | `processing` / `completed` / `failed` |
| `gammaUrl` | 在线链接 |
| `exportUrl` | 导出文件下载链接 |
| `credits.deducted` | 本次消耗积分 |
| `credits.remaining` | 剩余积分 |
| `error` | 失败时错误信息 |

---

## POST /generations/from-template — 从模板生成

使用已有的 Gamma 模板作为基础，程序化生成变体。

（详细参数见官方文档：https://developers.gamma.app/generations/create-from-template）

---

## GET /generations/{id} — 查询生成状态

无需请求体，直接在 URL 带 `generationId`。

轮询建议：每 5 秒一次，超时时间建议 3 分钟。

---

## GET /themes — 列出工作区主题

返回当前工作区所有可用主题 ID 和名称。

```bash
curl -X GET https://public-api.gamma.app/v1.0/themes \
  -H "X-API-KEY: $GAMMA_API_KEY"
```

---

## GET /folders — 列出工作区文件夹

返回当前工作区的文件夹结构，用于将生成内容归档到指定文件夹。

---

## 积分体系

- 积分在生成完成时扣除
- 响应中包含 `credits.deducted` 和 `credits.remaining`
- 积分不足时返回 `403`，需前往 https://gamma.app/settings/billing 充值

---

## 错误码

| HTTP 状态码 | 错误信息 | 说明 |
|------------|---------|------|
| 400 | Input validation errors | 参数校验失败，检查请求参数 |
| 401 | Invalid API key | API Key 无效或无权限 |
| 403 | Insufficient credits remaining | 积分不足，充值：gamma.app/settings/billing |
| 403 | Forbidden | 无权限访问该资源，或功能不在当前套餐内 |
| 404 | Generation ID not found | 生成任务 ID 不存在 |
| 422 | Failed to generate text | 生成内容为空，输入不清晰或指令不明确 |
| 429 | Too many requests | 请求超限，等待后重试 |
| 500 | An error occurred while generating | 服务端异常，联系支持并提供 `x-request-id` |
| 502 | Bad gateway | 临时性网关错误，重试 |

---

## MCP 服务（AI 工具集成）

Gamma 提供 MCP（Model Context Protocol）服务器，允许 AI 工具：
- 通过 OAuth + Dynamic Client Registration 创建新 Gamma
- 读取已有 Gamma 内容

文档：https://developers.gamma.app/mcp/gamma-mcp-server

---

## Connectors（无需 API Key）

部分平台集成（如 Zapier、Make）无需 API Key，适合低代码自动化场景。

文档：https://developers.gamma.app/connectors/connectors-and-integrations

---

## 官方参考链接

| 资源 | 地址 |
|------|------|
| 官方文档首页 | https://developers.gamma.app/ |
| API Key 管理 | https://gamma.app/settings/api-keys |
| 积分管理 | https://gamma.app/settings/billing |
| MCP 服务 | https://developers.gamma.app/mcp/gamma-mcp-server |
| llms.txt | https://developers.gamma.app/llms.txt |
