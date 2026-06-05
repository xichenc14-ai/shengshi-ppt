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
