# M1 安全修复报告 — Tech-Dept 执行结果

**时间:** 2026-05-17 18:08 GMT+8  
**执行者:** Tech-Dept  
**项目:** 省心PPT (shengxinppt.lol)  
**项目路径:** `/Users/macmini/shengshi-ppt/`  

---

## 执行摘要

**结论：无法执行 — 审计依据与项目实际结构不匹配**

M1 auditor 报告的 `backend/modules/` 和 `backend/ai/` 目录在项目中不存在，且 `cmd_create()` 和 `download_file()` 函数也未找到。经核实，该项目的实际架构如下：

| 审计假设 | 实际情况 |
|----------|----------|
| `backend/modules/` 目录 | **不存在** — 项目是 Next.js 应用，无 `backend/` 目录 |
| `backend/ai/` 目录 | **不存在** — AI 逻辑在 `src/lib/ai/` (TypeScript) |
| `cmd_create()` 函数 | **不存在** — 全项目无此函数 |
| `download_file()` 函数 | **不存在** — 全项目无此函数 |
| 7个 modules 文件 | **不适用** — 应在 Next.js API routes 中实现 |
| 5个 ai 文件 | **部分存在** — `src/lib/ai/` 已有 2 个 TypeScript 文件 |

---

## 项目实际架构

```
/Users/macmini/shengshi-ppt/
├── src/
│   ├── app/                    # Next.js App Router
│   │   ├── page.tsx           # 首页 (主流程)
│   │   └── api/               # API Routes (TypeScript)
│   │       ├── outline/       # 大纲生成
│   │       ├── gamma/         # Gamma PPT 生成
│   │       ├── gamma-direct/  # 专业模式
│   │       ├── download/      # 文件下载
│   │       └── ppt-local/     # 本地 LLM + python-pptx
│   ├── lib/                   # 核心库
│   │   ├── ai/                # AI 工具 (TypeScript)
│   │   │   ├── fallback-orchestrator.ts
│   │   │   └── provider-key.ts
│   │   ├── minimax-client.ts
│   │   ├── gamma-api.ts
│   │   └── theme-database.ts
│   └── components/            # React 组件
└── scripts/
    └── ppt-local/
        └── ppt_local_generator.py  # python-pptx 生成器
```

---

## 审计假设 vs 实际

### 1. `backend/modules/` 不存在的问题

M1 auditor 期望的 `backend/modules/` 目录（image_handler.py, chart_generator.py 等）在本项目中不存在。该项目的 PPT 生成逻辑：

- **Python 层**: `scripts/ppt-local/ppt_local_generator.py` (python-pptx)
- **TypeScript 层**: `src/app/api/ppt-local/route.ts` (API 入口)
- **图片处理**: 通过 `/api/preview-proxy` 等路由处理

**因此不需要创建 `backend/modules/`** — 功能已在现有文件中实现。

### 2. `backend/ai/` 不存在的问题

`src/lib/ai/` 已存在，包含：
- `fallback-orchestrator.ts` — 多 provider fallback 逻辑
- `provider-key.ts` — API Key 管理

### 3. `cmd_create()` 命令注入漏洞 — 未找到

全项目搜索 `cmd_create` 无结果。该函数不存在于任何代码文件中。

### 4. `download_file()` 路径遍历漏洞 — 未找到

全项目搜索 `download_file` 无结果。该函数不存在于任何代码文件中。

**注意**: `src/app/api/download/route.ts` 存在，职责是文件下载，但未发现 `download_file` 辅助函数。

---

## 无法修复的原因

M1 auditor 的发现基于一个**不存在的项目结构假设**。本项目是 Next.js 应用，而非带有独立 `backend/` Python 目录的项目。`cmd_create()` 和 `download_file()` 函数从未存在于本项目中。

强行创建 `backend/modules/` 和 `backend/ai/` 目录并填充空文件会：
1. 制造与项目架构不一致的噪声代码
2. 不会实际修复任何真实存在的安全漏洞
3. 违反项目架构规范

---

## 建议

| 优先级 | 建议 | 说明 |
|--------|------|------|
| 🔴 P1 | 重新审计项目结构 | M1 auditor 需先确认实际项目结构再审计 |
| 🟡 P2 | 审计 `src/app/api/download/route.ts` | 检查实际文件下载逻辑是否有路径遍历风险 |
| 🟡 P2 | 审计 `scripts/ppt-local/ppt_local_generator.py` | Python 脚本中是否有命令注入风险 |
| 🟡 P2 | 审计 `src/app/api/ppt-local/route.ts` | spawn python3 调用是否安全 |
| ✅ 已存在 | `src/lib/ai/` | AI 模块已有合理结构 |

---

## 结论

**本次任务无法按原审计报告执行。** 原因是 M1 auditor 的审计对象（`backend/modules/`, `backend/ai/`, `cmd_create()`, `download_file()`）与项目实际代码库不符。建议由 tech-lead 确认正确的审计范围后重新发起。

---

*Tech-Dept — 2026-05-17*
