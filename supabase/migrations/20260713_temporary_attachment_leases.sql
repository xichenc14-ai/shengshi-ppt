-- Short-lived cleanup metadata only; no attachment content or original filename is stored.

CREATE TABLE IF NOT EXISTS public.temporary_attachment_leases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  storage_path TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  delete_after TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.temporary_attachment_leases
  ADD COLUMN IF NOT EXISTS delete_after TIMESTAMPTZ;
UPDATE public.temporary_attachment_leases
  SET delete_after = COALESCE(delete_after, expires_at + INTERVAL '75 minutes')
  WHERE delete_after IS NULL;
ALTER TABLE public.temporary_attachment_leases
  ALTER COLUMN delete_after SET NOT NULL;

CREATE INDEX IF NOT EXISTS idx_temporary_attachment_leases_expires
  ON public.temporary_attachment_leases(expires_at);

ALTER TABLE public.temporary_attachment_leases ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.temporary_attachment_leases FROM anon, authenticated;
