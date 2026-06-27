# 商业化生产数据库迁移方案

日期：2026-06-27

## 目标

补齐商业化订阅和支付追踪所需的生产库字段，消除长期依赖代码兼容兜底的问题：

- `users.plan_started_at`
- `users.plan_expires_at`
- `users.last_entitlement_sync_at`
- `orders.metadata`
- `orders.pay_method`
- `orders.trade_no`

同时补齐/兜底当前支付与权益代码已经使用的相关字段：

- `users.free_cycle_anchor`
- `users.free_credits_reset_at`
- `orders.expires_at`
- `orders.paid_at`

## 执行文件

执行：

```sql
supabase-migrations/03-commercial-entitlements-orders.sql
```

未来大表/正式生产索引专用脚本：

```sql
supabase-migrations/04-commercial-entitlements-indexes-concurrent.sql
```

该脚本设计为可重复执行：

- 使用 `ADD COLUMN IF NOT EXISTS`。
- 历史新增字段保持 nullable，不在首轮迁移强制 `NOT NULL`。
- 索引用 `CREATE INDEX IF NOT EXISTS`，兼容 Supabase SQL Editor 的事务执行方式。当前为内测数据，短暂索引锁可接受。
- 回填失败风险低，不依赖外部服务。
- 不创建可能被历史重复流水阻断的唯一索引。

上线标准说明：

- 当前库仍是内测数据，`03` 脚本整段在 SQL Editor 执行是合理选择。
- 已创建好的索引上线后会继续生效，不存在“内测索引”和“正式索引”的质量差异。
- 区别只在创建过程：未来如果订单/用户表已经很大，应使用 `04` 脚本里的 `CREATE INDEX CONCURRENTLY`，通过 `psql` 或 `supabase db query --db-url ... -f ...` 单独执行，避免普通建索引长时间阻塞写入。
- `04` 是幂等的；如果索引已存在，会直接跳过。

## 迁移步骤

1. 先在 Supabase SQL Editor 里对生产库做一次只读确认：

```sql
select table_name, column_name, data_type
from information_schema.columns
where table_schema = 'public'
  and table_name in ('users', 'orders')
  and column_name in (
    'plan_started_at',
    'plan_expires_at',
    'last_entitlement_sync_at',
    'free_cycle_anchor',
    'free_credits_reset_at',
    'metadata',
    'pay_method',
    'trade_no',
    'expires_at',
    'paid_at'
  )
order by table_name, column_name;
```

2. 在低峰期执行 `supabase-migrations/03-commercial-entitlements-orders.sql`。

注意：当前版本已去掉 `CONCURRENTLY`，可直接在 Supabase SQL Editor 中整段执行。

如果是已有大量正式数据的环境，不要用 SQL Editor 整段执行索引部分；先执行 schema/回填，再用 `04-commercial-entitlements-indexes-concurrent.sql` 单独创建索引。

3. 执行验收 SQL：

```sql
select count(*) as users_missing_sync
from public.users
where last_entitlement_sync_at is null;

select count(*) as paid_subscriptions_missing_expiry
from public.users
where coalesce(plan_type, 'free') <> 'free'
  and plan_expires_at is null;

select pay_method, count(*)
from public.orders
group by pay_method
order by count(*) desc;

select count(*) as orders_missing_metadata
from public.orders
where metadata is null;
```

4. 通过线上后台检查：

- 账号页会员到期时间展示正常。
- 管理后台会员统计能读取 `plan_expires_at`。
- 新建订单后 `orders.metadata/pay_method` 有值。
- 支付回调成功后 `orders.trade_no` 能落库。
- 会员开通后 `users.plan_started_at/plan_expires_at/last_entitlement_sync_at` 能落库。

## 回滚边界

首轮不建议删除字段回滚，因为代码已经能读写这些字段，删除字段会重新触发兼容兜底路径。若脚本执行后发现回填数据有问题，优先回滚数据值而非 schema：

```sql
update public.users
set plan_started_at = null,
    plan_expires_at = null
where plan_started_at is not null
  and last_entitlement_sync_at >= now() - interval '1 day';
```

`orders.metadata/pay_method/trade_no` 建议保留；如需修正历史推导，重新按订单明细做定向 `update`。

## 后续收口

生产字段稳定后，可以分两步收口代码：

1. 保留兼容兜底至少一个发布周期，观察日志里 `stripped missing columns` 是否归零。
2. 下一版移除订单和用户字段缺失兼容分支，把缺字段视为发布阻断。
