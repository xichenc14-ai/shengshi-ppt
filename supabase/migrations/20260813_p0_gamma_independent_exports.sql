-- P0: decouple Gamma content generation from file export.
-- Additive migration: existing generation and artifact rows remain readable.

ALTER TABLE public.generation_requests
  ADD COLUMN IF NOT EXISTS gamma_id TEXT,
  ADD COLUMN IF NOT EXISTS provider_key_ref TEXT;

CREATE INDEX IF NOT EXISTS idx_generation_requests_gamma_id
  ON public.generation_requests(gamma_id)
  WHERE gamma_id IS NOT NULL;

ALTER TABLE public.generation_artifacts
  DROP CONSTRAINT IF EXISTS generation_artifacts_format_check;

ALTER TABLE public.generation_artifacts
  ADD COLUMN IF NOT EXISTS gamma_id TEXT,
  ADD COLUMN IF NOT EXISTS export_id TEXT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'generation_artifacts_format_check'
      AND conrelid = 'public.generation_artifacts'::regclass
  ) THEN
    ALTER TABLE public.generation_artifacts
      ADD CONSTRAINT generation_artifacts_format_check
      CHECK (format IN ('pptx', 'pdf', 'png'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_generation_artifacts_gamma_id
  ON public.generation_artifacts(gamma_id)
  WHERE gamma_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_generation_artifacts_export_id
  ON public.generation_artifacts(export_id)
  WHERE export_id IS NOT NULL;

ALTER TABLE public.generation_history
  ADD COLUMN IF NOT EXISTS generation_id TEXT,
  ADD COLUMN IF NOT EXISTS gamma_id TEXT;

CREATE INDEX IF NOT EXISTS idx_generation_history_gamma_id
  ON public.generation_history(gamma_id)
  WHERE gamma_id IS NOT NULL;
