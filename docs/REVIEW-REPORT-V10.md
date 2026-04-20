# 省心PPT 代码审查报告 V10
> 版本：v10.0.0（发布于 2026-04-21）
> 审查时间：2026-04-21 02:50 GMT+8
> 审查范围：17 个 API routes + 关键库文件
> 审查人：管家（自动审查 + 子 agent 协助）

---

## 🔴 严重问题（已修复 ✅）

### 1. SSRF 漏洞 — `export/route.ts`
**风险**：攻击者可利用 `?url=` 参数探测内网（169.254.169.254、localhost:3000 等）
**修复**：添加 URL 白名单校验，只允许 `assets.api.gamma.app` 和 `gamma.app` 域名

### 2. 硬编码 Debug Token — `user/route.ts`
**风险**：`DEBUG_TOKEN || 'xichen-debug-2026'` 默认值，生产环境也可用
**修复**：移除默认值，必须设置 `DEBUG_TOKEN` 环境变量

### 3. 生产环境返回明文验证码 — `user/route.ts`
**风险**：生产环境 `send_code` 返回 `code: finalCode`，可能被窃取
**修复**：仅开发环境返回 `code` 字段，生产环境不返回

### 4. 无用户身份验证 — `credits/route.ts`
**风险**：任何人可为任意 userId 创建订单（当前占位 user_id 所以暂无实际损失）
**修复**：添加 `Authorization` header 校验，拒绝未登录用户

### 5. `gamma-balance` 使用单 key — `gamma-balance/route.ts`
**风险**：使用已废弃的 `GAMMA_API_KEY` 环境变量，而非 `GAMMA_API_KEYS` key 池
**修复**：改用 `getKeyPoolStatus()` 返回完整 key 池监控

### 6. `tryParseJson` 数组/对象判断 bug — `outline/route.ts`
**风险**：截断修复时对对象（`{}`）错误添加 `]`，导致 JSON 无法解析
**修复**：先判断是数组还是对象，分别处理闭合符

---

## 🟡 中等问题（已修复 ✅）

### 7. 代码重复 — `gamma/route.ts` ↔ `gamma-direct/route.ts`
**问题**：`SCENE_CONFIGS`、`INSTRUCTION_TEMPLATES`、深色主题处理逻辑完全重复
**修复**：提取到 `lib/gamma-config.ts` 共享模块，两个 route 共同引用

### 8. `gamma-direct` 无 429 重试机制
**问题**：`gamma/route.ts` 有完善的退避重试，但 `gamma-direct` 遇到限流直接失败
**修复**：添加 3 次退避重试机制（与 gamma/route.ts 一致）

---

## 🟢 轻微问题（已记录，待后续处理）

| 文件 | 问题 | 优先级 |
|------|------|--------|
| `user/route.ts` | SHA-256 密码哈希（非 bcrypt） | 低（需大改） |
| `export/route.ts` | 内存缓存在 Vercel Serverless 无效 | 低（需 Redis） |
| `export-watermarked/route.ts` | 大 PDF 可能 OOM（无页数限制） | 低 |
| `smart-outline/route.ts` | AI fallback 无重试 | 低 |
| `preview-pdf/route.ts` | 无 rate limit | 低 |
| `outline/route.ts` | `Math.random()` 生成 slide ID | 低 |

---

## 📁 文件变更汇总（v10.0.0）

```
src/
├── lib/
│   ├── gamma-config.ts          ← 新增（共享配置模块）
│   └── version.ts               ← 新增（版本管理模块）
├── components/
│   └── AnnouncementBar.tsx      ← 新增（公告栏组件）
├── app/
│   ├── api/
│   │   ├── export/route.ts          ← SSRF 修复
│   │   ├── user/route.ts            ← debug token + 验证码明文修复
│   │   ├── credits/route.ts         ← 身份验证修复
│   │   ├── gamma/route.ts           ← 使用共享配置
│   │   ├── gamma-direct/route.ts    ← 共享配置 + 429 重试
│   │   ├── gamma-balance/route.ts   ← 使用 key 池状态
│   │   └── outline/route.ts         ← tryParseJson bug 修复
│   ├── account/page.tsx          ← 引用 VERSION 常量
│   └── page.tsx                  ← 添加公告栏组件
└── components/
    └── Footer.tsx                ← 引用 VERSION 常量
```

---

## ✅ v10.0.0 修复完成清单

- [x] SSRF 漏洞（export/route.ts）
- [x] 硬编码 debug token（user/route.ts）
- [x] 明文验证码返回（user/route.ts）
- [x] credits 无认证（credits/route.ts）
- [x] gamma-balance 单 key（gamma-balance/route.ts）
- [x] tryParseJson bug（outline/route.ts）
- [x] 代码重复（提取 gamma-config.ts）
- [x] gamma-direct 无 429 重试
- [x] TypeScript 零错误验证
- [x] 版本号更新：v9.5.1 → v10.0.0（lib/version.ts）
- [x] 公告栏组件（AnnouncementBar）
- [x] 已 push 到 GitHub（commits: 69bcab3, 8a59fc9, 8773697）

---

## 📌 后续发版流程

1. 修改 `src/lib/version.ts` 的 `VERSION` + `VERSION_NOTES`
2. 添加 `VERSION_HISTORY` 记录（severity: major/minor/patch）
3. `git push` → Vercel 自动部署
4. 网站版本号 + 公告栏自动更新

---

## 🔍 待后续推进（非紧急）

1. **密码哈希升级**：从 SHA-256 升级到 bcrypt（需数据库迁移）
2. **内存缓存 → Redis**：解决 Vercel Serverless 缓存失效问题
3. **PDF 水印中文支持**：嵌入中文字体（需字体文件或切换方案）
4. **会员体系**：省心 19.9 / 尊享 49.9（需支付渠道）
5. **AI 重试机制**：smart-outline 的 callAI 每个模型加 1 次重试
