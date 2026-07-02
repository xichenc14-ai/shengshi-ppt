-- Commercial admin module: audit logs, Gamma key management, refund workflow

CREATE TABLE IF NOT EXISTS admin_audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  operator_user_id TEXT,
  operator_phone TEXT,
  action TEXT NOT NULL,
  target_type TEXT NOT NULL,
  target_id TEXT,
  before_snapshot JSONB,
  after_snapshot JSONB,
  reason TEXT,
  ip_address TEXT,
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_admin_audit_logs_created_at ON admin_audit_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_admin_audit_logs_action ON admin_audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_admin_audit_logs_target ON admin_audit_logs(target_type, target_id);

ALTER TABLE admin_audit_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service role full access admin audit logs" ON admin_audit_logs;
CREATE POLICY "Service role full access admin audit logs" ON admin_audit_logs
  FOR ALL USING (true) WITH CHECK (true);

CREATE TABLE IF NOT EXISTS admin_gamma_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  label TEXT NOT NULL,
  api_key_ciphertext TEXT NOT NULL,
  api_key_last4 TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'exhausted', 'disabled', 'invalid')),
  quota_pool_tag TEXT NOT NULL DEFAULT 'default',
  counts_toward_admin_quota BOOLEAN NOT NULL DEFAULT true,
  remaining INTEGER NOT NULL DEFAULT 0,
  success_count INTEGER NOT NULL DEFAULT 0,
  fail_count INTEGER NOT NULL DEFAULT 0,
  last_used_at TIMESTAMPTZ,
  last_checked_at TIMESTAMPTZ,
  last_failure_at TIMESTAMPTZ,
  exhausted_at TIMESTAMPTZ,
  exhausted_by TEXT,
  exhausted_reason TEXT,
  restored_at TIMESTAMPTZ,
  restored_by TEXT,
  created_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_admin_gamma_keys_status ON admin_gamma_keys(status);
CREATE INDEX IF NOT EXISTS idx_admin_gamma_keys_quota_pool_tag ON admin_gamma_keys(quota_pool_tag);
CREATE INDEX IF NOT EXISTS idx_admin_gamma_keys_updated_at ON admin_gamma_keys(updated_at DESC);

ALTER TABLE admin_gamma_keys ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service role full access admin gamma keys" ON admin_gamma_keys;
CREATE POLICY "Service role full access admin gamma keys" ON admin_gamma_keys
  FOR ALL USING (true) WITH CHECK (true);

CREATE TABLE IF NOT EXISTS refund_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_no TEXT NOT NULL,
  user_id TEXT,
  amount INTEGER NOT NULL DEFAULT 0,
  reason TEXT,
  status TEXT NOT NULL DEFAULT 'requested'
    CHECK (status IN ('requested', 'approved', 'processing', 'succeeded', 'failed', 'rejected', 'manual_required')),
  provider TEXT,
  provider_refund_id TEXT,
  operator_user_id TEXT,
  provider_raw JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_refund_requests_order_no ON refund_requests(order_no);
CREATE INDEX IF NOT EXISTS idx_refund_requests_user_id ON refund_requests(user_id);
CREATE INDEX IF NOT EXISTS idx_refund_requests_status ON refund_requests(status);
CREATE INDEX IF NOT EXISTS idx_refund_requests_created_at ON refund_requests(created_at DESC);

ALTER TABLE refund_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service role full access refund requests" ON refund_requests;
CREATE POLICY "Service role full access refund requests" ON refund_requests
  FOR ALL USING (true) WITH CHECK (true);
