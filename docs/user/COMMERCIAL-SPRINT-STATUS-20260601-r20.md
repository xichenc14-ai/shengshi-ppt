# 商业化冲刺状态（r20）

- 日期: 2026-06-01
- 版本: v10.80.2
- 目标: 商业化部署达标 + 手机端UI适配

## 本轮新增落地

### 1) 支付回调到单次下载订单完成的自动化测试补齐
- 新增测试文件: `__tests__/api/payment-callback-download-once.test.ts`
- 覆盖场景:
  1. `POST /api/payment` 回调 `action=callback`
  2. `product_type=download_once` + 支付成功状态
  3. 订单更新为 `completed` 且 metadata 打上 `fulfilled=false`

### 2) 前序已完成能力（本轮持续有效）
- `/api/pay-once` provider 下单能力
- `/api/pay-once` 已支付领取下载能力（GET轮询）
- 前端单次付费弹层支持 `积分/微信/支付宝` 三种路径并接通 provider 轮询下载
- 手机端主题色卡和相关面板紧凑化（避免“大卡突兀占版”）

## 最新验证结果
- `npm run -s test:run -- __tests__/api/payment-callback-download-once.test.ts` ✅
- `npm run -s test:run` ✅（17 文件，126 passed）
- `npm run -s build` ✅
- `npm run -s go-live:commercial` ❌（仅环境变量阻断）

## 当前阻断（外部配置）
- `PAYMENT_NOTIFY_URL`（https）
- `PAYMENT_NOTIFY_SECRET`
- `WECHAT_PAY_MCH_ID`, `WECHAT_PAY_APP_ID`, `WECHAT_PAY_API_V3_KEY`
- `ALIPAY_APP_ID`, `ALIPAY_PRIVATE_KEY`, `ALIPAY_PUBLIC_KEY`

## 结论
- 代码与测试层面的商业化支付-下载闭环已基本完成。
- 未达成正式可部署的唯一原因是生产环境支付配置尚未注入。
