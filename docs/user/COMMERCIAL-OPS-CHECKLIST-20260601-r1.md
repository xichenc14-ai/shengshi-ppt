# 商业化上线运维执行清单（r1）

- 日期: 2026-06-01
- 版本: v10.80.2
- 目标: 支付与下载链路在生产环境达到可商用

## A. 生产环境变量注入（必须）

### 核心
- `NEXT_PUBLIC_SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `SESSION_PASSWORD`
- `PAYMENT_NOTIFY_URL`（必须 `https://...`）
- `PAYMENT_NOTIFY_SECRET`（用于 `x-payment-notify-secret` 鉴权）

### 微信支付（模板模式或SDK模式二选一）
1. 模板模式（快速上线）
- `PAYMENT_WECHAT_URL_TEMPLATE` 或 `PAYMENT_WECHAT_QRCODE_TEMPLATE`

2. SDK模式（正式直连）
- `WECHAT_PAY_MCH_ID`
- `WECHAT_PAY_APP_ID`
- `WECHAT_PAY_API_V3_KEY`
- `WECHAT_PAY_API_KEY`

### 支付宝（模板模式或SDK模式二选一）
1. 模板模式（快速上线）
- `PAYMENT_ALIPAY_URL_TEMPLATE` 或 `PAYMENT_ALIPAY_QRCODE_TEMPLATE`

2. SDK模式（正式直连）
- `ALIPAY_APP_ID`
- `ALIPAY_PRIVATE_KEY`
- `ALIPAY_PUBLIC_KEY`

## B. 服务端安全项
1. 回调IP白名单（必须）
- 配置 `ALLOWED_CALLBACK_IPS`
- 未配置时系统会拒绝回调（安全策略）

2. 通知鉴权（必须）
- 生产环境请求 `/api/payment-notify` 必须携带：
  - Header: `x-payment-notify-secret: <PAYMENT_NOTIFY_SECRET>`

## C. 上线前命令验收（在生产配置注入后执行）
1. `npm run -s env:commercial`
2. `npm run -s preflight:commercial`
3. `npm run -s audit:commercial`
4. `npm run -s go-live:commercial`

通过标准：以上 4 个命令全部通过。

## D. 端到端支付联调（单次下载）

### D1. 免费用户触发按页付费
- 前端导出 PPTX，触发“按页付费”弹层
- 选择支付方式：积分 / 微信 / 支付宝

### D2. Provider 下单
- 调用 `POST /api/pay-once`（`payMode=provider`）
- 返回 `orderNo`、`providerOrderId`、`payUrl/qrCodeUrl`

### D3. 支付回调
- 支付成功后回调 `POST /api/payment`（`action=callback`）
- 订单状态更新为 `completed`

### D4. 领取下载
- 前端轮询 `GET /api/pay-once?orderNo=<...>&userId=<...>`
- 返回 `paid=true` + `downloadUrl`
- 下载成功后订单 metadata 写入 `fulfilled=true`

### D5. 验收断言
- 订单状态: `pending -> completed`
- 金额校验: 回调金额与订单金额一致
- 下载可用: `downloadUrl` 可直接下载 `.pptx`

## E. 会员订阅链路抽测
1. 创建订阅订单 `POST /api/payment`（`action=create_order`）
2. 支付成功回调后：
- 用户 `plan_type` 升级
- `credits` 增加
- `orders.status=completed`

## F. 故障回滚策略
1. 若支付链路异常：
- 保留会员入口，临时下线 provider 单次付费入口（仅保留积分路径）

2. 回滚基线
- 使用备份目录：`backups/release-commercial-v10.80.2-20260601-104718`

