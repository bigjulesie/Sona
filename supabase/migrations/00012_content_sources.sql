-- supabase/migrations/00012_content_sources.sql

CREATE TABLE IF NOT EXISTS content_sources (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  portrait_id  UUID NOT NULL REFERENCES portraits(id) ON DELETE CASCADE,
  title        TEXT NOT NULL,
  source_type  TEXT NOT NULL DEFAULT 'transcript'
                 CHECK (source_type IN ('transcript', 'interview', 'article', 'book', 'essay', 'speech', 'letter', 'other')),
  min_tier     access_tier NOT NULL DEFAULT 'public',
  storage_path TEXT,
  status       TEXT NOT NULL DEFAULT 'ready'
                 CHECK (status IN ('pending', 'processing', 'ready', 'error')),
  error_msg    TEXT,
  created_at   TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_content_sources_portrait
  ON content_sources(portrait_id);

ALTER TABLE knowledge_chunks
  ADD COLUMN IF NOT EXISTS source_id UUID REFERENCES content_sources(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_knowledge_chunks_source
  ON knowledge_chunks(source_id) WHERE source_id IS NOT NULL;

-- RLS
ALTER TABLE content_sources ENABLE ROW LEVEL SECURITY;

-- Creators can read their own portrait's sources
CREATE POLICY "creator_read_own_sources" ON content_sources
  FOR SELECT USING (
    portrait_id IN (
      SELECT id FROM portraits WHERE creator_id = auth.uid()
    )
  );

-- Service role manages all
CREATE POLICY "service_role_all_sources" ON content_sources
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);
