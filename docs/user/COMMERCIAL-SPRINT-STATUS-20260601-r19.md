# 商业化冲刺状态（r19）

- 日期: 2026-06-01
- 版本: v10.80.2
- 目标: 商业化部署达标 + 手机端主题UI适配

## 本轮新增落地

### A. 单次付费下载支付闭环补强
1. 支付回调按订单类型分流
- 文件: `src/app/api/payment/route.ts`
- 新增 `download_once` 分支：支付成功后直接将订单置为 `completed`，并标记 `fulfilled=false`，不再误走会员开通逻辑。

2. 单次付费订单领取下载接口
- 文件: `src/app/api/pay-once/route.ts`
- 新增 `GET /api/pay-once?orderNo=&userId=`：
  - pending/failed/expired 状态可查询
  - completed 状态返回 `downloadUrl`
  - 首次领取时将订单 metadata 标记 `fulfilled=true` 与 `fulfilledAt`

3. 单次付费下单支持 provider 模式（延续上一轮）
- 文件: `src/app/api/pay-once/route.ts`
- `POST` 已支持 `payMode=provider`，可创建 wechat/alipay 真实支付意图并落库 `orders(product_type=download_once)`。

### B. 手机端主题UI适配（延续上一轮）
- `src/components/ThemeSelector.tsx`
- `src/components/ThemePickerModal.tsx`
- `src/components/generate/ThemeSelector.tsx`
- 结果：移动端主题卡片更紧凑、网格密度提升，降低“大卡突兀占版”问题。

## 验证结果（本轮复跑）
- `npm run -s lint` ✅ 通过（31 warnings，0 errors）
- `npm run -s test:run` ✅ 通过
- `npm run -s build` ✅ 通过
- `npm run -s go-live:commercial` ❌ 未通过（仅环境变量阻断）

## 当前阻断（外部配置）
`go-live:commercial` 失败项：
- `PAYMENT_NOTIFY_URL` 缺失且需 https
- `WECHAT_PAY_MCH_ID`, `WECHAT_PAY_APP_ID`, `WECHAT_PAY_API_V3_KEY` 缺失
- `ALIPAY_APP_ID`, `ALIPAY_PRIVATE_KEY`, `ALIPAY_PUBLIC_KEY` 缺失

## 到“商业可部署”仍需完成
1. 运维注入上述生产变量并验证 `env:commercial` PASS。
2. 用真实沙箱/网关完成 provider 下单 -> 回调 -> `GET /api/pay-once` 领取下载 的端到端联调。
3. 按实际支付通道配置 `PAYMENT_NOTIFY_SECRET` 并确保回调调用头一致。
