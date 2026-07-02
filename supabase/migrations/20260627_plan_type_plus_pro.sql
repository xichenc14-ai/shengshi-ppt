ALTER TABLE public.users
  DROP CONSTRAINT IF EXISTS users_plan_type_check;

UPDATE public.users
SET plan_type = 'plus'
WHERE plan_type IN ('basic', 'shengxin');

UPDATE public.users
SET plan_type = 'pro'
WHERE plan_type IN ('advanced', 'standard', 'vip', 'supreme', 'enterprise');

ALTER TABLE public.users
  ADD CONSTRAINT users_plan_type_check
  CHECK (plan_type IN ('free', 'plus', 'pro'));
