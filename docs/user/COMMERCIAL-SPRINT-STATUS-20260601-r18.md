# 商业化冲刺状态（r18）

- 日期: 2026-06-01
- 版本: v10.80.2
- 目标: 商业化部署达标 + 手机端UI适配增强

## 1) 任务启动前备份与标记（已完成）
- 备份目录: `backups/release-commercial-v10.80.2-20260601-104718`
- 备份说明: `backups/release-commercial-v10.80.2-20260601-104718/BACKUP-META.md`
- 基线标记文档: `docs/user/COMMERCIAL-BASELINE-MARK-20260601-v10.80.2.md`

## 2) 本轮代码落地（已完成）

### 2.1 支付/商业闭环增强
1. `src/app/api/pay-once/route.ts`
- 新增 `payMode=provider` 路径，可创建真实支付订单意图（wechat/alipay）。
- 在 provider 模式下写入 `orders`（`product_type=download_once`）并返回 `payUrl/qrCodeUrl`。
- 保留 `payMode=credits` 兼容路径（原积分扣减直下模式）保证现网流程不中断。

2. `src/app/api/download/route.ts`
- 去除支付 TODO 响应，改为明确返回商业化支付引导信息：
  - `payment.endpoint=/api/pay-once`
  - `supportedModes=['credits','provider']`

3. `src/app/api/payment-notify/route.ts`
- 新增生产鉴权收口：
  - `NODE_ENV=production` 时要求 `x-payment-notify-secret` 与 `PAYMENT_NOTIFY_SECRET` 匹配，否则 403。

### 2.2 手机端 UI 适配增强（主题相关重点）
1. `src/components/ThemeSelector.tsx`
- 手机端主题卡进一步压缩（卡片内边距、预览高度、字体字号下降）。
- 手机端主题网格从 4 列提升为 5 列（更高信息密度，避免“一行一个大卡”）。

2. `src/components/ThemePickerModal.tsx`
- 弹层移动端主题卡网格改为 5 列。
- 移动端主题大预览高度与字号压缩，降低突兀占版。

3. `src/components/generate/ThemeSelector.tsx`
- 手机端分类卡与具体主题卡密度增强（4 列布局 + 更紧凑间距）。

## 3) 门禁复跑结果
- `npm run -s lint` ✅ 通过（31 warnings，0 error）
- `npm run -s test:run` ✅ 通过
- `npm run -s build` ✅ 通过
- `npm run -s go-live:commercial` ❌ 未通过（环境变量未注入）

## 4) 当前唯一硬阻断（外部配置）
`go-live:commercial` 失败原因：
- `PAYMENT_NOTIFY_URL` 缺失（且必须 https）
- `WECHAT_PAY_MCH_ID`, `WECHAT_PAY_APP_ID`, `WECHAT_PAY_API_V3_KEY` 缺失
- `ALIPAY_APP_ID`, `ALIPAY_PRIVATE_KEY`, `ALIPAY_PUBLIC_KEY` 缺失

## 5) 下一步必须落地（上线前）
1. 运维注入生产支付环境变量（上述全部）。
2. 配置并验证 `PAYMENT_NOTIFY_SECRET` 与通知调用头。
3. 真实支付联调：
- 创建单次下载 provider 订单
- 回调验签与金额校验
- 已支付订单下载放行（含回归）
4. 完成手机端验收截图与可用性回归清单。

