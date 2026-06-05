# 商业化环境变量注入操作单（v10.80.2）

更新时间：2026-06-01

## 目标

把生产环境变量一次性注入完整，确保以下命令转绿：

1. `npm run -s env:commercial`
2. `npm run -s preflight:commercial`
3. `npm run -s go-live:commercial`

## 必填变量（P0）

1. 核心
- `NEXT_PUBLIC_SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `SESSION_PASSWORD`（建议 32 位以上随机字符串）
- `PAYMENT_NOTIFY_URL`（必须 `https://`，推荐正式域名 + `/api/payment`）

2. 支付（二选一，建议至少先走模板模式）
- 微信模板模式：`PAYMENT_WECHAT_URL_TEMPLATE` / `PAYMENT_WECHAT_QRCODE_TEMPLATE`
- 支付宝模板模式：`PAYMENT_ALIPAY_URL_TEMPLATE` / `PAYMENT_ALIPAY_QRCODE_TEMPLATE`

或

- 微信 SDK 模式：`WECHAT_PAY_MCH_ID`、`WECHAT_PAY_APP_ID`、`WECHAT_PAY_API_V3_KEY`
- 支付宝 SDK 模式：`ALIPAY_APP_ID`、`ALIPAY_PRIVATE_KEY`、`ALIPAY_PUBLIC_KEY`

## 推荐补充变量（P1）

- `ADMIN_DASHBOARD_KEY`
- `ADMIN_USER_IDS`
- `ADMIN_USER_PHONES`

## 注入后验证步骤

1. 环境就绪
```bash
npm run -s env:commercial
```
期望：`Overall: READY`

2. 商业化体检
```bash
npm run -s preflight:commercial
```
期望：`PASS`

3. 一键 go-live 验证
```bash
npm run -s go-live:commercial
```
期望：`PASS`

4. 审计报告留档
- 最新 `docs/user/COMMERCIAL-AUDIT-*.md` 结论应为 `PASS`

## 常见失败与排查

1. `PAYMENT_NOTIFY_URL` 缺失或非 HTTPS
- 修正为 `https://your-domain.com/api/payment`

2. 支付 provider 未就绪
- 模板模式下至少配置对应 provider 的 URL/QR 模板变量
- SDK 模式下三元组必须完整

3. 本地通过、线上失败
- 检查部署平台环境变量作用域（Production / Preview）
- 确认已触发新部署并使用最新环境
