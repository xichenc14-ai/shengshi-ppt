# 省心PPT 更新日志

> **版本**: v10.45
> **最后更新**: 2026-05-10

---

## v10.45 (2026-05-10)

### 🐛 修复

- **imageSource 映射错误修复**
  - `theme-img` → `themeAccent` ✅（之前已正确）
  - `theme` → `themeAccent` ✅（之前错误映射为 `pictographic`）
  - 影响范围：`/api/gamma-direct`、`/api/gamma` 的图片源选择

### 🔧 优化

- **AI 服务架构统一**
  - 移除 GLM（智谱）客户端，统一使用 MiniMax
  - 移除 Kimi（月之暗面）客户端
  - 简化 fallback 逻辑，降低多 provider 维护成本

### 📖 文档

- 新增 `docs/api/gamma-api.md` - Gamma API 官方文档（含 textMode 架构说明）
- 新增 `docs/api/minimax-api.md` - MiniMax API 官方文档
- 更新 `docs/technical/ARCHITECTURE.md` - 记录架构决策
- 新增 `docs/user/changelog.md` - 用户可见更新日志

---

## 历史版本

> 更早版本请查看 Git 提交记录

| 版本 | 日期 | 主要更新 |
|------|------|----------|
| v10.43 | 2026-05-09 | 省心定制功能上线 |
| v10.14 | 2026-04-20 | 主题映射系统 V8 |
| v10.5 | 2026-04-15 | 会员订阅体系 |
| v6 | 2026-04-13 | 兮晨哥哥扣费表实施 |
