-- Download artifact registry for generated PPT/PDF files.
-- Files are stored in object storage; this table stores stable metadata and
-- lets app routes issue short-lived signed download URLs.

CREATE TABLE IF NOT EXISTS generation_artifacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  generation_id TEXT NOT NULL,
  format TEXT NOT NULL CHECK (format IN ('pptx', 'pdf')),
  object_key TEXT NOT NULL,
  filename TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  size_bytes BIGINT NOT NULL DEFAULT 0,
  sha256 TEXT,
  status TEXT NOT NULL DEFAULT 'ready' CHECK (status IN ('pending', 'ready', 'failed')),
  source_url_expires_at TIMESTAMPTZ,
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_generation_artifacts_generation_format
  ON generation_artifacts(generation_id, format);

CREATE INDEX IF NOT EXISTS idx_generation_artifacts_user_id
  ON generation_artifacts(user_id);

CREATE INDEX IF NOT EXISTS idx_generation_artifacts_created_at
  ON generation_artifacts(created_at DESC);

ALTER TABLE generation_artifacts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own generation artifacts" ON generation_artifacts;
CREATE POLICY "Users can view own generation artifacts" ON generation_artifacts
  FOR SELECT USING (auth.uid() = user_id);

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

CREATE INDEX IF NOT EXISTS idx_history_user_id ON generation_history(user_id);
CREATE INDEX IF NOT EXISTS idx_history_created_at ON generation_history(created_at DESC);

ALTER TABLE generation_history ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own history" ON generation_history;
CREATE POLICY "Users can view own history" ON generation_history
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own history" ON generation_history;
CREATE POLICY "Users can insert own history" ON generation_history
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own history" ON generation_history;
CREATE POLICY "Users can delete own history" ON generation_history
  FOR DELETE USING (auth.uid() = user_id);

ALTER TABLE generation_history
  ADD COLUMN IF NOT EXISTS artifact_id UUID REFERENCES generation_artifacts(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_history_artifact_id
  ON generation_history(artifact_id);
