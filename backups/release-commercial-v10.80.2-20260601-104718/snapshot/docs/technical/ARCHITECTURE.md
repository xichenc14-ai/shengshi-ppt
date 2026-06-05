# 省心PPT - 技术设计决策

> **版本**: v1.1
> **最后更新**: 2026-05-10

---

## 架构决策

### AD-001: AI 服务统一为 MiniMax ✅ 已完成
- **日期**: 2026-05-10
- **状态**: 已完成（v10.45）
- **决策**: 统一所有 AI 服务使用 MiniMax
  - 移除 GLM（智谱）客户端 (`src/lib/glm-client.ts` 已标记废弃)
  - 移除 Kimi（月之暗面）客户端 (`src/lib/kimi-client.ts` 已标记废弃)
  - 统一使用 MiniMax-M2.7 进行文本生成（大纲生成、内容分析）
  - 图片理解使用 MiniMax-VL-01
  - 图片生成使用 MiniMax image-01
- **原因**: 兮晨哥哥要求统一使用原生 MiniMax key，简化架构
- **影响范围**: outline API、understand-image API

### AD-002: Gamma textMode 固定为 preserve
- **日期**: 2026-05-10
- **状态**: 已实施
- **决策**: Gamma API 的 textMode 参数固定为 `'preserve'`
- **原因**: 
  - 内容扩写/精简逻辑在 outline API 预处理阶段完成
  - Gamma 在省心PPT架构中仅承担排版渲染职责
  - 将 textMode 固定为 preserve 确保 Gamma 忠实呈现 outline API 已处理的内容
- **受影响API**: `/api/gamma-direct`（固定 `'preserve'`）

### AD-003: imageSource 映射统一
- **日期**: 2026-05-10
- **状态**: 已修复（v10.45）
- **决策**: 统一使用 `mapImgModeToSource()` 函数处理图片模式映射
- **修复内容**:
  - `theme-img` → `themeAccent` ✅
  - `theme` → `themeAccent` ✅（原错误映射为 `pictographic`）
  - `web` → `webFreeToUseCommercially` ✅
  - `ai` / `ai-pro` → `aiGenerated` ✅
  - `none` → `noImages` ✅

---

## 技术选型

### Gamma API
- **用途**: PPT 渲染和导出
- **版本**: v1.0
- **key 管理**: 密钥池轮询
- **textMode**: 固定 `'preserve'`

### MiniMax
- **用途**: 文本生成、大纲生成、图片理解、图片生成
- **文本模型**: MiniMax-M2.7（8K上下文，8192输出）
- **视觉模型**: MiniMax-VL-01
- **生图模型**: image-01

### Supabase
- **用途**: 数据库、用户管理
- **服务角色**: 使用 SERVICE_ROLE_KEY

---

## 安全策略

1. API Keys 全部使用环境变量
2. 用户密码使用 bcrypt 加密
3. 支付签名验证（微信/支付宝）
4. 速率限制按 IP + User ID

---

## 性能优化

### 缓存策略
- Gamma API 结果缓存
- 主题数据库缓存

### 熔断机制
- AI 服务 fallback（已简化为仅 MiniMax）
- 速率限制降级

---

## 更新日志

| 日期 | 版本 | 更新内容 |
|------|------|----------|
| 2026-05-10 | v1.1 | AI统一决策、Gamma textMode决策、imageSource映射修复 |
| 2026-05-10 | v1.0 | 初始文档，添加 AI 统一化决策 |
