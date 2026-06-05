# 商业化冲刺状态（r24）

- 日期: 2026-06-01
- 版本: v10.80.2

## 本轮新增
1. 最小上线路径 Vercel 注入脚本模板
- 文件: `ops/templates/vercel-env-minimal.example.sh`
- 能力: 填值后可直接批量执行 `vercel env add ... production`

2. 最小上线路径环境断言脚本
- 文件: `scripts/commercial-env-assert.mjs`
- 命令: `npm run -s env:commercial:assert`
- 断言内容:
  - core 必填变量
  - `PAYMENT_NOTIFY_URL` https 校验
  - WeChat/Alipay 至少一条 template 路径可用

3. package 脚本新增
- `env:commercial:assert`

## 实测结果
- `env:commercial:assert` 当前失败（符合预期）：
  - 缺失 `PAYMENT_NOTIFY_URL`, `PAYMENT_NOTIFY_SECRET`, `ALLOWED_CALLBACK_IPS`

## 结论
- 商业化上线执行链进一步闭环：
  - 注入模板 -> 变量断言 -> doctor诊断 -> go-live门禁
- 正式部署仍仅受外部生产变量注入阻断。
