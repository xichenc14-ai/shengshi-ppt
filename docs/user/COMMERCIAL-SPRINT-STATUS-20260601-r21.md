# 商业化冲刺状态（r21）

- 日期: 2026-06-01
- 版本: v10.80.2

## 本轮新增
1. 升级 `env:commercial:doctor` 输出
- 文件: `scripts/commercial-env-doctor.mjs`
- 新能力:
  - 缺失变量不仅给出 `export` 建议
  - 还会给出可复制的 `vercel env add ... production` 命令
  - 对 WeChat/Alipay 自动给出 template 路径与 SDK 路径建议

2. 与运维目标对齐
- 该能力用于缩短“环境注入 -> go-live通过”的执行路径

## 实测
- `npm run -s env:commercial:doctor` 已输出 Vercel CLI 建议
- 当前仍是 `NOT_READY`（因生产变量未注入）

## 当前阻断（外部）
- `PAYMENT_NOTIFY_URL`
- `PAYMENT_NOTIFY_SECRET`
- `WECHAT_PAY_MCH_ID`, `WECHAT_PAY_APP_ID`, `WECHAT_PAY_API_V3_KEY`
- `ALIPAY_APP_ID`, `ALIPAY_PRIVATE_KEY`, `ALIPAY_PUBLIC_KEY`

## 结论
- 代码、测试、文档、运维指引均已就绪；
- 正式商业部署达成只差生产环境变量注入与真实支付联调执行。
