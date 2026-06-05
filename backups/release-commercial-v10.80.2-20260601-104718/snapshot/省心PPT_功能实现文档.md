# 省心PPT — 功能实现文档

> 版本：V6（2026-04-14）
> 维护者：省事PPT（ppt-lead）
> 代码根目录：`/Users/jinjiechen/.openclaw/workspace/shared-workspace/output/ppt-website/demo/`

---

## 一、系统架构总览

### 1.1 技术栈

| 层级 | 技术 |
|------|------|
| 前端框架 | Next.js 16.2.2 + React 19 + Tailwind CSS v4 |
| 后端 | Next.js API Routes（Vercel Serverless Functions） |
| 数据库 | Supabase（用户、积分、套餐） |
| PPT生成 | Gamma API（`https://public-api.gamma.app/v1.0`） |
| AI模型 | Kimi K2.5（首选）→ MiniMax M2.7（备用）→ GLM-5（兜底） |
| 部署 | Vercel（主域名：`https://shengxinppt.lol`） |

### 1.2 核心文件结构

```
src/
├── app/
│   ├── page.tsx                      ← 首页（双轨制入口 + 生成流程核心）
│   ├── account/page.tsx              ← 用户中心
│   ├── pricing/page.tsx              ← 定价页
│   └── api/
│       ├── gamma/route.ts           ← 省心定制 API（preserve 模式）
│       ├── gamma-direct/route.ts     ← Gamma 直通 API（generate 模式）
│       ├── gamma-balance/route.ts    ← Gamma 余额查询
│       ├── outline/route.ts          ← AI 大纲生成 API
│       ├── smart-outline/route.ts    ← 省心模式智能大纲 API
│       ├── export/route.ts           ← PPTX 下载代理（解决墙问题）
│       ├── user/route.ts             ← 用户积分管理
│       ├── credits/route.ts          ← 积分查询
│       ├── payment/route.ts          ← 支付相关
│       └── upload/route.ts           ← 文件上传
├── components/
│   ├── GenerationProgress.tsx        ← 三步进度条 UI（分析→大纲→渲染）
│   ├── StreamingOutline.tsx           ← 流式大纲展示
│   ├── ThemeSelector.tsx             ← 两级主题选择器
│   ├── ProPanel.tsx                  ← 专业模式参数面板
│   ├── LoginModal.tsx / PaymentModal.tsx
│   └── generate/
│       ├── GenerationContext.tsx     ← 生成上下文（统一管理状态）
│       ├── TopicInput.tsx            ← 主题输入组件
│       └── ThemeSelector.tsx          ← 主题选择组件
├── hooks/
│   └── useGammaGeneration.ts         ← Gamma 轮询 Hook
└── lib/
    ├── build-md-v2.ts                ← Markdown 排版引擎 V5
    ├── theme-database.ts             ← 50 个 Gamma 主题数据库
    ├── membership.ts                 ← 会员权限体系
    ├── gamma-api.ts                  ← Gamma API 客户端
    ├── kimi-client.ts / minimax-client.ts / glm-client.ts
    ├── auth-context.tsx              ← 认证上下文
    └── rate-limit.ts                 ← API 限流
```

---

## 二、产品架构：双轨制

省心PPT采用**双轨并行**的产品设计，两套生成路径服务于不同用户需求：

### 2.1 模式对比

| | **Gamma 直通** 🚀 | **省心定制** ✨ |
|---|---|---|
| **定位** | 快速简单需求 | 高质量深度需求 |
| **textMode** | `generate`（让 Gamma 自由发挥） | `preserve`（忠实呈现 AI 优化内容） |
| **AI 预处理** | 无，用户内容直传 Gamma | 有，AI 大纲 + buildMdV2 优化后再传 |
| **用户编辑** | 无，直接生成 | 有，大纲可编辑确认后再生成 |
| **适用场景** | 简单主题、快速出稿 | 高质量汇报、演讲、方案 |
| **可用用户** | 所有登录用户 | 会员专属 |
| **积分消耗** | 与省心定制相同 | 与 Gamma 直通相同 |

### 2.2 页面阶段（phase）

用户从进入首页到拿到 PPT，经历以下阶段：

```
landing → input → streaming(outline) → outline → generating → result
                  (省心模式)          (省心模式)
         ↘ direct-generating → result
             (直通模式)
```

| phase | 含义 | 触发 |
|-------|------|------|
| `landing` | 首页展示 | 默认 |
| `input` | 输入主题/上传文件 | 点击开始创建 |
| `streaming` | AI 流式生成大纲 | 省心模式第一步 |
| `outline` | 大纲编辑页 | 省心模式第二步 |
| `generating` | PPT 渲染中（省心） | 省心模式提交后 |
| `direct-generating` | PPT 渲染中（直通） | 直通模式提交后 |
| `result` | 结果页（下载） | 生成完成 |

---

## 三、Gamma 直通模式（generate）

### 3.1 流程图

```
用户输入主题/上传文件
    ↓
权限检查（积分 + 会员）
    ↓
POST /api/gamma
  {
    inputText: 用户原文,
    textMode: 'generate',
    themeId: 用户选的主题ID,
    additionalInstructions: 场景配置指令,
    imageOptions: { source: 图片模式 },
    ...
  }
    ↓
Gamma API（异步）
  → generationId
    ↓
前端轮询 GET /api/gamma?id=xxx（每3秒，最多3分钟）
    ↓
status === 'completed'
  → exportUrl（PPTX 下载链接）
    ↓
POST /api/export?url=xxx（服务端代理下载，解决墙问题）
    ↓
用户下载 PPTX
```

### 3.2 场景配置（SCENE_CONFIGS）

每个场景有默认的 `themeId`、`tone`、`imageSource`：

| 场景 | themeId | tone | 默认图片源 |
|------|---------|------|-----------|
| biz（商务汇报）| consultant | professional | pictographic |
| pitch（路演融资）| founder | professional | pictographic |
| training（培训课件）| icebreaker | casual | noImages |
| creative（创意方案）| electric | creative | aiGenerated |
| education（教育）| chisel | casual | pictographic |
| data（数据分析）| gleam | professional | noImages |
| annual（年度总结）| blues | professional | pictographic |
| launch（产品发布）| aurora | bold | aiGenerated |
| traditional（传统风格）| chisel | traditional | aiGenerated |

### 3.3 图片模式（4种）

| 前端 imgMode | Gamma imageOptions.source | 说明 | 积分 |
|---|---|---|---|
| `none` | `noImages` | 纯净无图 | 0 |
| `theme` | `pictographic` | Gamma 内置免费插图/摘要图 | 0 |
| `web` | `webFreeToUseCommercially` | 免版权商用图搜索 | 0 |
| `ai` | `aiGenerated` + `imagen-3-flash` | AI 定制普通图 | 2/图 |
| `ai-pro` | `aiGenerated` + `imagen-3-pro` | AI 尊享高清图 | 20/图（⚠️需审批）|

---

## 四、省心定制模式（preserve）

### 4.1 流程图

```
用户输入主题
    ↓
权限检查（必须是会员）
    ↓
POST /api/smart-outline
  → AI 流式返回大纲（StreamingOutline 组件渲染）
    ↓
用户编辑确认大纲（SlideItem[] 可拖拽排序/修改内容）
    ↓
可选：修改主题 / 语气 / 图片模式
    ↓
POST /api/gamma
  {
    inputText: buildMdV2(用户大纲),
    textMode: 'preserve',  ← 关键：忠实呈现 AI 优化内容
    numCards: 用户编辑后的页数,
    additionalInstructions: 强化排版指令,
    imageOptions: { ... },
    cardSplit: 'inputTextBreaks',  ← 精确分页控制
    ...
  }
    ↓
前端轮询（每3秒，最多3分钟）
    ↓
status === 'completed' → exportUrl
    ↓
POST /api/export → 下载 PPTX
```

### 4.2 核心模块：buildMdV2 排版引擎

文件：`src/lib/build-md-v2.ts`

这是技术部培训资料（`gamma-ppt-database.md`）的产品化实现，负责把用户大纲转换成 Gamma 能识别的 Markdown 格式。

**核心排版规范：**

| 规则 | Markdown 触发条件 | Gamma 效果 |
|------|-----------------|-----------|
| 大文本短句 | `### 要点标题`（24pt+ 加粗） | 独占一行大字正文 |
| 三列卡片 | 3-4 个并列 `- 要点` | 三列/四宫格卡片布局 |
| 时间轴 | 有序列表 `1. 2. 3.` | 流程/时间轴布局 |
| 左右对照 | `### 优势` + `### 劣势` | 左右对比布局 |
| 数据图表 | 内容含 `%`、`数据` 等关键词 | 强制分配图表类型 |
| 演讲者备注 | `> 引用块` 内容 | 备注与正文分离 |

**内容密度控制：**
- 单页正文：50-80 字
- 超出 80 字 → 必须拆分到下一页
- 神奇数字 3 & 4：归纳为 3 或 4 个并列项

**短要点智能展开（ENHANCEMENT_MAP）：**
- 用户写"创新" → 展开为"持续创新突破" + 3个详细子项
- 用户写"高效" → 展开为"效率全面提升" + 3个详细子项
- 覆盖 25+ 常见短词

### 4.3 大纲生成 AI 策略

文件：`src/app/api/outline/route.ts`

**调用链路（三层降级）：**

```
Kimi K2.5（首选，免费，多模态）
    ↓ 失败
MiniMax M2.7（备用，联网搜索）
    ↓ 失败
GLM-5（兜底，稳定）
    ↓ 全部失败 → 返回错误
```

---

## 五、权限与积分体系

### 5.1 会员套餐

| 套餐 | 价格 | 积分 | 最大页数 | AI 生图 | 省心模式 |
|------|------|------|---------|---------|---------|
| 免费 | ¥0 | 50 | 8 页 | ❌ | ❌ |
| 省心会员 | ¥9.9/月 | 300 | 20 页 | `imagen-3-flash` | ✅ |
| 高级会员 | ¥29.9/月 | 1000 | 40 页 | `imagen-3-flash` | ✅ |
| 尊享会员 | ¥49.9/月 | 2000 | 60 页 | `imagen-3-flash` + `imagen-3-pro` | ✅ |

### 5.2 权限检查时机

**Gamma 直通模式：** 用户点击"立即生成"前
- 检查积分是否足够
- 检查页数是否超限
- 检查图片模式是否在套餐允许范围内

**省心定制模式：** 额外检查是否为会员

---

## 六、下载实现（PPTX Export）

### 6.1 问题背景

Gamma 返回的 `exportUrl` 是 `assets.api.gamma.app/...` 的文件链接，该域名在国内被墙。

### 6.2 解决方案：服务端代理下载

文件：`src/app/api/export/route.ts`

```
用户点击「下载 PPTX」
    ↓
前端 fetch(/api/export?url=exportUrl&name=xxx)
    ↓
Vercel Serverless Function（国内可访问）
    ↓
fetch(assets.api.gamma.app/...)（Vercel 服务器可访问）
    ↓
返回 PPTX 文件流给用户
```

### 6.3 下载按钮逻辑

```typescript
async function handleDownload() {
  if (data:开头) {
    // 浏览器端 DataURL，直接下载
    createElement('a').click()
    return
  }
  
  // 统一走代理下载
  const res = await fetch(`/api/export?url=${encodeURIComponent(dlUrl)}`)
  
  if (!res.ok || blob.size < 1000) {
    // 代理失败：尝试直接打开 Gamma 链接
    if (dlUrl.includes('gamma.app')) {
      window.open(dlUrl, '_blank')
    }
    alert('下载暂时失败，请点击「在线查看」从 Gamma 下载')
    return
  }
  
  // 正常下载
  const blob = await res.blob()
  const blobUrl = URL.createObjectURL(blob)
  createElement('a').href(blobUrl).download.click()
}
```

### 6.4 备用入口

结果页永远显示「在线查看/下载」按钮（Gamma 链接用户可直接访问 `gamma.app`），防止所有下载路径都失败时用户找不到 PPT。

---

## 七、轮询机制

### 7.1 轮询参数

| 参数 | 值 | 说明 |
|------|---|------|
| 间隔 | 3 秒 | 缩短后（原来 4 秒） |
| 超时 | 3 分钟 | 延长后（原来 2 分钟） |
| API | `GET /api/gamma?id=generationId` | 查询 Gamma 任务状态 |

### 7.2 状态响应

```typescript
type GammaStatus =
  | 'processing'  // 进行中，继续轮询
  | 'completed'   // 完成，有 exportUrl
  | 'failed'      // 失败，显示错误
```

### 7.3 涉及轮询的文件

| 文件 | 轮询次数 |
|------|---------|
| `src/app/page.tsx`（直通模式） | 1 处 |
| `src/app/page.tsx`（省心模式） | 1 处 |
| `src/components/generate/GenerationContext.tsx` | 2 处 |
| `src/hooks/useGammaGeneration.ts` | 1 处 |

---

## 八、进度条 UI（三步完成）

文件：`src/components/GenerationProgress.tsx`

**步骤列表（已精简，移除「最终检查」空步骤）：**

| 步骤 | 序号 | 图标 | 描述 |
|------|------|------|------|
| 分析需求 | 0 | 🔍 | AI 正在理解你的主题... |
| 生成大纲 | 1 | 📋 | 构建内容框架... |
| 渲染PPT | 2 | 🎨 | 设计精美页面... |

> 注意：`genStep` 原来有 0/1/2/3（4步），现已统一改为 0/1/2（3步），`setGenStep(3)` 的调用已全部清除。

---

## 九、Gamma API 关键参数

### 9.1 请求 Payload

```typescript
{
  inputText: string,          // Markdown 格式内容
  textMode: 'generate' | 'preserve',  // 直通 vs 省心
  format: 'presentation',     // 固定
  numCards: number,            // 目标页数
  exportAs: 'pptx',           // 固定
  themeId: string,            // 50 个主题之一
  additionalInstructions: string,  // 排版指令
  cardSplit: 'inputTextBreaks',    // 省心模式精确分页
  textOptions: {
    amount: 'medium',
    tone: string,             // professional/casual/creative/bold/traditional
    language: 'zh-cn',
  },
  imageOptions: {
    source: 'noImages' | 'pictographic' | 'webFreeToUseCommercially' | 'aiGenerated',
    model?: 'imagen-3-flash' | 'imagen-3-pro',
    style?: string,           // AI 生图风格关键词
  },
  cardOptions: {
    dimensions: '16x9',      // 固定宽屏
  },
}
```

### 9.2 ⚠️ 严格禁止的模型

| 模型 | 积分/图 | 状态 |
|------|---------|------|
| `dall-e-3` | 33 | 🚫 严格禁用 |
| `gpt-image-1-high` | 120 | 🚫 严格禁用 |
| `flux-kontext-pro` | 20 | ⚠️ 需审批 |

---

## 十、最近修复记录（2026-04-14）

| 修复内容 | 文件 | 说明 |
|---------|------|------|
| 下载空白 | `export/route.ts` | 移除 URL 校验，统一走代理下载 |
| 下载空白 | `page.tsx` | 统一下载逻辑 + 备用在线查看按钮 |
| 生成太慢 | 全局轮询 | 间隔 4s→3s，超时 2min→3min |
| 最终检查空步骤 | `GenerationProgress.tsx` | 移除 STEP 3（只做 0.5s 等待） |
| genStep 统一 | `page.tsx` + `GenerationContext.tsx` | 清除 `setGenStep(3)` 调用 |

---

## 十一、部署信息

- **GitHub 仓库**：`https://github.com/xichenc14-ai/shengshi-ppt.git`
- **Vercel 项目**：`xichenc14-6690s-projects/demo`
- **生产环境**：`https://shengxinppt.lol`
- **Gamma 余额**：约 7858 credits
- **自动部署**：push 到 main 分支后 Vercel 自动触发（约 1-2 分钟）

---

_文档生成：2026-04-14 by 省事PPT_
