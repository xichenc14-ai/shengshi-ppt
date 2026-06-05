# 省心PPT 商业化上线执行手册（v10.80.2）

更新时间：2026-06-01

## 0. 目标

把当前代码基线按“可商用发布”执行到位，形成可追溯证据链：

- 配置就绪
- 质量门禁通过
- 支付链路可验证
- 审计报告留档

## 1. 发布前准备

1. 以 `.env.production.example` 为模板补齐生产配置。
2. 必配核心变量：
- `NEXT_PUBLIC_SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `SESSION_PASSWORD`
- `PAYMENT_NOTIFY_URL`（必须 `https://`）
3. 支付配置二选一（可并存）：
- 模板模式：`PAYMENT_WECHAT_*`、`PAYMENT_ALIPAY_*`
- SDK 模式：`WECHAT_PAY_*`、`ALIPAY_*`

## 2. 一键体检

执行：

```bash
npm run preflight:commercial
```

判定：

- PASS：进入下一步
- FAIL：按报错补齐变量或修复门禁

## 3. 支付就绪检查（管理员）

接口：

- `GET /api/payment/readiness`

判定标准：

- `status=ready`
- `core.paymentNotifyUrl=true`
- `providers.wechat.ready=true`
- `providers.alipay.ready=true`

## 4. 支付回调链路演练（管理员）

1. 前端创建一个测试订单（支付弹窗触发下单）。
2. 预演不落库：

```http
POST /api/payment/simulate-callback
Content-Type: application/json

{ "order_no": "测试订单号", "dry_run": true }
```

3. 执行落库：

```http
POST /api/payment/simulate-callback
Content-Type: application/json

{ "order_no": "测试订单号", "trade_no": "SIM_YYYYMMDD_001" }
```

4. 验证结果：
- 订单状态 `completed`
- 用户会员开通成功
- 积分到账成功

## 5. 审计留档

执行：

```bash
npm run audit:commercial
```

输出文件：

- `docs/user/COMMERCIAL-AUDIT-*.md`

上线要求：

- 报告中 `lint/test/build/preflight` 全通过
- 环境检查项全通过（尤其支付相关）

## 6. 发布执行建议

1. 低峰灰度发布。
2. 发布后 30 分钟重点盯：
- 下单成功率
- 回调成功率
- 导出成功率
3. 发现支付异常立即回滚到上个稳定版本并保留审计报告。

## 7. 当前已知阻断（若存在）

以最新 `COMMERCIAL-AUDIT-*.md` 的 FAIL 项为准；这些项在清零前，不建议正式对外商用发布。

