-- v10.99.0: 可回滚、并发安全的分布式限流预留

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

  -- 同一个 key 串行消费，拒绝的请求不再继续增加 request_count。
  PERFORM pg_advisory_xact_lock(hashtextextended(p_key_hash, 0));

  SELECT * INTO v_row
  FROM public.api_rate_limits
  WHERE key_hash = p_key_hash;

  IF NOT FOUND OR v_row.expires_at <= v_now THEN
    INSERT INTO public.api_rate_limits(key_hash, request_count, window_started_at, expires_at)
    VALUES (p_key_hash, 1, v_now, v_now + make_interval(secs => p_window_seconds))
    ON CONFLICT (key_hash) DO UPDATE
      SET request_count = 1,
          window_started_at = EXCLUDED.window_started_at,
          expires_at = EXCLUDED.expires_at
    RETURNING * INTO v_row;

    RETURN QUERY SELECT TRUE, greatest(0, p_limit - 1), v_row.expires_at;
    RETURN;
  END IF;

  IF v_row.request_count >= p_limit THEN
    RETURN QUERY SELECT FALSE, 0, v_row.expires_at;
    RETURN;
  END IF;

  UPDATE public.api_rate_limits
  SET request_count = request_count + 1
  WHERE key_hash = p_key_hash
  RETURNING * INTO v_row;

  RETURN QUERY SELECT TRUE, greatest(0, p_limit - v_row.request_count), v_row.expires_at;
END;
$$;

CREATE OR REPLACE FUNCTION public.release_rate_limit(p_key_hash TEXT)
RETURNS BOOLEAN
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

  PERFORM pg_advisory_xact_lock(hashtextextended(p_key_hash, 0));
  SELECT * INTO v_row
  FROM public.api_rate_limits
  WHERE key_hash = p_key_hash;

  IF NOT FOUND THEN
    RETURN FALSE;
  END IF;

  IF v_row.expires_at <= v_now OR v_row.request_count <= 1 THEN
    DELETE FROM public.api_rate_limits WHERE key_hash = p_key_hash;
  ELSE
    UPDATE public.api_rate_limits
    SET request_count = request_count - 1
    WHERE key_hash = p_key_hash;
  END IF;

  RETURN TRUE;
END;
$$;

REVOKE ALL ON FUNCTION public.consume_rate_limit(TEXT, INTEGER, INTEGER) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.consume_rate_limit(TEXT, INTEGER, INTEGER) TO service_role;
REVOKE ALL ON FUNCTION public.release_rate_limit(TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.release_rate_limit(TEXT) TO service_role;

-- 旧实现会在供应商超时时累计无法回滚的计数；升级时一次性清除受污染窗口。
DELETE FROM public.api_rate_limits;
