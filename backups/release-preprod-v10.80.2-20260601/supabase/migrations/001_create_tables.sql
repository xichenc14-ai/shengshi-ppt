-- 生成历史记录表
-- 运行方式：在 Supabase SQL Editor 中执行

CREATE TABLE IF NOT EXISTS generation_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  slides JSONB DEFAULT '[]',
  theme_id TEXT,
  download_url TEXT,
  page_count INTEGER DEFAULT 0,
  image_mode TEXT DEFAULT 'noImages',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_history_user_id ON generation_history(user_id);
CREATE INDEX IF NOT EXISTS idx_history_created_at ON generation_history(created_at DESC);

-- RLS 策略：用户只能看自己的记录
ALTER TABLE generation_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own history" ON generation_history
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own history" ON generation_history
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own history" ON generation_history
  FOR DELETE USING (auth.uid() = user_id);

-- 验证码尝试次数表（防暴力破解）
CREATE TABLE IF NOT EXISTS verify_attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  phone TEXT NOT NULL,
  attempts INTEGER DEFAULT 0,
  last_attempt_at TIMESTAMPTZ DEFAULT NOW(),
  blocked_until TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS
ALTER TABLE verify_attempts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access" ON verify_attempts
  FOR ALL USING (true) WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_verify_phone ON verify_attempts(phone);

-- 注册限制表（防批量注册）
CREATE TABLE IF NOT EXISTS register_locks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  phone TEXT UNIQUE,
  ip_address TEXT,
  registered_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE register_locks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access" ON register_locks
  FOR ALL USING (true) WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_register_phone ON register_locks(phone);
CREATE INDEX IF NOT EXISTS idx_register_ip ON register_locks(ip_address);
