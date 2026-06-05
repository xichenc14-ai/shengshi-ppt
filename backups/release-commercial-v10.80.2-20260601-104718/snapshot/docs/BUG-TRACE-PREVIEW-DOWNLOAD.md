# Bug追踪文档：预览页 + PDF下载

> 生成时间：2026-04-26
> 调查范围：完整数据流trace
> 目的：定位根因，不涉及代码修改

---

## 一、预览页完整数据流

### ASCII 数据流图

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                           预览页数据流（v10.13）                                  │
└─────────────────────────────────────────────────────────────────────────────────┘

用户操作                    前端代码                         后端API                    Gamma API
──────────────────────────────────────────────────────────────────────────────────────
点击"生成PPT"
    │
    ├──────────────────► handleGeneratePPT()
    │                      │
    │                      ├─ 调用 POST /api/gamma
    │                      │  body: { inputText, themeId, numCards, ... }
    │                      │
    │                      │         ┌────────────────────────────────────┐
    │                      │         │ POST /api/gamma/route.ts           │
    │                      │         │                                    │
    │                      │         ├─ selectBestKey() 选择API Key       │
    │                      │         ├─ 构建 gammaPayload                 │
    │                      │         ├─ POST Gamma API /generations       │◄──── Gamma API
    │                      │         │   返回: { generationId, credits }  │
    │                      │         ├─ updateKeyBalance()                │
    │                      │         └─ 返回: { generationId }            │
    │                      │         └────────────────────────────────────┘
    │                      │
    │                      ├─ 收到 generationId
    │                      │
    │                      ├─ 进入轮询循环（最多180秒）
    │                      │  │
    │                      │  ├─ GET /api/gamma?id={generationId}
    │                      │  │  │
    │                      │  │  │    ┌────────────────────────────────────┐
    │                      │  │  │    │ GET /api/gamma/route.ts            │
    │                      │  │  │    │                                    │
    │                      │  │  │    ├─ GET Gamma API /generations/{id}   │◄──── Gamma API
    │                      │  │  │    │   返回: {                          │
    │                      │  │  │    │     generationId,                  │
    │                      │  │  │    │     status: "completed",           │
    │                      │  │  │    │     gammaUrl: "https://...",       │ ⚠️ 关键字段
    │                      │  │  │    │     exportUrl: "https://...",      │ ⚠️ 关键字段
    │                      │  │  │    │     credits: { deducted, remaining }│
    │                      │  │  │    │   }                                │
    │                      │  │  │    │   ❌ 没有 cards 数组               │ ⚠️ 根因！
    │                      │  │  │    │   ❌ 没有 previewUrl 字段          │ ⚠️ 根因！
    │                      │  │  │    └────────────────────────────────────┘
    │                      │  │  │
    │                      │  │  ├─ 收到 statusData
    │                      │  │  │  lastStatusData = {
    │                      │  │  │    gammaUrl: "...",
    │                      │  │  │    exportUrl: "..."
    │                      │  │  │  }
    │                      │  │  │
    │                      │  │  └─ status === 'completed' → break 轮询
    │                      │  │
    │                      │  └─ 继续轮询直到完成或超时
    │                      │
    │                      ├─ setPreviewGammaUrl(lastStatusData?.gammaUrl)
    │                      │  ⚠️ 从轮询结果直接获取 gammaUrl
    │                      │
    │                      ├─ 异步调用 GET /api/preview-proxy?id={generationId}
    │                      │  │
    │                      │  │    ┌────────────────────────────────────┐
    │                      │  │    │ GET /api/preview-proxy/route.ts    │
    │                      │  │    │                                    │
    │                      │  │    ├─ GET Gamma API /generations/{id}   │◄──── Gamma API
    │                      │  │    │   返回: { gammaUrl, exportUrl }    │
    │                      │  │    │   ❌ 没有 cards/previewUrl         │ ⚠️ v10.13注释
    │                      │  │    │                                    │
    │                      │  │    └────────────────────────────────────┘
    │                      │  │
    │                      │  └─ 收到 { gammaUrl }
    │                      │     如果 previewGammaUrl 为空，则 setPreviewGammaUrl(data.gammaUrl)
    │                      │
    │                      ├─ setResult({ gammaUrl: lastStatusData?.gammaUrl })
    │                      ├─ setPhase('result')
    │                      │
    │                      └─ 渲染结果页
    │                         │
    │                         ├─ previewGammaUrl 存在 → 显示 <a target="_blank">
    │                         │   <a href={previewGammaUrl} target="_blank">
    │                         │     在线预览 PPT
    │                         │   </a>
    │                         │   ⚠️ 必须用新标签页打开，因为：
    │                         │   Gamma网站 X-Frame-Options: SAMEORIGIN
    │                         │   → 禁止 iframe 嵌入
    │                         │
    │                         └─ previewGammaUrl 为空 → 显示"预览加载中..."
    │
    └─ 用户点击"在线预览" → 新标签页打开 gammaUrl

```

---

### 核心代码证据

#### 证据1：Gamma API GET 不返回 cards/previewUrl

**文件：** `src/app/api/preview-proxy/route.ts`

**关键注释（第6-14行）：**

```typescript
/**
 * 预览信息 API - v10.13
 *
 * 🚨 v10.13 重写原因：
 * Gamma API GET /generations/{id} 不返回 cards/previewUrl 字段
 * （API 仅返回 generationId, status, gammaUrl, exportUrl, credits）
 * 所以之前的 v10.9 方案（从 cards 提取图片）永远返回空数组
 *
 * 新方案：返回 gammaUrl 供前端"在新标签页中查看"
 * Gamma 网站 X-Frame-Options: SAMEORIGIN → iframe 不可行
 * 唯一可行的预览方式是打开新标签页
 */
```

**根因确认：** Gamma API GET `/generations/{id}` 返回的字段中 **没有** `cards` 数组和 `previewUrl` 字段。

---

#### 证据2：Gamma API GET 返回的实际字段

**文件：** `src/app/api/preview-proxy/route.ts`（第47-52行）

```typescript
const data = await response.json();

// Gamma API 标准字段：gammaUrl, exportUrl, status, credits
const gammaUrl = data.gammaUrl || '';
const exportUrl = data.exportUrl || '';
const status = data.status || '';
```

**确认字段：** 只有 `gammaUrl, exportUrl, status, credits`，没有 `cards` 或 `previewUrl`。

---

#### 证据3：前端从轮询结果获取 gammaUrl

**文件：** `src/app/page.tsx`（confirmAndGenerate 函数，约第280行）

```typescript
// 轮询状态（最多 3 分钟）
while (Date.now() - startTime < 180000) {
  await new Promise(r => setTimeout(r, pollInterval));

  const statusRes = await fetch(`/api/gamma?id=${gd.generationId}`);
  const statusData = await statusRes.json();

  if (statusData.status === 'completed') {
    finalExportUrl = statusData.exportUrl || '';
    lastStatusData = statusData;  // ⚠️ 保存完整响应
    break;
  }
}

// ...

// v10.13: 获取 Gamma 在线预览链接
if (gd.generationId) {
  // 🚨 v10.8: 优先使用轮询已获取的 gammaUrl
  if (lastStatusData?.gammaUrl) {
    setPreviewGammaUrl(lastStatusData.gammaUrl);  // ⚠️ 从轮询结果获取
  }
  fetch(`/api/preview-proxy?id=${gd.generationId}`)
    .then(res => res.json())
    .then(data => {
      if (data.gammaUrl && !previewGammaUrl) {
        setPreviewGammaUrl(data.gammaUrl);
      }
    })
    .catch(e => console.warn('[Preview] Failed:', e));
}
```

---

#### 证据4：前端预览按钮渲染方式

**文件：** `src/app/page.tsx`（结果页渲染，约第1856行）

```typescript
{previewGammaUrl || result.gammaUrl ? (
  <a
    href={previewGammaUrl || result.gammaUrl || '#'}
    target="_blank"
    rel="noopener noreferrer"
    className="block w-full bg-gradient-to-br from-gray-900 to-gray-800..."
  >
    <div className="text-5xl mb-4">👁️</div>
    <p className="text-white font-bold text-lg mb-2">在线预览 PPT</p>
    <p className="text-gray-400 text-sm">点击在新标签页中查看完整演示文稿</p>
    <div className="mt-4 inline-flex items-center gap-2 bg-white/10...">
      <span>↗</span> 打开预览
    </div>
  </a>
) : (
  <div className="bg-gray-100 rounded-xl p-8 text-center">
    <div className="text-4xl mb-3">📄</div>
    <p className="text-gray-500 text-sm mb-1">预览加载中...</p>
    <p className="text-gray-400 text-xs">稍后可点击下方按钮下载 PPT</p>
  </div>
)}
```

**关键点：** 预览使用 `<a target="_blank">` 打开新标签页，而不是 `<iframe>`。

---

#### 证据5：Gamma 网站 X-Frame-Options 禁止 iframe

**来源：** `src/app/api/preview-proxy/route.ts` 注释（第13行）

```typescript
// Gamma 网站 X-Frame-Options: SAMEORIGIN → iframe 不可行
// 唯一可行的预览方式是打开新标签页
```

**根因：** Gamma 网站设置 `X-Frame-Options: SAMEORIGIN`，禁止其他网站通过 iframe 嵌入。

---

### 根因定位

| 问题层级 | 根因 | 代码位置 |
|---------|------|---------|
| **API层** | Gamma API GET `/generations/{id}` **不返回** `cards` 数组或 `previewUrl` 字段 | Gamma API 文档限制（外部服务） |
| **前端层** | 无法获取卡片数据用于内嵌预览 | `preview-proxy/route.ts` 第6-14行注释 |
| **安全层** | Gamma 网站 `X-Frame-Options: SAMEORIGIN` 禁止 iframe 嵌入 | Gamma 网站安全策略（外部服务） |

**结论：** 预览页问题 **不是 bug**，而是 Gamma API 和 Gamma 网站的设计限制。

---

### 当前方案（v10.13）的合理性

| 方案 | 可行性 | 说明 |
|------|--------|------|
| iframe 内嵌预览 | ❌ 不可行 | Gamma 网站 `X-Frame-Options: SAMEORIGIN` 禁止 |
| 从 cards 提取图片 | ❌ 不可行 | Gamma API 不返回 `cards` 字段 |
| 从 previewUrl 提取预览链接 | ❌ 不可行 | Gamma API 不返回 `previewUrl` 字段 |
| **新标签页打开 gammaUrl** | ✅ **唯一可行方案** | v10.13 已实现 |

---

### 如果用户抱怨"预览体验不好"

| 用户期望 | 技术可行性 | 替代方案 |
|---------|-----------|---------|
| 在应用内看到PPT缩略图 | ❌ Gamma API不提供 | 使用 `exportUrl` 下载PPT后本地渲染缩略图（需额外开发） |
| 点击预览按钮立即看到PPT | ✅ 已实现 | 新标签页打开 gammaUrl（Gamma官方在线查看器） |
| 预览加载慢 | 依赖Gamma网站速度 | 无法优化（外部服务） |

---

---

## 二、PDF下载完整数据流

### ASCII 数据流图

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                           PDF下载数据流（v10.9）                                  │
└─────────────────────────────────────────────────────────────────────────────────┘

用户操作                    前端代码                         后端API                    Gamma API
──────────────────────────────────────────────────────────────────────────────────────
点击"下载PDF"
    │
    ├──────────────────► handleExportPDF()
    │                      │
    │                      ├─ 检查 user + generationId
    │                      ├─ 记录下载历史 POST /api/download
    │                      │
    │                      ├─ GET /api/download-pdf?generationId={id}&name={name}
    │                      │  │
    │                      │  │    ┌────────────────────────────────────────────────┐
    │                      │  │    │ GET /api/download-pdf/route.ts                 │
    │                      │  │    │                                                │
    │                      │  │    ├─ Step 1: 查询 Gamma 生成状态                  │
    │                      │  │    │  GET Gamma API /generations/{generationId}     │◄──── Gamma API
    │                      │  │    │  返回: { status, gammaUrl, exportUrl }         │
    │                      │  │    │                                                │
    │                      │  │    ├─ Step 2: 创建 PDF 导出任务                    │
    │                      │  │    │  POST Gamma API /generations/{id}/exports      │◄──── Gamma API
    │                      │  │    │  body: { format: 'pdf' }                       │
    │                      │  │    │                                                │
    │                      │  │    │  ⚠️ 可能返回:                                  │
    │                      │  │    │  - { url: "..." } → 直接获取PDF链接            │
    │                      │  │    │  - { id: "export-xxx" } → 需要轮询等待          │
    │                      │  │    │  - 400/500 错误 → PDF导出失败                  │ ⚠️ 不稳定！
    │                      │  │    │                                                │
    │                      │  │    ├─ Step 3: 如果返回 exportId，轮询等待           │
    │                      │  │    │  for (i=0; i<20; i++) {                        │
    │                      │  │    │    GET /generations/{id}/exports/{exportId}    │◄──── Gamma API
    │                      │  │    │    如果返回 { url } → 获取pdfUrl               │
    │                      │  │    │    如果 status=failed → break                 │ ⚠️ 可能失败
    │                      │  │    │    等待 2秒                                     │
    │                      │  │    │  }                                             │
    │                      │  │    │                                                │
    │                      │  │    ├─ Step 4: pdfUrl 为空 → fallback                │
    │                      │  │    │  if (!pdfUrl) {                                │
    │                      │  │    │    return {                                    │
    │                      │  │    │      error: 'PDF格式暂不可用',                 │
    │                      │  │    │      fallbackPptx: true,                       │ ⚠️ fallback方案
    │                      │  │    │      pptxUrl: statusData.exportUrl             │
    │                      │  │    │    }                                           │
    │                      │  │    │  }                                             │
    │                      │  │    │                                                │
    │                      │  │    ├─ Step 5: 代理下载 PDF                          │
    │                      │  │    │  fetch(pdfUrl, { redirect: 'follow' })         │◄──── Gamma CDN
    │                      │  │    │  返回: buffer (PDF binary)                     │
    │                      │  │    │                                                │
    │                      │  │    ├─ Step 6: 返回 PDF blob                         │
    │                      │  │    │  NextResponse(buffer, {                        │
    │                      │  │    │    headers: {                                  │
    │                      │  │    │      'Content-Type': 'application/pdf',        │
    │                      │  │    │      'Content-Disposition': 'attachment'       │
    │                      │  │    │    }                                           │
    │                      │  │    │  })                                            │
    │                      │  │    └────────────────────────────────────────────────┘
    │                      │  │
    │                      │  ├─ 收到响应
    │                      │  │  │
    │                      │  │  │  if (contentType.includes('application/json')) {
    │                      │  │  │    // ⚠️ 返回的是错误JSON，不是PDF
    │                      │  │  │    const errData = await res.json();
    │                      │  │  │    if (errData.fallbackPptx) {
    │                      │  │  │      confirm('PDF格式暂不可用，是否下载PPTX？');
    │                      │  │  │      if (yes) handleExportPPT();
    │                      │  │  │    }
    │                      │  │  │  }
    │                      │  │  │  else {
    │                      │  │  │    // ✅ 返回的是PDF blob
    │                      │  │  │    const blob = await res.blob();
    │                      │  │  │    downloadBlob(blob, filename);
    │                      │  │  │  }
    │                      │  │  │
    │                      │  │  └─ 成功或fallback
    │                      │  │
    │                      │  └─ 超时处理（60秒）
    │                      │     if (timeout) {
    │                      │       confirm('PDF下载超时，是否下载PPTX？');
    │                      │       if (yes) handleExportPPT();
    │                      │     }
    │                      │
    │                      └─ 用户收到文件

```

---

### 核心代码证据

#### 证据1：PDF导出需要额外调用 Gamma exports API

**文件：** `src/app/api/download-pdf/route.ts`（第36-65行）

```typescript
// 2. 尝试获取 PDF 导出链接
let pdfUrl = '';

try {
  const pdfExportRes = await fetch(`${GAMMA_API_BASE}/generations/${generationId}/exports`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-API-KEY': apiKey,
    },
    body: JSON.stringify({ format: 'pdf' }),
  });

  if (pdfExportRes.ok) {
    const pdfExportData = await pdfExportRes.json();
    if (pdfExportData.url || pdfExportData.exportUrl || pdfExportData.pdfUrl) {
      pdfUrl = pdfExportData.url || pdfExportData.exportUrl || pdfExportData.pdfUrl;
    } else if (pdfExportData.id) {
      // 轮询等待 PDF 导出完成
      const exportId = pdfExportData.id;
      for (let i = 0; i < 20; i++) {
        await new Promise(r => setTimeout(r, 2000));
        const checkRes = await fetch(`${GAMMA_API_BASE}/generations/${generationId}/exports/${exportId}`, {
          headers: { 'X-API-KEY': apiKey },
        });
        if (checkRes.ok) {
          const checkData = await checkRes.json();
          if (checkData.url || checkData.exportUrl || checkData.pdfUrl) {
            pdfUrl = checkData.url || checkData.exportUrl || checkData.pdfUrl;
            break;
          }
          if (checkData.status === 'failed') break;
        }
      }
    }
  }
} catch (e) {
  console.warn('[DownloadPDF] PDF export creation failed:', e);
}
```

**关键点：**
- PDF 导出需要调用 `/generations/{id}/exports` POST 创建导出任务
- 如果返回 `id`，需要轮询 `/generations/{id}/exports/{exportId}` 等待完成
- 最多轮询20次，每次等待2秒（总计40秒）

---

#### 证据2：PDF导出失败时返回 fallback

**文件：** `src/app/api/download-pdf/route.ts`（第68-75行）

```typescript
// 如果 PDF 导出失败，返回 fallback 提示下载 PPTX
if (!pdfUrl) {
  return NextResponse.json({
    error: 'PDF 格式暂不可用，请下载 PPT 版本',
    fallbackPptx: true,
    pptxUrl: statusData.exportUrl,
  }, { status: 404 });
}
```

---

#### 证据3：前端处理 PDF 下载响应

**文件：** `src/app/page.tsx`（handleExportPDF 函数，约第420行）

```typescript
const contentType = res.headers.get('Content-Type') || '';
if (!res.ok || contentType.includes('application/json')) {
  const errData = await res.json().catch(() => ({ fallbackPptx: true }));
  setPdfExporting(false);
  const usePptx = window.confirm(
    'PDF 格式暂不可用\n\n建议：下载 PPTX 文件后，用 Keynote/PowerPoint/WPS 导出为 PDF\n\n是否下载 PPTX 版本？'
  );
  if (usePptx) handleExportPPT();
  return;
}

// v10.9: 使用 blob → 临时 a 标签 → click → 清理 DOM
const blob = await res.blob();
downloadBlob(blob, filename);
```

---

#### 证据4：前端超时处理（60秒）

**文件：** `src/app/page.tsx`（handleExportPDF 函数）

```typescript
const pdfController = new AbortController();
const pdfTimeout = setTimeout(() => pdfController.abort(), 60000); // 60秒超时

let res: Response;
try {
  res = await fetch(`/api/download-pdf?generationId=${result.generationId}&name=${encodeURIComponent(filename)}`, {
    signal: pdfController.signal,
  });
} catch (fetchErr: any) {
  clearTimeout(pdfTimeout);
  setPdfExporting(false);
  const usePptx = window.confirm(
    'PDF 下载超时\n\n建议：下载 PPTX 文件后，用 Keynote/PowerPoint/WPS 导出为 PDF\n\n是否下载 PPTX 版本？'
  );
  if (usePptx) handleExportPPT();
  return;
}
```

---

### 根因定位

| 问题层级 | 根因 | 代码位置 |
|---------|------|---------|
| **API层** | Gamma PDF 导出 API (`/generations/{id}/exports`) 不稳定，可能返回错误或需要长时间轮询 | Gamma API 外部服务 |
| **导出层** | PDF 导出需要额外调用 exports API 并轮询，增加失败概率 | `download-pdf/route.ts` 第36-65行 |
| **超时层** | 后端轮询最多40秒 + 前端超时60秒 = 总计100秒可能超时 | `download-pdf/route.ts` 第50行 + `page.tsx` 第415行 |
| **兼容层** | Gamma API 可能返回多种响应格式（url/exportUrl/pdfUrl），需要兼容多种情况 | `download-pdf/route.ts` 第43-46行 |

**结论：** PDF下载问题 **部分是 Gamma API 不稳定**，部分是导出流程复杂。

---

### PDF vs PPTX 对比

| 格式 | 导出流程 | API稳定性 | 下载可靠性 |
|------|---------|-----------|-----------|
| **PPTX** | 直接从 `/generations/{id}` 获取 `exportUrl` | ✅ 稳定 | ✅ 高 |
| **PDF** | 需调用 `/exports` POST → 可能轮询 `/exports/{id}` GET | ⚠️ 不稳定 | ⚠️ 中 |

---

---

## 三、修复方案建议

### 预览页修复方案

| 方案编号 | 方案描述 | 优先级 | 技术可行性 |
|---------|---------|--------|-----------|
| **P1-保持现状** | v10.13 方案：新标签页打开 gammaUrl | ✅ 已实现 | ✅ 可行 |
| **P2-本地缩略图** | 下载 PPTX 后渲染首页缩略图（需额外开发） | P2（可选） | ⚠️ 需解析PPTX文件 |
| **P3-缓存预览图** | Gamma完成后保存预览截图到本地存储 | P3（可选） | ⚠️ 需Gamma提供截图API |

**推荐：** 保持 P1（v10.13 方案），这是当前唯一可行的方案。

**用户体验优化建议：**
- 在预览按钮上添加提示："在新标签页中打开"
- 如果 gammaUrl 加载慢，显示"预览正在加载..."

---

### PDF下载修复方案

| 方案编号 | 方案描述 | 优先级 | 改动位置 |
|---------|---------|--------|---------|
| **F1-增加重试次数** | 轮询从20次增加到30次（60秒总等待） | P2 | `download-pdf/route.ts` 第50行 |
| **F2-优化错误提示** | 更明确提示用户 fallback 到 PPTX | P1 | `page.tsx` confirm 文案优化 |
| **F3-添加导出进度显示** | 前端显示"正在导出PDF..."进度 | P2 | `page.tsx` handleExportPDF |
| **F4-默认推荐PPTX** | 主下载按钮改为PPTX，PDF作为次要选项 | P1 | `page.tsx` 按钮排序 |
| **F5-后台预导出PDF** | PPT完成后自动触发PDF导出，缓存结果 | P3 | 需新增后台任务 |

**推荐：**
- 立即实施 F2 + F4（优化用户体验，引导用户使用稳定的PPTX）
- 后续实施 F1 + F3（增加导出成功率）

---

### 具体代码修改建议

#### F2：优化错误提示

**位置：** `src/app/page.tsx` handleExportPDF 函数

**当前文案：**
```
PDF 格式暂不可用\n\n建议：下载 PPTX 文件后，用 Keynote/PowerPoint/WPS 导出为 PDF\n\n是否下载 PPTX 版本？
```

**建议修改为：**
```
PDF 导出失败（Gamma API暂时不支持）\n\n替代方案：\n1. 下载 PPTX 版本（推荐）\n2. 用 Keynote/PowerPoint/WPS 打开后导出为 PDF\n\n是否下载 PPTX 版本？
```

---

#### F4：默认推荐PPTX

**位置：** `src/app/page.tsx` 结果页按钮区域

**当前布局：**
```typescript
<button onClick={handleExportPPT}>下载 PPT</button>
<button onClick={handleExportPDF}>下载 PDF · 可能需转PPT</button>
```

**建议修改为：**
```typescript
<button onClick={handleExportPPT}>下载 PPT（推荐）</button>
<button onClick={handleExportPDF}>下载 PDF（不稳定）</button>
```

---

#### F1：增加重试次数

**位置：** `src/app/api/download-pdf/route.ts` 第50行

**当前代码：**
```typescript
for (let i = 0; i < 20; i++) {
  await new Promise(r => setTimeout(r, 2000));
  // ...
}
```

**建议修改为：**
```typescript
for (let i = 0; i < 30; i++) {  // 增加到30次（60秒）
  await new Promise(r => setTimeout(r, 2000));
  // ...
}
```

---

---

## 四、总结

| 问题 | 根因 | 当前状态 | 修复优先级 |
|------|------|---------|-----------|
| **预览页** | Gamma API不返回cards/previewUrl + X-Frame-Options禁止iframe | ✅ v10.13已用新标签页方案解决 | P1（保持现状） |
| **PDF下载** | Gamma exports API不稳定 + 导出流程复杂 | ⚠️ 有fallback但体验不佳 | P1（优化提示+推荐PPTX） |

**关键结论：**

1. **预览页不是bug**，而是Gamma API的设计限制，v10.13方案已是唯一可行方案
2. **PDF下载不稳定**是Gamma API的特性，应引导用户优先使用PPTX格式
3. **PPTX下载稳定**，因为直接使用 `/generations/{id}` 返回的 `exportUrl`

---

> 文档生成：2026-04-26
> 调查完成：✅ 数据流完整trace
> 根因定位：✅ 具体到代码行
> 修复方案：✅ 5个建议方案