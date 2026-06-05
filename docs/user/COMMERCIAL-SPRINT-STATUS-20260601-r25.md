# 商业化冲刺状态（r25）

- 日期: 2026-06-01
- 版本: v10.80.2

## 本轮新增
1. 一键商业化发布门禁总控脚本
- 文件: `scripts/commercial-release-gate.mjs`
- 命令: `npm run -s release-gate:commercial`
- 执行顺序:
  1) `env:commercial:assert`
  2) `env:commercial:doctor`
  3) `env:commercial`
  4) `preflight:commercial`
  5) `audit:commercial`
  6) `go-live:commercial`

2. package scripts 新增
- `release-gate:commercial`

## 实测
- `release-gate:commercial` 已执行
- 当前在 `Assert minimal env` 阶段失败（符合预期，因生产变量未注入）

## 结论
- 商业化发布前验收流程已标准化为单命令
- 正式上线仍仅受外部环境注入阻断
