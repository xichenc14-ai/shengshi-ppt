-- v10.98.0: 仅保存短期任务控制信息，不保存用户输入、PPT、预览或附件内容。

CREATE TABLE IF NOT EXISTS public.generation_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  idempotency_key TEXT NOT NULL,
  route TEXT NOT NULL CHECK (route IN ('gamma', 'gamma-direct')),
  provider_generation_id TEXT,
  status TEXT NOT NULL CHECK (status IN ('creating', 'processing', 'failed')),
  attempts INTEGER NOT NULL DEFAULT 1 CHECK (attempts > 0),
  error_code TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL,
  UNIQUE (user_id, idempotency_key)
);

CREATE INDEX IF NOT EXISTS idx_generation_requests_expires
  ON public.generation_requests(expires_at);

CREATE INDEX IF NOT EXISTS idx_generation_requests_provider_id
  ON public.generation_requests(provider_generation_id)
  WHERE provider_generation_id IS NOT NULL;

ALTER TABLE public.generation_requests ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.generation_requests FROM anon, authenticated;
