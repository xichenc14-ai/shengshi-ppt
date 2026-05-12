# 省心PPT 更新日志

> **版本**: v10.50
> **最后更新**: 2026-05-12

---

## v10.50 (2026-05-12)

### ✅ 核心修复

- **站内预览链路重构（不再依赖 Gamma 页面嵌入）**
  - 预览改为后端代理文件流：`/api/preview/file`
  - 规避 `gamma.app 拒绝连接请求` 的 iframe 限制问题

- **PDF 预览稳定化**
  - 生成主任务默认导出 `pdf`，结果页自动加载 PDF 预览
  - 预览从弹窗二级页改为结果页一级内联区域

- **PPTX 下载保障**
  - 保留 PPTX 下载能力
  - 当主任务为 PDF 时，下载时自动补跑 PPTX 任务并下载

- **首页交互改版**
  - 首页默认直接进入输入编辑页
  - 专业模式高级参数默认折叠（可展开）

### 📘 文档

- 新增技术复盘报告：`docs/technical/REPORT-2026-05-12-preview-outline-homepage.md`
- 记录本轮设计决策、根因分析、验证证据、后续建议

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
