-- v10.97.0 P0: serverless 多实例原子限流

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS username TEXT,
  ADD COLUMN IF NOT EXISTS avatar TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS ux_users_username
  ON public.users(username)
  WHERE username IS NOT NULL;

ALTER TABLE public.verification_codes
  ADD COLUMN IF NOT EXISTS type TEXT NOT NULL DEFAULT 'login';

CREATE TABLE IF NOT EXISTS public.api_rate_limits (
  key_hash TEXT PRIMARY KEY,
  request_count INTEGER NOT NULL,
  window_started_at TIMESTAMPTZ NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_api_rate_limits_expires
  ON public.api_rate_limits(expires_at);

CREATE OR REPLACE FUNCTION public.consume_rate_limit(
  p_key_hash TEXT,
  p_window_seconds INTEGER,
  p_limit INTEGER
)
RETURNS TABLE(allowed BOOLEAN, remaining INTEGER, reset_at TIMESTAMPTZ)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_now TIMESTAMPTZ := clock_timestamp();
  v_row public.api_rate_limits%ROWTYPE;
BEGIN
  IF p_key_hash IS NULL OR length(p_key_hash) <> 64 THEN
    RAISE EXCEPTION 'invalid rate-limit key';
  END IF;
  IF p_window_seconds < 1 OR p_window_seconds > 604800 OR p_limit < 1 OR p_limit > 100000 THEN
    RAISE EXCEPTION 'invalid rate-limit parameters';
  END IF;

  DELETE FROM public.api_rate_limits
  WHERE expires_at < v_now - interval '1 hour';

  INSERT INTO public.api_rate_limits(key_hash, request_count, window_started_at, expires_at)
  VALUES (p_key_hash, 1, v_now, v_now + make_interval(secs => p_window_seconds))
  ON CONFLICT (key_hash) DO UPDATE
    SET request_count = CASE
          WHEN public.api_rate_limits.expires_at <= v_now THEN 1
          ELSE public.api_rate_limits.request_count + 1
        END,
        window_started_at = CASE
          WHEN public.api_rate_limits.expires_at <= v_now THEN v_now
          ELSE public.api_rate_limits.window_started_at
        END,
        expires_at = CASE
          WHEN public.api_rate_limits.expires_at <= v_now THEN v_now + make_interval(secs => p_window_seconds)
          ELSE public.api_rate_limits.expires_at
        END
  RETURNING * INTO v_row;

  RETURN QUERY SELECT
    v_row.request_count <= p_limit,
    greatest(0, p_limit - v_row.request_count),
    v_row.expires_at;
END;
$$;

REVOKE ALL ON FUNCTION public.consume_rate_limit(TEXT, INTEGER, INTEGER) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.consume_rate_limit(TEXT, INTEGER, INTEGER) TO service_role;

ALTER TABLE public.api_rate_limits ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.api_rate_limits FROM anon, authenticated;
