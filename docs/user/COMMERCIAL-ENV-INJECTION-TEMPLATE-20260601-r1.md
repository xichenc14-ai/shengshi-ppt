# 商业化生产环境注入模板（可直接执行）

- 日期: 2026-06-01
- 版本: v10.80.2
- 目标: 一次性补齐 `go-live:commercial` 所需变量

## 1. 必填变量清单（与门禁对齐）

### Core
- `NEXT_PUBLIC_SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `SESSION_PASSWORD`
- `PAYMENT_NOTIFY_URL`（必须 `https://...`）
- `PAYMENT_NOTIFY_SECRET`

### WeChat（模板模式或SDK模式至少满足一种）
- 模板模式（推荐首发）
  - `PAYMENT_WECHAT_URL_TEMPLATE` 或 `PAYMENT_WECHAT_QRCODE_TEMPLATE`
- SDK模式
  - `WECHAT_PAY_MCH_ID`
  - `WECHAT_PAY_APP_ID`
  - `WECHAT_PAY_API_V3_KEY`
  - `WECHAT_PAY_API_KEY`

### Alipay（模板模式或SDK模式至少满足一种）
- 模板模式（推荐首发）
  - `PAYMENT_ALIPAY_URL_TEMPLATE` 或 `PAYMENT_ALIPAY_QRCODE_TEMPLATE`
- SDK模式
  - `ALIPAY_APP_ID`
  - `ALIPAY_PRIVATE_KEY`
  - `ALIPAY_PUBLIC_KEY`

### 回调安全
- `ALLOWED_CALLBACK_IPS`（逗号分隔，生产必填）

## 2. Vercel 注入（CLI）

> 在项目根目录执行。以下示例按 `production` 环境注入。

```bash
# Core
printf '%s' 'https://your-project.supabase.co' | vercel env add NEXT_PUBLIC_SUPABASE_URL production
printf '%s' 'your_service_role_key' | vercel env add SUPABASE_SERVICE_ROLE_KEY production
printf '%s' 'replace_with_32_plus_chars' | vercel env add SESSION_PASSWORD production
printf '%s' 'https://your-domain.com/api/payment' | vercel env add PAYMENT_NOTIFY_URL production
printf '%s' 'replace_with_long_random_secret' | vercel env add PAYMENT_NOTIFY_SECRET production

# Callback IP allowlist
printf '%s' '1.2.3.4,5.6.7.' | vercel env add ALLOWED_CALLBACK_IPS production

# WeChat (template mode)
printf '%s' 'https://pay.example.com/wx?order={orderNo}&amount={amountFen}' | vercel env add PAYMENT_WECHAT_URL_TEMPLATE production
printf '%s' 'https://pay.example.com/wx-qr?order={orderNo}' | vercel env add PAYMENT_WECHAT_QRCODE_TEMPLATE production

# Alipay (template mode)
printf '%s' 'https://pay.example.com/ali?order={orderNo}&amount={amountFen}' | vercel env add PAYMENT_ALIPAY_URL_TEMPLATE production
printf '%s' 'https://pay.example.com/ali-qr?order={orderNo}' | vercel env add PAYMENT_ALIPAY_QRCODE_TEMPLATE production
```

## 2.1 最小可上线配置（Template模式，最快）

若目标是最快通过商业门禁并上线可用支付，先填以下最小集合：

- Core 全量：
  - `NEXT_PUBLIC_SUPABASE_URL`
  - `SUPABASE_SERVICE_ROLE_KEY`
  - `SESSION_PASSWORD`
  - `PAYMENT_NOTIFY_URL`（https）
  - `PAYMENT_NOTIFY_SECRET`
  - `ALLOWED_CALLBACK_IPS`
- WeChat 先填一个模板变量：
  - `PAYMENT_WECHAT_URL_TEMPLATE`（或 `PAYMENT_WECHAT_QRCODE_TEMPLATE`）
- Alipay 先填一个模板变量：
  - `PAYMENT_ALIPAY_URL_TEMPLATE`（或 `PAYMENT_ALIPAY_QRCODE_TEMPLATE`）

说明：该组合可先达成门禁可用；后续再补 SDK 直连变量。

## 3. 本地 `.env.production.local` 模板

复制文件：`ops/templates/env.production.commercial.template` -> `.env.production.local`，按真实值替换。

## 4. 注入后验收（必须顺序执行）

```bash
npm run -s env:commercial:doctor
npm run -s env:commercial:assert
npm run -s env:commercial
npm run -s preflight:commercial
npm run -s audit:commercial
npm run -s go-live:commercial
```

通过标准：6 个命令全部 PASS。

## 5. 单次下载支付链路抽测

1. 免费用户导出触发按页付费
2. 选择微信/支付宝，创建 provider 订单
3. 支付完成后，前端轮询 `GET /api/pay-once` 成功领取下载链接
4. 文件下载成功，订单 metadata 出现 `fulfilled=true`
