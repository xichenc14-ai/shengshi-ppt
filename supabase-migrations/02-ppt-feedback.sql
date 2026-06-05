-- 用户反馈表：用于收集 PPT 结果页点赞/点踩/评分/意见
create table if not exists public.ppt_feedback (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  generation_id text,
  vote text not null check (vote in ('up', 'down')),
  rating int check (rating between 1 and 5),
  comment text,
  topic text,
  ppt_title text,
  page_count int,
  image_mode text,
  created_at timestamptz not null default now()
);

create index if not exists idx_ppt_feedback_user_id on public.ppt_feedback(user_id);
create index if not exists idx_ppt_feedback_created_at on public.ppt_feedback(created_at desc);
create index if not exists idx_ppt_feedback_generation_id on public.ppt_feedback(generation_id);

alter table public.ppt_feedback enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'ppt_feedback'
      and policyname = 'Users can view own feedback'
  ) then
    create policy "Users can view own feedback" on public.ppt_feedback
      for select using (auth.uid() = user_id);
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'ppt_feedback'
      and policyname = 'Users can insert own feedback'
  ) then
    create policy "Users can insert own feedback" on public.ppt_feedback
      for insert with check (auth.uid() = user_id);
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'ppt_feedback'
      and policyname = 'Service role full access on feedback'
  ) then
    create policy "Service role full access on feedback" on public.ppt_feedback
      for all using (auth.role() = 'service_role') with check (auth.role() = 'service_role');
  end if;
end $$;
