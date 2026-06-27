-- Commercial payment idempotency guard.
-- Prevent the same provider transaction id from being attached to multiple paid orders.
-- Safe to run more than once.

create unique index if not exists ux_orders_paid_trade_no
  on public.orders (trade_no)
  where trade_no is not null
    and status in ('completed', 'paid');
