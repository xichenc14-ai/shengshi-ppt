# v10.98.0 商业运行与恢复手册

更新日期：2026-07-14

## 产品数据边界

- 本版本不调整既有下载、生成历史、R2 加速或产物交付逻辑，也不清理已有对象和数据库记录。
- 附件临时对象在解析服务读取后通过 `finally` 立即删除；未进入解析或即时删除失败的对象由后续上传请求每实例最多每 10 分钟触发一次机会式清理，并由每日 Vercel Cron 兜底。升级支持高频 Cron 的套餐后可恢复更短的固定清理周期。
- PPTX 导出继续保留“已存在产物复用、R2 加速、失败时代理回退”的既有流程；`/api/history` 与历史产物下载保持原行为。
- 生成幂等表只保存短期任务控制信息，不保存输入正文、附件、PPT 或预览内容，默认 6 小时过期。
- 需要备份的是账号、会员、积分、订单、退款、密钥配置和管理员审计等商业核心数据。

## 恢复目标

- 目标 RPO：核心商业数据不超过 24 小时。
- 目标 RTO：严重故障确认后 4 小时内恢复核心登录、生成资格、订单和积分能力。
- 支付订单、积分流水和会员权益必须一起恢复，禁止只恢复用户余额。

## 日常检查

1. 条件具备后确认 Supabase 托管备份状态及最近成功时间；本项暂不作为本次上线门禁。
2. 每次发布运行 `npm run ops:recovery:check`，验证核心表可读。
3. 每月至少导出一次仅 Schema 的版本化快照，不在仓库提交生产数据。
4. 隔离恢复环境建成后执行恢复演练，并记录 `RECOVERY_DRILL_VERIFIED_AT`。
5. 开启强制门禁时设置 `BACKUP_READINESS_REQUIRED=true`，并维护 `SUPABASE_BACKUP_VERIFIED_AT` 和 `RECOVERY_DRILL_VERIFIED_AT`。
6. 保持当前 `DOWNLOAD_ACCELERATION_ENABLED` 设置；若启用 R2，加固门禁只校验四项 R2 配置完整，不改变下载业务语义。

## 既有下载链路保护

本次商业化加固明确不包含下载与历史业务改造：

1. 不删除 `generation_history`、`generation_artifacts` 或 R2 对象。
2. 不关闭 R2 下载加速，不移除历史入口与写入。
3. 发布门禁静态验证上述代码路径仍存在，并通过 PPTX 下载回归测试验证加速失败时仍可回退代理下载。

## 隔离恢复演练

1. 在 Supabase 创建与生产完全不同的隔离项目，并从指定生产备份恢复到该项目。
2. 将隔离项目凭证只写入 `.env.recovery.local`，不得使用生产 Service Role Key：
   - `RECOVERY_TEST_SUPABASE_URL`
   - `RECOVERY_TEST_SUPABASE_SERVICE_ROLE_KEY`
   - `RECOVERY_SOURCE_BACKUP_AT`
   - `RECOVERY_DRILL_CONFIRM_ISOLATED=true`
3. 根据生产基线设置 `RECOVERY_EXPECTED_MIN_COUNTS`，例如 `{"users":100,"orders":20}`。
4. 执行 `npm run ops:restore:drill`。工具会拒绝生产项目作为目标，并以只读方式验证 12 张商业与运行控制表的字段、最低记录数和金额/积分等关键约束。
5. 将命令输出的时间写入生产 `RECOVERY_DRILL_VERIFIED_AT`。脱敏证据保存在 `artifacts/restore-drills/`，包含 SHA-256，不包含表内数据或密钥。

表可读检查 `npm run ops:recovery:check` 不能替代上述恢复演练。

## 部署后验收

部署完成并配置 `COMMERCIAL_BASE_URL` 与 `CRON_SECRET` 后，执行：

```bash
npm run ops:postdeploy:check
```

该命令会验证公开存活检查、完整依赖 Readiness 与 Cron Bearer 鉴权。若已配置可选告警通道，还会主动发送一条 `operational_alert.delivery_test` 测试告警。

## 恢复顺序

1. 暂停生成与支付入口：`MAINTENANCE_MODE=true`。
2. 确认目标数据库为空或为隔离恢复环境，禁止直接覆盖仍在写入的生产库。
3. 恢复 Schema 和迁移，再恢复 `users`、`orders`、`credit_transactions`、`refund_requests`、`admin_gamma_keys`、`admin_audit_logs`。
4. 校验订单总数、已支付金额、积分流水余额和会员到期时间。
5. 运行 `npm run db:commercial:check`、`npm run ops:recovery:check` 和 `npm run preflight:commercial`。
6. 先将 `GENERATION_ROLLOUT_PERCENT` 设置为 5，观察无异常后逐步恢复至 100。

## 事故处理

- 保存请求 ID、订单号、任务 ID和发生时间，不在工单中复制密码、验证码、密钥或附件原文。
- 数据库、Gamma、支付或定时任务依赖异常时，Readiness 返回 503；事件始终写入结构化平台日志，配置外部通道后同步推送告警。
- 全局成本或调用额度达到阈值时，生成接口自动停止新任务，不影响已创建任务继续查询和下载。
