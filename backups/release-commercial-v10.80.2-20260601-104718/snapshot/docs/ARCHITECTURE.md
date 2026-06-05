# 省心PPT 系统架构文档

> 版本：v1.0 | 日期：2026-04-26 | 作者：Architecture Research Subagent
> 基于代码库完整分析，不改任何代码

---

## 1. 系统架构图

```
┌─────────────────────────────────────────────────────────────────────┐
│                         前端 (Next.js SSR/CSR)                       │
│  page.tsx (1993行, 单文件巨型组件)                                    │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────────────┐     │
│  │ Landing  │→ │  Input   │→ │ Streaming │→ │ Outline Editor  │     │
│  │  Page    │  │  Phase   │  │  Phase    │  │  (Drag & Drop)  │     │
│  └──────────┘  └──────────┘  └──────────┘  └───────┬──────────┘     │
│                                                     │                │
│                              ┌──────────────────────┘                │
│                              ↓                                       │
│                     ┌──────────────────┐                            │
│                     │  Generating      │ ← 轮询 /api/gamma          │
│                     │  Progress        │                            │
│                     └───────┬──────────┘                            │
│                             ↓                                       │
│                     ┌──────────────────┐                            │
│                     │  Result Page     │ → 预览(PPTX) / 下载(PDF)   │
│                     └──────────────────┘                            │
├─────────────────────────────────────────────────────────────────────┤
│                      API Routes (Next.js App Router)                 │
│                                                                     │
│  ┌─────────────┐  ┌─────────────┐  ┌──────────────┐               │
│  │ /api/outline│  │ /api/gamma  │  │ /api/gamma-  │               │
│  │ (AI大纲生成)│  │ (创建生成)  │  │ direct(直通) │               │
│  └──────┬──────┘  └──────┬──────┘  └──────────────┘               │
│         │                │                                          │
│  ┌──────┴──────┐  ┌──────┴──────┐  ┌──────────────┐               │
│  │ /api/       │  │ /api/       │  │ /api/        │               │
│  │ parse-file  │  │ export-pptx │  │ download-pdf │               │
│  │ (文件解析)  │  │ (PPTX下载)  │  │ (PDF下载)    │               │
│  └─────────────┘  └─────────────┘  └──────────────┘               │
│                                                                     │
│  ┌─────────────┐  ┌─────────────┐  ┌──────────────┐               │
│  │ /api/export │  │ /api/proxy- │  │ /api/preview │               │
│  │ (统一导出)  │  │ pdf(预览)   │  │ (预览信息)   │               │
│  └─────────────┘  └─────────────┘  └──────────────┘               │
├─────────────────────────────────────────────────────────────────────┤
│                      AI Client Layer (lib/)                         │
│  ┌────────────┐  ┌────────────┐  ┌────────────┐                   │
│  │ kimi-client│  │ minimax-   │  │ glm-client │  3级 fallback     │
│  │ (Kimi K2.5)│→ │ client     │→ │ (GLM-5)   │  链               │
│  └────────────┘  │ (MiniMax   │  └────────────┘                   │
│                  │  M2.7)     │                                    │
│                  └────────────┘                                    │
├─────────────────────────────────────────────────────────────────────┤
│                      外部服务                                        │
│  ┌─────────────────────┐  ┌─────────────┐  ┌───────────┐         │
│  │ Gamma API           │  │ Supabase    │  │ 微信支付   │         │
│  │ (PPT生成+导出)      │  │ (用户/历史) │  │ (支付回调) │         │
│  │ Key Pool 多Key轮换  │  │             │  │           │         │
│  └─────────────────────┘  └─────────────┘  └───────────┘         │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 2. 数据流图

### 2.1 省心模式（Smart Mode）完整链路

```
用户输入（文本 + 可选附件）
    │
    ▼
[前端] fileProcess() ─────────────────────────────┐
    │                                               │
    ├─ 文本文件(.txt/.md/.csv) → 直接读取content   │
    ├─ 图片 → /api/understand-image → AI识别文字   │
    ├─ PDF/Word/Excel/PPT → /api/parse-file → 解析  │
    └─ 结果存入 files[] state                       │
                                                    │
[前端] collectText() ←─────────────────────────────┘
    │ 拼接所有文件content + topic文本
    ▼
[前端] generateOutline()
    │ mode='smart', textMode='preserve', auto=true
    │ + AbortController 2分钟超时
    ▼
[API] POST /api/outline
    │ 输入: {inputText, slideCount, textMode:'preserve', auto:true}
    │ 内部: analyzeInputType() → 智能判断recommendedMode
    │ AI调用链: Kimi K2.5 → MiniMax M2.7 → GLM-5 (fallback)
    │ 输出: {title, slides[], themeId, tone, imageMode, scene}
    │ maxDuration: 180s
    ▼
[前端] streamingSlides 显示 → 等待 → outline确认页
    │ smartGammaPayload 存储 AI 推荐参数
    │ 用户可编辑: 主题/语气/配图/大纲内容
    ▼
[前端] confirmAndGenerate()
    │ 权限检查 → 积分扣除(/api/user deduct)
    │ buildMdV2() 构建 Gamma Markdown
    ▼
[API] POST /api/gamma
    │ 输入: {inputText(markdown), textMode:'preserve', exportAs:'pptx',
    │       themeId, tone, imageMode, visualMetaphor, imageOptions}
    │ → Gamma API POST /v1.0/generations
    │ → Key Pool 选择最佳Key
    │ → 429退避重试(最多3次)
    │ 输出: {generationId}
    ▼
[前端] 轮询 GET /api/gamma?id={generationId}
    │ 每3秒轮询, 最长180秒
    │ Gamma API GET /v1.0/generations/{id}
    │ status: pending → in_progress → completed
    │ 输出: {status, exportUrl, gammaUrl, credits}
    ▼
[前端] Result Page
    │ 保存历史(/api/history save)
    │ 获取预览链接(/api/preview-proxy)
    │
    ├─ 下载PPT: /api/export-pptx (代理下载exportUrl)
    ├─ 下载PDF: /api/download-pdf (创建PDF导出→轮询→代理下载)
    └─ 在线预览: gammaUrl (新标签页打开)
```

### 2.2 专业模式（Direct Mode）完整链路

```
用户输入（文本 + 参数: 主题/语气/配图/页数/文本模式）
    │
    ▼
[前端] handleGeneratePPT() → generateOutline()
    │ mode='direct', textMode=用户选择(generate/condense/preserve)
    ▼
[API] POST /api/outline
    │ 同省心模式, 但auto=false, 使用用户选择的textMode
    │ 输出: {title, slides[], themeId, tone, imageMode}
    ▼
[前端] 大纲确认页（v10.7.1后所有模式都经过此页）
    │ 用户编辑大纲 + 可修改主题/配图
    ▼
[前端] confirmAndGenerate()
    │ 同省心模式, 但 originalTextMode=directTextMode
    ▼
[API] POST /api/gamma → 轮询 → Result Page
    │ （同省心模式后半段）
```

### 2.3 文件解析数据流

```
[前端] fileProcess()
    │
    ├─ .txt/.md/.csv → f.text() 直接读取
    │
    ├─ 图片(.png/.jpg/.jpeg/.webp)
    │   → base64编码
    │   → POST /api/understand-image
    │   → MiniMax VL-01 图片理解
    │   → 返回文字描述
    │
    ├─ .pdf
    │   → POST /api/parse-file (FormData)
    │   → pdfjs-dist 解析 (服务端)
    │   → 提取每页文字
    │   → 截断8000字符
    │
    ├─ .docx/.doc
    │   → POST /api/parse-file
    │   → mammoth extractRawText
    │
    ├─ .xlsx/.xls
    │   → POST /api/parse-file
    │   → xlsx库解析
    │
    ├─ .pptx/.ppt
    │   → POST /api/parse-file
    │   → JSZip解压 → XML提取<a:t>标签文字
    │
    └─ 结果: {name, type, size, content: string}
        │
        ├─ 如果 content 包含"解析失败/扫描件/无文字" → alert并跳过
        └─ 否则 → 加入 files[] 数组
```

---

## 3. API 清单

### 3.1 核心业务 API

| API | 方法 | 职责 | 输入 | 输出 | 错误处理 |
|-----|------|------|------|------|---------|
| `/api/outline` | POST | AI生成PPT大纲 | inputText, slideCount, textMode, auto | {title, slides[], themeId, tone, imageMode} | 400/429/500, AI 3级fallback |
| `/api/gamma` | POST | 创建Gamma生成任务 | inputText, textMode, format, numCards, exportAs, themeId, additionalInstructions, imageOptions | {generationId, config, credits} | 400/429/502, 3次429退避 |
| `/api/gamma` | GET | 查询Gamma生成状态 | ?id={generationId} | {status, exportUrl, gammaUrl, credits} | 400/502/500 |
| `/api/gamma-direct` | POST | 直通模式(跳过大纲) | inputText, themeId, numCards, tone, textMode, exportAs | {generationId, credits} | 400/429/502, 3次退避 |
| `/api/parse-file` | POST | 服务端文件解析 | FormData(file) | {text, fileName, fileSize, charCount} | 400/429/500, 双引擎PDF |
| `/api/smart-outline` | POST | 省心模式V3(未使用?) | inputText, uploadedFiles[] | {analysis, config, gammaScript} | 400/429/500 |

### 3.2 导出/下载 API

| API | 方法 | 职责 | 输入 | 输出 | 错误处理 |
|-----|------|------|------|------|---------|
| `/api/export-pptx` | GET | PPTX下载(代理) | ?generationId, ?name | 二进制PPTX文件 | 400/404/502/504 |
| `/api/download-pdf` | GET | PDF下载(代理) | ?generationId, ?name | 二进制PDF文件 | 400/404/502/504, fallbackPptx |
| `/api/export-pdf` | GET | PDF导出(代理) | ?generationId, ?name | 二进制PDF文件 | 400/404/502/504, fallbackPptx |
| `/api/export-watermarked` | GET | 水印PDF(免费用户) | ?generationId, ?name | 水印PDF文件 | 400/404/502/500 |
| `/api/export` | GET | 统一导出 | ?file= 或 ?url= | 二进制文件 | 400/403/404/502/504, SSRF防护 |
| `/api/proxy-pdf` | GET | PDF预览代理(内联) | ?id={generationId} | 二进制PDF | 202/400/404/502/504 |

### 3.3 预览 API

| API | 方法 | 职责 | 输入 | 输出 | 错误处理 |
|-----|------|------|------|------|---------|
| `/api/preview` | GET | 预览信息(gammaUrl) | ?id={generationId} | {gammaUrl, exportUrl, status} | 400/500/504 |
| `/api/preview-proxy` | GET | HTML代理(旧) | ?url={gammaUrl} | HTML(域名替换) | 400/502/500 |
| `/api/preview-images` | GET | 图片序列预览 | ?generationId | {status, images[], gammaUrl} | 400/404/500 |
| `/api/preview-async` | GET | 异步预览下载 | ?generationId, ?format | {status, previewUrl} | 400/404/500 |

### 3.4 用户/支付/系统 API

| API | 方法 | 职责 | 输入 | 输出 |
|-----|------|------|------|------|
| `/api/user` | POST | 积分扣除/回滚/更新 | {action, userId, credits} | {balance, error} |
| `/api/session` | GET/POST | 用户会话 | token | {user} |
| `/api/credits` | GET | 积分查询 | ?userId | {balance, plan} |
| `/api/history` | GET/POST | 生成历史 | userId / {action, userId} | 历史列表 |
| `/api/download` | GET/POST | 下载权限/计数 | userId / {action, userId} | {allowed, cost} |
| `/api/payment` | POST | 发起支付 | {planId, userId} | {paymentUrl} |
| `/api/payment-notify` | POST | 支付回调 | 微信支付通知 | success |
| `/api/paddle-webhook` | POST | Paddle回调 | Paddle webhook | success |
| `/api/gamma-balance` | GET | Key余额监控 | - | {keys[], totalRemaining} |
| `/api/health` | GET | 健康检查 | - | {status} |
| `/api/upload` | POST | 文件上传(旧) | FormData | {name, content} |
| `/api/understand-image` | POST | 图片AI理解 | {image(base64), mimeType} | {text} |

---

## 4. Gamma API 集成

### 4.1 使用的 Gamma API

| Gamma API | 方法 | 用途 | 调用位置 |
|-----------|------|------|---------|
| `/v1.0/generations` | POST | 创建PPT生成任务 | gamma/route.ts, gamma-direct/route.ts |
| `/v1.0/generations/{id}` | GET | 查询生成状态 | gamma/route.ts (GET), proxy-pdf, download-pdf, export-pdf, export-pptx, preview |
| `/v1.0/generations/{id}/exports` | POST | 创建PDF导出任务 | proxy-pdf, download-pdf, export-pdf |
| `/v1.0/generations/{id}/exports/{exportId}` | GET | 查询PDF导出状态 | proxy-pdf, download-pdf, export-pdf |

### 4.2 请求参数（实际使用）

```typescript
// POST /v1.0/generations payload
{
  inputText: string,          // Markdown内容(由buildMdV2构建)
  textMode: 'preserve',       // 固定preserve(V8.2)
  format: 'presentation',     // 固定
  numCards: number,           // 页数
  exportAs: 'pptx',          // 固定pptx(V10.11)
  themeId: string,            // 主题ID
  additionalInstructions: string,  // 排版指令(很长,包含CRITICAL规则)
  imageOptions: {
    source: string,           // 'themeAccent'|'webFreeToUseCommercially'|'aiGenerated'|'noImages'
    themeId?: string,         // 深色主题时额外传
  },
  // V10.8已移除(未文档化): cardOptions, cardSplit
}
```

### 4.3 Gamma API 响应结构

```typescript
// POST /v1.0/generations 响应
{
  generationId: string,      // 用于后续查询
  credits?: {
    deducted: number,
    remaining: number
  }
}

// GET /v1.0/generations/{id} 响应
{
  generationId: string,
  status: 'pending' | 'in_progress' | 'processing' | 'completed' | 'failed',
  gammaUrl: string,           // 在线预览链接
  exportUrl: string,          // PPTX下载链接(生成完成后)
  credits?: { deducted, remaining },
  error?: string              // 失败时
}
```

### 4.4 Key Pool 机制

```
gamma-key-pool.ts
├── selectBestKey()      → 选择余额最多/失败最少的Key
├── updateKeyBalance()   → 更新积分余额
├── recordKeyFailure()   → 记录失败(用于退避)
└── getKeyPoolStatus()   → 监控查询(管理用)
```

- 多个 API Key 轮换，避免单Key限流
- 429时自动切换Key重试（最多3次，指数退避）
- Rate-Limit Header 读取（X-RateLimit-Remaining, X-RateLimit-Reset）

---

## 5. 错误处理现状

### 5.1 错误处理矩阵

| 模块 | try/catch | 超时机制 | 降级策略 | 静默失败风险 |
|------|-----------|---------|---------|------------|
| **outline API** | ✅ | ✅ 120s (AbortController) | ✅ 3级AI fallback | ⚠️ JSON解析失败日志但可能丢失根因 |
| **gamma API** | ✅ | ❌ 无fetch超时 | ✅ 429退避3次 | ⚠️ 非network错误无超时保护 |
| **gamma-direct** | ✅ | ❌ 无fetch超时 | ✅ 429退避3次 | ⚠️ 同上 |
| **parse-file** | ✅ | ❌ 无 | ✅ pdfjs双引擎 | ⚠️ Word解析失败返回200+提示文本 |
| **parse-file (Word)** | ✅ | ❌ 无 | ❌ 无fallback | ⚠️ mammoth失败→静默返回友好文本,前端可能不检测 |
| **export-pptx** | ✅ | ✅ 120s (AbortController) | ❌ 无 | ⚠️ Content-Type检查(v10.11) |
| **download-pdf** | ✅ | ✅ 60s (前端) + 120s (后端) | ✅ fallbackPptx | ✅ 降级合理 |
| **proxy-pdf** | ✅ | ✅ 120s (AbortController) | ✅ 回退到PPTX | ✅ 降级合理 |
| **preview** | ✅ | ✅ 30s (AbortSignal) | ❌ 无 | ⚠️ 超时返回504 |
| **preview-images** | ✅ | ❌ 无fetch超时 | ✅ gammaUrl fallback | ⚠️ 无超时保护 |
| **preview-async** | ✅ | ✅ 60s (AbortController) | ❌ 无 | ⚠️ Vercel只读文件系统问题 |
| **preview-proxy** | ✅ | ❌ 无 | ❌ 无 | ⚠️ Gamma HTML代理可能被反爬 |
| **前端轮询** | ✅ | ✅ 180s | ❌ 无 | ⚠️ 超时后直接throw |
| **积分扣除** | ✅ | ❌ 无fetch超时 | ✅ 生成失败回滚 | ⚠️ 扣除成功但Gamma调用前失败→已扣未回滚? |
| **understand-image** | ✅ | ❌ 无 | ❌ 无 | ⚠️ 5MB限制, 10次/日限制 |

### 5.2 关键发现

1. **gamma/gamma-direct API 调用无fetch超时**: 如果Gamma API挂起(不返回也不超时)，服务端会一直等待直到Vercel函数超时(默认15s，maxDuration已设为180s)。
2. **Word解析静默失败**: mammoth解析失败时返回200+友好文本，前端需要检查文本内容判断是否成功。
3. **积分扣除与生成非原子**: 扣除积分后，Gamma调用失败时回滚，但扣减和回滚之间存在竞态条件窗口。
4. **smart-outline API 存在但前端未使用**: 代码中有 `/api/smart-outline` V3重构版本，但实际前端走的是 `/api/outline`。

---

## 6. 已知问题根因分析

### 6.1 专业模式传附件出不来大纲

**Trace 完整数据流：**

```
1. 用户上传文件(如PDF) → 前端 fileProcess()
2. fileProcess() 调用 POST /api/parse-file
3. parse-file 使用 pdfjs-dist 解析PDF
4. 返回 {text, fileName, fileSize, charCount}
5. ⚠️ 关键检查点: 如果 text 包含 "解析失败|扫描件|无文字" → alert并continue(跳过文件)
6. 文件加入 files[] 数组
7. collectText() 拼接: "[文件名]\n{content}\n\n{topic}"
8. generateOutline() 调用 POST /api/outline
   - inputText = collectText() 的结果
   - slideCount = pages state
   - textMode = directTextMode (generate/condense/preserve)
   - auto = false
9. outline API 内部:
   - analyzeInputType() 分析输入类型
   - ⚠️ 如果auto=false，不执行智能分析，直接用传入的textMode
   - AI调用: Kimi → MiniMax → GLM (fallback链)
   - 返回 {title, slides[], themeId, tone, imageMode}
```

**可能的根因：**

1. **文件解析内容为空或无意义**: 如果PDF是扫描件，pdfjs返回"[PDF: xxx, 扫描件/无文字内容]"，前端检测到关键词后`continue`跳过，文件不加入列表→但用户以为上传成功了。
2. **截断导致信息丢失**: parse-file截断8000字符，长文档后半部分丢失。
3. **collectText拼接问题**: 文件内容+topic文本拼接后可能超过10000字符限制，outline API直接拒绝。
4. **AI解析JSON失败**: 如果文件内容特殊(如大量数字/表格)，AI返回的JSON可能格式错误。
5. **AbortController超时**: 2分钟超时可能不够(大文件+复杂AI生成)。

**诊断建议：** 在 collectText() 后、调用 outline 前添加 console.log 查看实际发送的 inputText 内容和长度。

### 6.2 预览问题

**Trace: preview-pdf → proxy-pdf 链路**

```
v10.13 重写说明(Git commit message):
"Gamma API GET /generations/{id} 不返回 cards/previewUrl 字段
(API 仅返回 generationId, status, gammaUrl, exportUrl, credits)
所以 v10.9 方案（从 cards 提取图片）永远返回空数组"

当前预览方案:
1. GET /api/preview?id={generationId}
   → 调用 Gamma API GET /generations/{id}
   → 返回 {gammaUrl, exportUrl, status}
   → 前端在新标签页打开 gammaUrl

2. ⚠️ Gamma网站 X-Frame-Options: SAMEORIGIN → iframe不可行
   → 唯一可行: window.open(gammaUrl, '_blank')

3. GET /api/proxy-pdf?id={generationId}
   → 查询Gamma状态
   → 创建PDF导出(POST /v1.0/generations/{id}/exports)
   → 轮询PDF导出(最多20次, 每次2秒)
   → 代理下载PDF
   → 返回二进制流给iframe/embed
   → ⚠️ 但前端目前不使用此API做预览!
```

**根因：** Gamma API 限制（不返回卡片预览数据）+ Gamma 网站禁止 iframe 嵌入。

**当前方案：** 只能通过新标签页打开 gammaUrl 在线预览。

**遗留问题：**
- `/api/preview-images` 依赖 `cards` 字段，但 Gamma API 不返回 → 永远返回空数组
- `/api/preview-async` 依赖 `exportUrl` 下载到本地 → Vercel 文件系统只读
- `/api/preview-proxy` 做 HTML 域名替换代理 → 但 Gamma 可能有反爬/JS依赖

### 6.3 PDF下载问题

**Trace: export-pdf → download-pdf 链路**

```
1. 前端 handleExportPDF()
   → fetch /api/download-pdf?generationId=xxx&name=xxx.pdf
   → 60秒超时(AbortController)

2. /api/download-pdf (后端):
   Step 1: 查询Gamma状态
   → GET /v1.0/generations/{id}
   → 检查status (pending/in_progress → 400, failed → 500)

   Step 2: 创建PDF导出
   → POST /v1.0/generations/{id}/exports {format: 'pdf'}
   → ⚠️ Gamma默认生成PPTX, PDF需要额外转换
   → 可能返回: {url} 直接可用, 或 {id} 需要轮询

   Step 3: 如果需要轮询
   → GET /v1.0/generations/{id}/exports/{exportId}
   → 最多20次, 每次2秒 = 最多40秒

   Step 4: 代理下载PDF
   → fetch(pdfUrl, 120秒超时)
   → 检查Content-Type(防JSON错误)
   → 返回attachment(强制下载)

   ⚠️ 如果PDF不可用:
   → 返回 {error, fallbackPptx: true, pptxUrl}
   → 前端弹出confirm: "PDF不可用,是否下载PPTX?"
```

**根因：** Gamma API 的 exportAs 默认生成 PPTX。PDF 是二次转换，不稳定。

**已知问题：**
1. **PDF转换可能失败**: Gamma API 的 PDF 导出接口不是100%可靠
2. **双重超时叠加**: 前端60s + 后端轮询40s + 后端下载120s = 理论最大220秒
3. **fallback降级合理**: PDF失败时提示下载PPTX，用户体验尚可
4. **export-pdf vs download-pdf 重复**: 两个API逻辑几乎相同，download-pdf 多了 Content-Disposition: attachment

---

## 7. 改进建议（优先级排序）

### P0 - 紧急（影响核心功能）

| # | 问题 | 建议 | 工作量 |
|---|------|------|-------|
| 1 | **gamma/gamma-direct无fetch超时** | 添加 `AbortSignal.timeout(60000)` 到所有Gamma API fetch调用 | 0.5h |
| 2 | **专业模式附件解析失败无明确反馈** | parse-file返回`{failed: true}`时，前端应阻止进入大纲流程并显示明确错误 | 1h |
| 3 | **积分扣除非原子操作** | 改为先预检余额→调用Gamma→成功后扣款，或使用Supabase事务 | 3h |
| 4 | **page.tsx 单文件1993行** | 拆分为独立组件: LandingPage, InputPhase, OutlineEditor, ResultPage, hooks | 4h |

### P1 - 重要（影响用户体验）

| # | 问题 | 建议 | 工作量 |
|---|------|------|-------|
| 5 | **smart-outline API 未使用** | 要么集成V3方案（gammaScript直出），要么删除死代码 | 2h |
| 6 | **export-pdf/download-pdf/proxy-pdf 三API重复** | 统一为一个PDF导出API，通过参数区分inline/attachment | 2h |
| 7 | **preview-images/preview-async/preview-proxy 三个预览API冗余** | 确认只用gammaUrl新标签页方案，删除无用预览API | 1h |
| 8 | **Word解析失败静默处理** | 返回明确状态码(如422)而非200+友好文本 | 0.5h |
| 9 | **前端轮询无指数退避** | 从固定3秒改为3→5→8→10秒，减少无效请求 | 0.5h |

### P2 - 优化（提升稳定性）

| # | 问题 | 建议 | 工作量 |
|---|------|------|-------|
| 10 | **Gamma PDF转换不稳定** | 默认生成PPTX，PDF下载时在服务端用LibreOffice转换，或提示用户自行转换 | 4h |
| 11 | **AI调用无并发控制** | outline API同时被多个请求调用时可能耗尽所有AI配额，添加信号量控制 | 1h |
| 12 | **parse-file截断8000字符无分段** | 对超长文档提示用户分段上传，或在outline层做分段处理 | 2h |
| 13 | **rate-limit使用IP** | 同一IP下不同用户共享限制，改为userId限流 | 1h |
| 14 | **history保存失败静默** | 前端catch后仅console.warn，应降级到localStorage | 1h |

### P3 - 长期（架构演进）

| # | 问题 | 建议 | 工作量 |
|---|------|------|-------|
| 15 | **buildMdV2 + additionalInstructions 重复构建** | gamma/route.ts 和 gamma-direct/route.ts 各自构建指令，逻辑大量重复，抽取共享模块 | 3h |
| 16 | **上传文件限制50MB但parse-file无流式处理** | 大文件一次性读入内存，Vercel Serverless有内存限制，需改为流式处理 | 4h |
| 17 | **缺少端到端测试** | 核心流程(输入→大纲→生成→下载)无自动化测试，建议添加Playwright E2E | 8h |
| 18 | **缺少OpenAPI/Swagger文档** | 30+个API无统一文档，建议自动生成 | 2h |

---

## 8. 关键文件索引

| 文件 | 行数 | 职责 |
|------|------|------|
| `src/app/page.tsx` | 1993 | 前端主组件(landing+input+outline+generating+result) |
| `src/app/api/gamma/route.ts` | ~300 | Gamma生成创建+状态查询 |
| `src/app/api/gamma-direct/route.ts` | ~250 | Gamma直通模式 |
| `src/app/api/outline/route.ts` | ~500 | AI大纲生成(含3级fallback+智能模式) |
| `src/app/api/parse-file/route.ts` | ~250 | 服务端文件解析 |
| `src/app/api/download-pdf/route.ts` | ~180 | PDF下载代理 |
| `src/app/api/proxy-pdf/route.ts` | ~180 | PDF预览代理 |
| `src/app/api/export-pptx/route.ts` | ~120 | PPTX下载代理 |
| `src/app/api/export-pdf/route.ts` | ~200 | PDF导出(与download-pdf重复) |
| `src/app/api/preview/route.ts` | ~80 | 预览信息(gammaUrl) |
| `src/app/api/smart-outline/route.ts` | ~250 | 省心模式V3(未使用) |
| `src/lib/build-md-v2.ts` | ~580 | Gamma Markdown排版引擎 |
| `src/lib/gamma-key-pool.ts` | - | 多Key轮换池 |
| `src/lib/gamma-config.ts` | - | Gamma配置(场景/主题/指令模板) |
| `src/lib/kimi-client.ts` | - | Kimi AI客户端 |
| `src/lib/minimax-client.ts` | - | MiniMax AI客户端 |
| `src/lib/glm-client.ts` | - | GLM AI客户端 |
| `src/lib/rate-limit.ts` | - | 速率限制 |
| `src/lib/membership.ts` | - | 会员权限/积分 |
| `docs/gamma-api.md` | ~200 | Gamma API技术文档 |

---

_文档生成时间：2026-04-26 14:00 CST_
_基于 shengshi-ppt 代码库完整分析_
