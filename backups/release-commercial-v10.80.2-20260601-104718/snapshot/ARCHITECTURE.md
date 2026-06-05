# 省心PPT - 项目架构文档

> 版本: v10.48 | 技术栈: React 19 + Next.js 15 + Tailwind v4
> 线上地址: https://shengxinppt.lol
> 代码仓库: https://github.com/xichenc14-ai/shengshi-ppt.git

---

## 1. 目录结构

```
src/
├── app/                    # Next.js App Router
│   ├── page.tsx            # 首页（主流程控制）
│   ├── layout.tsx          # 根布局
│   ├── globals.css        # 全局样式
│   ├── api/               # API Routes
│   │   ├── outline/       # 大纲生成 API（AI 入口）
│   │   ├── gamma/         # PPT 生成 API
│   │   ├── gamma-direct/  # 专业模式 PPT 生成
│   │   ├── user/          # 用户认证/积分
│   │   ├── payment/       # 支付相关
│   │   └── diagnostic/    # 诊断接口（临时）
│   └── ...
├── components/            # React 组件
│   ├── page/              # 页面级组件
│   ├── ui/                # 基础 UI 组件
│   ├── ProPanel.tsx       # 专业模式面板
│   ├── ThemePickerModal.tsx  # 主题选择弹窗
│   ├── StreamingOutline.tsx  # 流式大纲组件
│   └── ...
├── lib/                   # 核心库函数
│   ├── minimax-client.ts  # MiniMax API 客户端
│   ├── deepseek-client.ts # DeepSeek API 客户端（备用）
│   ├── ai/
│   │   └── fallback-orchestrator.ts  # AI 多 provider  fallback 逻辑
│   ├── adapters/
│   │   └── ppt-param-adapter.ts      # 参数规范化 + fallback outline
│   ├── gamma-theme-mapping.ts        # Gamma 主题映射
│   ├── theme-database.ts             # 主题数据库（102个主题）
│   ├── auth-context.tsx              # 认证状态管理
│   ├── credits.ts                    # 积分系统
│   └── ...
└── types/                 # TypeScript 类型定义
```

---

## 2. 核心模块详解

### 2.1 API Routes

#### `/api/outline` - 大纲生成（AI 入口）

**文件**: `src/app/api/outline/route.ts`

**职责**: 接收用户输入，调用 AI 生成 PPT 大纲

**流程**:
1. 接收参数: `inputText`, `slideCount`, `textMode`, `auto`, `themeId`
2. 速率限制检查
3. 构建 system prompt + user prompt
4. 调用 `callWithFallback()` → MiniMax 或 DeepSeek
5. JSON 解析响应
6. 如果 AI 失败 → fallback 到 `generateMinimalOutline()` 生成"核心要点1/2/3"占位符
7. 返回 `{ title, slides[], themeId, tone, imageMode }`

**关键函数**:
- `tryParseJson()` - 多层 JSON 解析 + 截断修复 + 正则提取
- `analyzeInputType()` - 分析输入类型（短文本/长文本/结构化）
- `detectScene()` - 场景检测（商务/教育/创意等）
- `generateMinimalOutline()` - **AI 失败时的 fallback**（生成"核心要点1/2/3"占位符）

**问题**: AI 全部失败时显示占位符而非报错

---

#### `/api/gamma` - PPT 生成

**文件**: `src/app/api/gamma/route.ts`

**职责**: 调用 Gamma API 生成 PPT

**流程**:
1. 接收 `{ slides[], themeId, tone, imageOptions }`
2. 轮换 Gamma API Key
3. 创建 generation (POST /generations)
4. 轮询状态 (GET /generations/{id})
5. 完成 → 触发积分扣除
6. 返回 `{ pptxUrl, gammaUrl, generationId }`

---

#### `/api/user` - 用户系统

**文件**: `src/app/api/user/route.ts`

**职责**: 用户注册/登录/积分管理

**功能**:
- `send_code` - 发送短信验证码
- `register` - 注册（含验证码校验）
- `verify_code` - 验证码登录
- `login` - 密码登录
- `deduct_credits` - 积分扣除
- `rollback` - 积分回滚（生成失败时）

---

### 2.2 page.tsx - 主流程控制

**文件**: `src/app/page.tsx` (约 2000 行)

**状态机**:
```
landing → input → streaming → outline → generating → result
                              ↓
                    direct-generating → result
```

**省心模式 (smart)**:
1. 用户输入主题 → `/api/outline` 生成大纲
2. 进入 `outline` 阶段 → 显示大纲卡片（可编辑）
3. 用户确认 → 调用 `/api/gamma` 生成 PPT
4. 进入 `result` 阶段 → 显示下载/预览链接

**专业模式 (direct)**:
1. 用户配置 `theme`, `tone`, `imageMode`, `textMode`
2. 直接调用 `/api/gamma` 生成
3. 进入 `result` 阶段

**关键状态**:
- `phase`: 决定显示哪个 UI 阶段
- `smartGammaPayload`: 省心模式的 Gamma 参数
- `outlineResult`: AI 生成的大纲结果
- `editedSlides`: 用户编辑后的大纲

---

### 2.3 AI 调用链

```
page.tsx
    ↓ fetch('/api/outline')
    ↓
outline/route.ts
    ↓ callWithFallback()
    ↓
fallback-orchestrator.ts
    ├→ minimax-client.ts (MiniMax-M2.7)
    └→ deepseek-client.ts (deepseek-chat) ← 备用
```

**Fallback 顺序**: MiniMax → DeepSeek → MiniMax 重试

**问题记录**:
- MiniMax 返回 429 (配额耗尽)
- DeepSeek 返回 401 (key 无效或过期)

---

### 2.4 关键组件

| 组件 | 职责 |
|------|------|
| `StreamingOutline.tsx` | 流式显示大纲生成进度（analyzing → planning → generating → polishing → complete） |
| `ThemeSelector.tsx` | 主题选择器（按色系分类） |
| `ThemePickerModal.tsx` | 主题弹窗（可修改 theme/tone/imgMode） |
| `ProPanel.tsx` | 专业模式参数面板 |
| `GenerationProgress.tsx` | 生成进度条 |
| `PDFPreview.tsx` | PDF 预览弹窗（v10.47 新增） |

---

### 2.5 主题系统

**文件**: `src/lib/theme-database.ts`

- 102 个 Gamma 官方主题
- 按色系分类: 蓝色/灰色/紫色/棕色/粉色/暖色/金色
- 每个主题: `{ id, name, nameZh, colors[], category, emoji }`

**主题映射**: `gamma-theme-mapping.ts`
- 将主题 ID 映射到 Gamma API 标准 ID

---

## 3. 数据流

```
用户输入主题
    ↓
page.tsx: collectText() 合并 files + topic
    ↓
fetch('/api/outline', { inputText, slideCount, textMode, auto, themeId })
    ↓
outline/route.ts
    ├→ normalizeUserInput() 规范化参数
    ├→ analyzeInputType() 分析输入类型
    ├→ 构建 system prompt + user prompt
    └→ callWithFallback() 调用 AI
        ├→ MiniMax → 成功 → tryParseJson()
        └→ DeepSeek → 备用
    ↓
    ├→ 成功 → 返回 { title, slides[], themeId }
    └→ 失败 → generateMinimalOutline() → 返回占位符
    ↓
page.tsx: setOutlineResult(od) → setPhase('outline')
    ↓
用户编辑大纲 → confirmAndGenerate()
    ↓
fetch('/api/gamma', { slides, themeId, tone, imageOptions })
    ↓
Gamma API 生成 PPT
    ↓
返回 { pptxUrl, gammaUrl }
    ↓
PDFPreview 或下载链接
```

---

## 4. 已知问题

### P0 - 影响核心功能

1. **AI 失败显示占位符**
   - 现象: 大纲显示"核心要点1/2/3"占位符
   - 根因: MiniMax 429 + DeepSeek 401，AI 全部失败
   - 当前处理: fallback 到 `generateMinimalOutline()`
   - 建议: 返回错误而非占位符，让用户重试或换 API Key

2. **主题参数传递**
   - 省心模式用户选择的主题在 AI 失败时被硬编码覆盖
   - 已修复: `od.themeId || 'ash'` (灰色系而非蓝色 consultant)

### P1 - 需要优化

1. **StreamingOutline 是假流式**
   - 实际上一次性返回大纲，前端模拟流式动画
   - 真实流式需要 Gamma 的 SSE

2. **DeepSeek Key 401**
   - Key 可能无效或过期
   - 需要验证或更换

3. **JSON 截断修复**
   - 正则提取可能不完整
   - 可考虑更激进的修复策略

---

## 5. 环境变量

| 变量 | 用途 | 状态 |
|------|------|------|
| `MINIMAX_API_KEY` | 大纲生成 | ⚠️ 配额耗尽 (429) |
| `DEEPSEEK_API_KEY` | 备用 AI | ❌ 401 无效 |
| `GAMMA_API_KEY` | PPT 生成 | ✅ 正常 |
| `SUPABASE_URL` | 数据库 | ✅ 正常 |
| `SUPABASE_SERVICE_ROLE_KEY` | 数据库 | ✅ 正常 |

---

## 6. 待处理

- [ ] 解决 AI API 问题（充值 MiniMax 或更换 DeepSeek Key）
- [ ] 优化 AI 失败时的用户体验（报错而非占位符）
- [ ] 实现真实流式大纲（Gamma SSE）
- [ ] P1 Bug 修复: hasUserEditedSlides、变量名不一致
- [ ] 修复编译警告 (gamma-bugs.test.ts、payment/route.ts)

---

*文档生成时间: 2026-05-10*
*生成者: OpenClaw main agent → coder subagent*