-- supabase/migrations/00016_knowledge_layer.sql

-- 1. Add columns to portraits
ALTER TABLE portraits
  ADD COLUMN IF NOT EXISTS synthesis_status text NOT NULL DEFAULT 'never'
    CHECK (synthesis_status IN ('never','pending','synthesising','ready','error')),
  ADD COLUMN IF NOT EXISTS last_synthesised_at timestamptz;

-- 2. Add columns to content_sources
ALTER TABLE content_sources
  ADD COLUMN IF NOT EXISTS source_date date;

-- 3. sona_evidence
CREATE TABLE IF NOT EXISTS sona_evidence (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  portrait_id         uuid NOT NULL REFERENCES portraits(id) ON DELETE CASCADE,
  source_id           uuid NOT NULL REFERENCES content_sources(id) ON DELETE CASCADE,
  dimension_category  text NOT NULL,
  dimension_key       text NOT NULL,
  evidence_text       text NOT NULL,
  evidence_type       text NOT NULL CHECK (evidence_type IN ('direct_quote','stated_belief','behavioural_pattern','inferred')),
  confidence          float NOT NULL CHECK (confidence >= 0 AND confidence <= 1),
  source_speaker      text,
  created_at          timestamptz NOT NULL DEFAULT now(),
  UNIQUE (portrait_id, source_id, dimension_key)
);

CREATE INDEX IF NOT EXISTS idx_sona_evidence_portrait_dim
  ON sona_evidence (portrait_id, dimension_category, dimension_key);

-- 4. sona_dimensions
CREATE TABLE IF NOT EXISTS sona_dimensions (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  portrait_id          uuid NOT NULL REFERENCES portraits(id) ON DELETE CASCADE,
  dimension_category   text NOT NULL,
  dimension_key        text NOT NULL,
  score                float CHECK (score >= 0 AND score <= 100),
  confidence           float CHECK (confidence >= 0 AND confidence <= 1),
  confidence_flag      text CHECK (confidence_flag IN ('LOW_CONFIDENCE','AMBIGUOUS') OR confidence_flag IS NULL),
  narrative            text,
  evidence_count       int NOT NULL DEFAULT 0,
  min_tier             access_tier NOT NULL DEFAULT 'public',
  last_synthesised_at  timestamptz,
  created_at           timestamptz NOT NULL DEFAULT now(),
  updated_at           timestamptz NOT NULL DEFAULT now(),
  UNIQUE (portrait_id, dimension_category, dimension_key)
);

CREATE INDEX IF NOT EXISTS idx_sona_dimensions_portrait
  ON sona_dimensions (portrait_id);

-- 5. sona_modules
CREATE TABLE IF NOT EXISTS sona_modules (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  portrait_id          uuid NOT NULL REFERENCES portraits(id) ON DELETE CASCADE,
  module_type          text NOT NULL,
  title                text NOT NULL,
  prompt_content       text NOT NULL,
  activation_keywords  text[] NOT NULL DEFAULT '{}',
  activation_embedding vector(1536),
  nlp_delivery_notes   text,
  min_tier             access_tier NOT NULL DEFAULT 'public',
  confidence           float CHECK (confidence >= 0 AND confidence <= 1),
  superseded_at        timestamptz,
  created_at           timestamptz NOT NULL DEFAULT now(),
  updated_at           timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sona_modules_portrait_active
  ON sona_modules (portrait_id) WHERE superseded_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_sona_modules_embedding
  ON sona_modules USING hnsw (activation_embedding vector_cosine_ops)
  WITH (m = 16, ef_construction = 64)
  WHERE superseded_at IS NULL;

CREATE TRIGGER sona_dimensions_updated_at BEFORE UPDATE ON sona_dimensions FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER sona_modules_updated_at BEFORE UPDATE ON sona_modules FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- 6. sona_identity_prompts
CREATE TABLE IF NOT EXISTS sona_identity_prompts (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  portrait_id    uuid NOT NULL REFERENCES portraits(id) ON DELETE CASCADE,
  tier           access_tier NOT NULL,
  prompt_content text NOT NULL,
  generated_at   timestamptz NOT NULL DEFAULT now(),
  UNIQUE (portrait_id, tier)
);

-- 7. sona_synthesis_jobs
CREATE TABLE IF NOT EXISTS sona_synthesis_jobs (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  portrait_id   uuid NOT NULL REFERENCES portraits(id) ON DELETE CASCADE,
  job_type      text NOT NULL CHECK (job_type IN ('evidence_extraction','dimension_synthesis','module_generation')),
  status        text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','running','complete','error')),
  triggered_by  text NOT NULL DEFAULT 'upload',
  source_id     uuid REFERENCES content_sources(id) ON DELETE SET NULL,
  metadata      jsonb NOT NULL DEFAULT '{}',
  error_msg     text,
  started_at    timestamptz,
  completed_at  timestamptz,
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sona_synthesis_jobs_portrait
  ON sona_synthesis_jobs (portrait_id, job_type, status);

-- 8. sona_transcriptions
CREATE TABLE IF NOT EXISTS sona_transcriptions (
  id                       uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_id                uuid NOT NULL REFERENCES content_sources(id) ON DELETE CASCADE UNIQUE,
  transcript               text NOT NULL,
  transcript_with_speakers jsonb,
  duration_seconds         int,
  language                 text NOT NULL DEFAULT 'en',
  model                    text NOT NULL DEFAULT 'nova-2',
  created_at               timestamptz NOT NULL DEFAULT now()
);

-- 9. RLS — creators can read their own portrait's synthesis data
ALTER TABLE sona_evidence ENABLE ROW LEVEL SECURITY;
ALTER TABLE sona_dimensions ENABLE ROW LEVEL SECURITY;
ALTER TABLE sona_modules ENABLE ROW LEVEL SECURITY;
ALTER TABLE sona_identity_prompts ENABLE ROW LEVEL SECURITY;
ALTER TABLE sona_synthesis_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE sona_transcriptions ENABLE ROW LEVEL SECURITY;

-- Creators read via portrait ownership; service role manages all
CREATE POLICY "creators_read_evidence" ON sona_evidence
  FOR SELECT USING (
    portrait_id IN (SELECT id FROM portraits WHERE creator_id = auth.uid())
  );

CREATE POLICY "creators_read_dimensions" ON sona_dimensions
  FOR SELECT USING (
    portrait_id IN (SELECT id FROM portraits WHERE creator_id = auth.uid())
  );

CREATE POLICY "creators_read_modules" ON sona_modules
  FOR SELECT USING (
    portrait_id IN (SELECT id FROM portraits WHERE creator_id = auth.uid())
  );

CREATE POLICY "creators_read_identity_prompts" ON sona_identity_prompts
  FOR SELECT USING (
    portrait_id IN (SELECT id FROM portraits WHERE creator_id = auth.uid())
  );

CREATE POLICY "creators_read_jobs" ON sona_synthesis_jobs
  FOR SELECT USING (
    portrait_id IN (SELECT id FROM portraits WHERE creator_id = auth.uid())
  );

CREATE POLICY "creators_read_transcriptions" ON sona_transcriptions
  FOR SELECT USING (
    source_id IN (
      SELECT cs.id FROM content_sources cs
      JOIN portraits p ON p.id = cs.portrait_id
      WHERE p.creator_id = auth.uid()
    )
  );

-- Note: service_role bypasses RLS entirely (Supabase default), so no explicit service_role policies are needed.

-- RPC for semantic current selection (added in Task 9 but placed here for schema completeness)
CREATE OR REPLACE FUNCTION match_sona_modules(
  query_embedding vector(1536),
  portrait_id uuid,
  tier_level int,
  match_count int DEFAULT 2,
  similarity_threshold float DEFAULT 0.65
)
RETURNS TABLE (
  id uuid,
  module_type text,
  title text,
  prompt_content text,
  nlp_delivery_notes text,
  similarity float
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    sm.id,
    sm.module_type,
    sm.title,
    sm.prompt_content,
    sm.nlp_delivery_notes,
    1 - (sm.activation_embedding <=> query_embedding) AS similarity
  FROM sona_modules sm
  -- NOTE: modules with NULL activation_embedding are intentionally excluded (embedding not yet generated)
  WHERE
    sm.portrait_id = match_sona_modules.portrait_id
    AND sm.superseded_at IS NULL
    AND CASE sm.min_tier
      WHEN 'public' THEN 0
      WHEN 'acquaintance' THEN 1
      WHEN 'colleague' THEN 2
      WHEN 'family' THEN 3
    END <= match_sona_modules.tier_level
    AND 1 - (sm.activation_embedding <=> query_embedding) >= similarity_threshold
  ORDER BY similarity DESC
  LIMIT match_count;
END;
$$;
