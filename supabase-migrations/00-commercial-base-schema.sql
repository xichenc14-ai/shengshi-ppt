-- 省心PPT v10.97.0 商业化数据库基线
-- 新环境先执行本文件，再按编号执行后续迁移。

create extension if not exists pgcrypto;

create table if not exists public.users (
  id uuid primary key default gen_random_uuid(),
  phone text unique,
  username text unique,
  nickname text,
  avatar text,
  avatar_url text,
  wechat_openid text unique,
  password_hash text,
  credits integer not null default 40 check (credits >= 0),
  total_credits_used integer not null default 0 check (total_credits_used >= 0),
  plan_type text not null default 'free',
  plan_started_at timestamptz,
  plan_expires_at timestamptz,
  free_cycle_anchor timestamptz,
  free_credits_reset_at timestamptz,
  last_entitlement_sync_at timestamptz,
  is_active boolean not null default true,
  last_login_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.credit_transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  amount integer not null,
  balance_after integer not null,
  type text not null,
  description text,
  created_at timestamptz not null default now()
);

create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.users(id) on delete set null,
  order_no text not null unique,
  product_type text not null,
  product_name text,
  amount integer not null check (amount >= 0),
  status text not null default 'pending',
  pay_method text,
  trade_no text,
  metadata jsonb not null default '{}'::jsonb,
  expires_at timestamptz,
  paid_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.verification_codes (
  id uuid primary key default gen_random_uuid(),
  phone text not null,
  code text not null,
  type text not null default 'login',
  verified boolean not null default false,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);

create table if not exists public.verify_attempts (
  id uuid primary key default gen_random_uuid(),
  phone text not null unique,
  attempts integer not null default 0,
  last_attempt_at timestamptz not null default now(),
  blocked_until timestamptz
);

create table if not exists public.image_uploads (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.users(id) on delete cascade,
  mime_type text not null,
  size_bytes bigint not null default 0,
  created_at timestamptz not null default now()
);

-- 既有生成文件下载加速元数据；文件保存在已配置的对象存储中。
create table if not exists public.generation_artifacts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.users(id) on delete set null,
  generation_id text not null,
  format text not null check (format in ('pptx', 'pdf')),
  object_key text not null,
  filename text not null,
  mime_type text not null,
  size_bytes bigint not null default 0,
  sha256 text,
  status text not null default 'ready' check (status in ('pending', 'ready', 'failed')),
  source_url_expires_at timestamptz,
  error_message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.generation_history (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.users(id) on delete cascade,
  title text not null,
  slides jsonb default '[]'::jsonb,
  theme_id text,
  download_url text,
  artifact_id uuid references public.generation_artifacts(id) on delete set null,
  page_count integer default 0,
  image_mode text default 'noImages',
  created_at timestamptz default now()
);

-- 仅保存临时附件的清理控制元数据，不保存文件内容或原始文件名。
create table if not exists public.temporary_attachment_leases (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  storage_path text not null unique,
  expires_at timestamptz not null,
  delete_after timestamptz not null,
  created_at timestamptz not null default now()
);

create table if not exists public.refund_requests (
  id uuid primary key default gen_random_uuid(),
  order_no text not null references public.orders(order_no) on delete restrict,
  user_id uuid references public.users(id) on delete set null,
  amount integer not null check (amount >= 0),
  reason text not null,
  status text not null,
  provider text,
  provider_refund_id text,
  operator_user_id text,
  provider_raw jsonb not null default '{}'::jsonb,
  completed_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.admin_audit_logs (
  id uuid primary key default gen_random_uuid(),
  operator_user_id text,
  operator_phone text,
  action text not null,
  target_type text not null,
  target_id text,
  before_snapshot jsonb,
  after_snapshot jsonb,
  reason text,
  ip_address text,
  user_agent text,
  created_at timestamptz not null default now()
);

create table if not exists public.admin_gamma_keys (
  id uuid primary key default gen_random_uuid(),
  label text not null,
  api_key_ciphertext text not null,
  api_key_last4 text not null,
  status text not null default 'active',
  quota_pool_tag text not null default 'default',
  counts_toward_admin_quota boolean not null default true,
  remaining integer not null default 0,
  success_count integer not null default 0,
  fail_count integer not null default 0,
  last_used_at timestamptz,
  last_checked_at timestamptz,
  last_failure_at timestamptz,
  created_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.api_rate_limits (
  key_hash text primary key,
  request_count integer not null,
  window_started_at timestamptz not null,
  expires_at timestamptz not null
);

create index if not exists idx_credit_transactions_user_created on public.credit_transactions(user_id, created_at desc);
create index if not exists idx_orders_user_created on public.orders(user_id, created_at desc);
create index if not exists idx_verification_codes_phone_created on public.verification_codes(phone, created_at desc);
create index if not exists idx_image_uploads_session_created on public.image_uploads(session_id, created_at desc);
create unique index if not exists idx_generation_artifacts_generation_format on public.generation_artifacts(generation_id, format);
create index if not exists idx_generation_artifacts_user_id on public.generation_artifacts(user_id);
create index if not exists idx_generation_artifacts_created_at on public.generation_artifacts(created_at desc);
create index if not exists idx_history_user_id on public.generation_history(user_id);
create index if not exists idx_history_created_at on public.generation_history(created_at desc);
create index if not exists idx_history_artifact_id on public.generation_history(artifact_id);
create index if not exists idx_temporary_attachment_leases_expires on public.temporary_attachment_leases(expires_at);
create index if not exists idx_refund_requests_order on public.refund_requests(order_no, created_at desc);
create index if not exists idx_admin_audit_logs_created on public.admin_audit_logs(created_at desc);
create index if not exists idx_api_rate_limits_expires on public.api_rate_limits(expires_at);

-- 原子跨实例限流。只授予 service_role，客户端不能直接消费或篡改限额。
create or replace function public.consume_rate_limit(
  p_key_hash text,
  p_window_seconds integer,
  p_limit integer
)
returns table(allowed boolean, remaining integer, reset_at timestamptz)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_now timestamptz := clock_timestamp();
  v_row public.api_rate_limits%rowtype;
begin
  if p_key_hash is null or length(p_key_hash) <> 64 then
    raise exception 'invalid rate-limit key';
  end if;
  if p_window_seconds < 1 or p_window_seconds > 604800 or p_limit < 1 or p_limit > 100000 then
    raise exception 'invalid rate-limit parameters';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(p_key_hash, 0));
  select * into v_row from public.api_rate_limits where key_hash = p_key_hash;

  if not found or v_row.expires_at <= v_now then
    insert into public.api_rate_limits(key_hash, request_count, window_started_at, expires_at)
    values (p_key_hash, 1, v_now, v_now + make_interval(secs => p_window_seconds))
    on conflict (key_hash) do update
      set request_count = 1,
          window_started_at = excluded.window_started_at,
          expires_at = excluded.expires_at
    returning * into v_row;
    return query select true, greatest(0, p_limit - 1), v_row.expires_at;
    return;
  end if;

  if v_row.request_count >= p_limit then
    return query select false, 0, v_row.expires_at;
    return;
  end if;

  update public.api_rate_limits set request_count = request_count + 1
  where key_hash = p_key_hash returning * into v_row;
  return query select true, greatest(0, p_limit - v_row.request_count), v_row.expires_at;
end;
$$;

revoke all on function public.consume_rate_limit(text, integer, integer) from public, anon, authenticated;
grant execute on function public.consume_rate_limit(text, integer, integer) to service_role;

create or replace function public.release_rate_limit(p_key_hash text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_now timestamptz := clock_timestamp();
  v_row public.api_rate_limits%rowtype;
begin
  if p_key_hash is null or length(p_key_hash) <> 64 then
    raise exception 'invalid rate-limit key';
  end if;
  perform pg_advisory_xact_lock(hashtextextended(p_key_hash, 0));
  select * into v_row from public.api_rate_limits where key_hash = p_key_hash;
  if not found then return false; end if;
  if v_row.expires_at <= v_now or v_row.request_count <= 1 then
    delete from public.api_rate_limits where key_hash = p_key_hash;
  else
    update public.api_rate_limits set request_count = request_count - 1 where key_hash = p_key_hash;
  end if;
  return true;
end;
$$;

revoke all on function public.release_rate_limit(text) from public, anon, authenticated;
grant execute on function public.release_rate_limit(text) to service_role;

alter table public.api_rate_limits enable row level security;
revoke all on public.api_rate_limits from anon, authenticated;

alter table public.generation_artifacts enable row level security;
alter table public.generation_history enable row level security;

drop policy if exists "Users can view own generation artifacts" on public.generation_artifacts;
create policy "Users can view own generation artifacts" on public.generation_artifacts
  for select using (auth.uid() = user_id);

drop policy if exists "Users can view own history" on public.generation_history;
create policy "Users can view own history" on public.generation_history
  for select using (auth.uid() = user_id);

drop policy if exists "Users can insert own history" on public.generation_history;
create policy "Users can insert own history" on public.generation_history
  for insert with check (auth.uid() = user_id);

drop policy if exists "Users can delete own history" on public.generation_history;
create policy "Users can delete own history" on public.generation_history
  for delete using (auth.uid() = user_id);
