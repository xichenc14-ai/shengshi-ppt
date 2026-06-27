-- Commercial schema migration: subscription entitlements and payment tracking.
-- Run in Supabase SQL Editor with the service/admin role.
-- Safe to run more than once.
-- Supabase SQL Editor may run multi-statement queries inside an implicit
-- transaction block, so this script uses regular CREATE INDEX statements.

-- 1) Add entitlement columns used by subscription lifecycle management.
alter table public.users
  add column if not exists plan_started_at timestamptz,
  add column if not exists plan_expires_at timestamptz,
  add column if not exists free_cycle_anchor timestamptz,
  add column if not exists free_credits_reset_at timestamptz,
  add column if not exists last_entitlement_sync_at timestamptz;

comment on column public.users.plan_started_at is 'Current paid plan start timestamp.';
comment on column public.users.plan_expires_at is 'Current paid plan expiration timestamp.';
comment on column public.users.free_cycle_anchor is 'Anchor timestamp for free monthly credit reset.';
comment on column public.users.free_credits_reset_at is 'Last timestamp when free monthly credits were reset.';
comment on column public.users.last_entitlement_sync_at is 'Last timestamp when entitlement reconciliation touched this user.';

-- 2) Add order columns required for payment operations and admin reporting.
alter table public.orders
  add column if not exists expires_at timestamptz,
  add column if not exists paid_at timestamptz,
  add column if not exists metadata jsonb,
  add column if not exists pay_method text,
  add column if not exists trade_no text;

comment on column public.orders.expires_at is 'Order payment intent expiration timestamp.';
comment on column public.orders.paid_at is 'Timestamp when the order was paid or manually fulfilled.';
comment on column public.orders.metadata is 'Payment/order metadata, including planId, billing, provider payload, and manual overrides.';
comment on column public.orders.pay_method is 'Payment method or source, for example wechat, alipay, xunhu, admin, or legacy.';
comment on column public.orders.trade_no is 'Provider transaction id, if supplied by the payment channel.';

-- Keep future rows predictable without rewriting old rows through a NOT NULL constraint.
alter table public.orders
  alter column metadata set default '{}'::jsonb;

-- 3) Backfill order metadata for legacy subscription rows where possible.
update public.orders
set metadata = jsonb_strip_nulls(jsonb_build_object(
    'planId',
    case
      when product_name ilike '%尊享%' or amount in (4990, 49900) then 'advanced'
      when product_type = 'subscription' then 'shengxin'
      else null
    end,
    'billing',
    case
      when product_name ilike '%年付%' or amount in (19900, 49900) then 'annual'
      when product_type = 'subscription' then 'monthly'
      else null
    end,
    'migratedAt', now()
  ))
where product_type = 'subscription'
  and (metadata is null or metadata = '{}'::jsonb);

update public.orders
set metadata = '{}'::jsonb
where metadata is null;

update public.orders
set pay_method = case
    when order_no like 'admin\_%' escape '\' then 'admin'
    else 'legacy'
  end
where pay_method is null;

-- 4) Backfill current user entitlement dates from the latest completed/paid subscription order.
with paid_subscription_orders as (
  select
    o.user_id,
    coalesce(o.paid_at, o.created_at) as started_at,
    case
      when coalesce(o.metadata->>'manualExpireAt', o.metadata->>'expiresAt') ~ '^\d{4}-\d{2}-\d{2}'
        then coalesce(o.metadata->>'manualExpireAt', o.metadata->>'expiresAt')::timestamptz
      else coalesce(o.paid_at, o.created_at)
        + make_interval(months =>
          case
            when (o.metadata->>'monthsOverride') ~ '^[0-9]+$'
              then greatest(1, least(120, (o.metadata->>'monthsOverride')::int))
            when coalesce(o.metadata->>'billing', '') = 'annual'
              or o.product_name ilike '%年付%'
              or o.amount in (19900, 49900)
              then 12
            else 1
          end
        )
    end as expires_at,
    row_number() over (
      partition by o.user_id
      order by
        case
          when coalesce(o.metadata->>'manualExpireAt', o.metadata->>'expiresAt') ~ '^\d{4}-\d{2}-\d{2}'
            then coalesce(o.metadata->>'manualExpireAt', o.metadata->>'expiresAt')::timestamptz
          else coalesce(o.paid_at, o.created_at)
            + make_interval(months =>
              case
                when (o.metadata->>'monthsOverride') ~ '^[0-9]+$'
                  then greatest(1, least(120, (o.metadata->>'monthsOverride')::int))
                when coalesce(o.metadata->>'billing', '') = 'annual'
                  or o.product_name ilike '%年付%'
                  or o.amount in (19900, 49900)
                  then 12
                else 1
              end
            )
        end desc,
        coalesce(o.paid_at, o.created_at) desc
    ) as rn
  from public.orders o
  where o.product_type = 'subscription'
    and o.status in ('completed', 'paid')
    and o.user_id is not null
),
latest_subscription as (
  select user_id, started_at, expires_at
  from paid_subscription_orders
  where rn = 1
)
update public.users u
set
  plan_started_at = coalesce(u.plan_started_at, latest_subscription.started_at),
  plan_expires_at = coalesce(u.plan_expires_at, latest_subscription.expires_at),
  last_entitlement_sync_at = coalesce(u.last_entitlement_sync_at, now())
from latest_subscription
where u.id = latest_subscription.user_id
  and coalesce(u.plan_type, 'free') <> 'free';

update public.users
set
  free_cycle_anchor = coalesce(free_cycle_anchor, created_at, now()),
  free_credits_reset_at = coalesce(free_credits_reset_at, created_at, now()),
  last_entitlement_sync_at = coalesce(last_entitlement_sync_at, now())
where coalesce(plan_type, 'free') = 'free';

update public.users
set last_entitlement_sync_at = coalesce(last_entitlement_sync_at, now());

-- 5) Add reporting and reconciliation indexes.
create index if not exists idx_users_plan_expires_at
  on public.users (plan_expires_at);

create index if not exists idx_users_last_entitlement_sync_at
  on public.users (last_entitlement_sync_at);

create index if not exists idx_orders_user_product_status_paid_at
  on public.orders (user_id, product_type, status, paid_at desc, created_at desc);

create index if not exists idx_orders_pay_method_paid_at
  on public.orders (pay_method, paid_at desc)
  where status in ('completed', 'paid');

create index if not exists idx_orders_trade_no
  on public.orders (trade_no)
  where trade_no is not null;

create index if not exists idx_orders_metadata_gin
  on public.orders using gin (metadata);

-- Optional post-run checks:
-- select count(*) as users_missing_sync from public.users where last_entitlement_sync_at is null;
-- select count(*) as paid_subscriptions_missing_expiry
-- from public.users where coalesce(plan_type, 'free') <> 'free' and plan_expires_at is null;
-- select pay_method, count(*) from public.orders group by pay_method order by count(*) desc;
