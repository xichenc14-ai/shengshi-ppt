# 省心PPT 商业化部署检查清单（v10.80.2）

更新时间：2026-06-01

执行手册：`docs/user/COMMERCIAL-GO-LIVE-RUNBOOK-v10.80.2.md`

## P0（上线阻断项）

1. 代码质量门禁
- `npm run lint` 无 error
- `next.config.ts` 关闭 `typescript.ignoreBuildErrors`
- `npm run test:run` 通过
- `npm run build` 通过

2. 支付链路
- 微信/支付宝真实下单已接入（非 mock）
- 回调验签通过且幂等生效
- 订单状态、积分到账、日志链路可追踪
- 对账与异常补偿流程可执行
- 支付链接模板环境变量已配置（见下方“支付配置模板”）
- 支付就绪检查接口可用：`GET /api/payment/readiness`（需 admin 权限）
- 支付沙箱回调模拟接口可用：`POST /api/payment/simulate-callback`（需 admin 权限）

3. 安全与合规
- 环境变量与密钥轮换完成
- 仓库无敏感密钥明文
- CSP/HSTS/安全响应头开启
- 登录、短信、支付接口限流生效

## P1（强烈建议）

1. 可观测性
- 健康检查接口：`/api/health`
- 错误追踪：Sentry/同类平台
- 业务看板：支付成功率、生成成功率、导出成功率、P95、失败码分布
- 告警：支付失败率激增、导出失败率激增、健康检查异常

2. 发布流程
- GitHub Actions CI：lint + test + build
- 灰度发布与回滚预案
- 生产变更审批与发布窗口
- 本地预发布体检：`npm run preflight:commercial`
- 审计留档报告：`npm run audit:commercial`（自动生成 `docs/user/COMMERCIAL-AUDIT-*.md`）

3. 手机端体验
- 主题色卡移动端紧凑布局（避免单卡过大）
- 核心流程在 375px/390px/430px 下可用
- 支付弹窗、登录弹窗、生成进度在手机端无遮挡

## 当前状态（本次任务后）

- 已完成：任务启动备份、移动端主题色卡压缩、安全头增强、CI 工作流、健康检查接口、lint error 清零、TypeScript 构建阻断开启并通过构建。
- 已推进：支付链路从纯 mock 升级为“下单创建订单 + 动态支付信息回传”模式，前端支付弹窗已优先使用真实订单返回的二维码/支付链接。
- 待完成：支付网关联调验收（生产模板链接或官方网关）、端到端支付回调验签联测、监控告警接入与灰度验证。

## 支付配置模板（新增）

说明：如使用第三方收银台/聚合支付，可通过 URL 模板直接生成可支付链接，避免前端继续走人工静态收款码。
可直接参考生产模板文件：`.env.production.example`

- `PAYMENT_WECHAT_URL_TEMPLATE`
- `PAYMENT_WECHAT_QRCODE_TEMPLATE`
- `PAYMENT_ALIPAY_URL_TEMPLATE`
- `PAYMENT_ALIPAY_QRCODE_TEMPLATE`

模板变量：

- `{provider}`：`wechat` 或 `alipay`
- `{orderNo}`：系统订单号
- `{amountFen}`：金额（分）
- `{amountYuan}`：金额（元）
- `{subject}`：订单标题
- `{userId}`：用户 ID
- `{notifyUrl}`：回调地址

## 联调示例（管理员）

1. 读取支付就绪状态  
- `GET /api/payment/readiness`

2. 沙箱预演（不落库变更）  
- `POST /api/payment/simulate-callback`  
- body:
```json
{
  "order_no": "你的订单号",
  "dry_run": true
}
```

3. 沙箱执行（落库，验证开通链路）  
- `POST /api/payment/simulate-callback`  
- body:
```json
{
  "order_no": "你的订单号",
  "trade_no": "SIM_20260601_001"
}
```
