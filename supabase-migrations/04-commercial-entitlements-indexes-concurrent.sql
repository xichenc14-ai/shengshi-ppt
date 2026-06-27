-- Production index migration for commercial entitlements and payment tracking.
-- Use this script for large/live datasets via psql or Supabase CLI db query.
-- Do not run inside Supabase SQL Editor if it wraps the whole query in a transaction.
-- Safe to run more than once.

create index concurrently if not exists idx_users_plan_expires_at
  on public.users (plan_expires_at);

create index concurrently if not exists idx_users_last_entitlement_sync_at
  on public.users (last_entitlement_sync_at);

create index concurrently if not exists idx_orders_user_product_status_paid_at
  on public.orders (user_id, product_type, status, paid_at desc, created_at desc);

create index concurrently if not exists idx_orders_pay_method_paid_at
  on public.orders (pay_method, paid_at desc)
  where status in ('completed', 'paid');

create index concurrently if not exists idx_orders_trade_no
  on public.orders (trade_no)
  where trade_no is not null;

create index concurrently if not exists idx_orders_metadata_gin
  on public.orders using gin (metadata);
