# 回退标记（2026-06-01）

- 状态：已回退，当前生产以 4 小时前版本为准。
- 原因：本轮 UI 重构不符合验收预期，禁止继续使用本轮产物。
- 处理范围：
  - `src/app/page.tsx`
  - `src/components/ThemeSelector.tsx`
  - `src/app/api/gamma/route.ts`
  - `src/app/api/gamma-direct/route.ts`
- 执行说明：上述文件已在本地恢复到仓库基线（撤销本轮改动）。
- 发布策略：后续 UI 调整先走预览域名验收，通过后再切生产。
