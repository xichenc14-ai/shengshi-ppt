-- v10.100.0: 短信发送尝试审计。仅保存手机号指纹及末四位，不保存验证码或完整手机号。
CREATE TABLE IF NOT EXISTS public.sms_send_attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  out_id UUID NOT NULL UNIQUE,
  request_id TEXT NOT NULL,
  phone_hash TEXT NOT NULL,
  phone_last4 TEXT NOT NULL CHECK (phone_last4 ~ '^[0-9]{4}$'),
  purpose TEXT NOT NULL CHECK (purpose IN ('login', 'reset_password', 'change_phone')),
  provider TEXT NOT NULL,
  state TEXT NOT NULL CHECK (state IN ('pending', 'accepted', 'unknown', 'failed')),
  provider_request_id TEXT,
  provider_message_id TEXT,
  error_code TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sms_send_attempts_created_at
  ON public.sms_send_attempts (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_sms_send_attempts_request_id
  ON public.sms_send_attempts (request_id);
CREATE INDEX IF NOT EXISTS idx_sms_send_attempts_phone_hash_created_at
  ON public.sms_send_attempts (phone_hash, created_at DESC);

ALTER TABLE public.sms_send_attempts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.sms_send_attempts FROM anon, authenticated;
