-- supabase/migrations/00019_web_research.sql

-- New columns on portraits
ALTER TABLE portraits
  ADD COLUMN IF NOT EXISTS linkedin_url        text,
  ADD COLUMN IF NOT EXISTS search_context      text,
  ADD COLUMN IF NOT EXISTS website_url         text,
  ADD COLUMN IF NOT EXISTS web_research_status text NOT NULL DEFAULT 'never'
    CHECK (web_research_status IN ('never', 'running', 'complete', 'error'));

-- Columns to store web-researched article content and origin URL
ALTER TABLE content_sources
  ADD COLUMN IF NOT EXISTS raw_content text,
  ADD COLUMN IF NOT EXISTS source_url  text;

-- New source_type value: web_research
ALTER TABLE content_sources
  DROP CONSTRAINT IF EXISTS content_sources_source_type_check;
ALTER TABLE content_sources
  ADD CONSTRAINT content_sources_source_type_check
  CHECK (source_type IN (
    'transcript', 'interview', 'interview_audio', 'article', 'book',
    'essay', 'speech', 'letter', 'other', 'web_research'
  ));

-- New job type: web_research
ALTER TABLE sona_synthesis_jobs
  DROP CONSTRAINT IF EXISTS sona_synthesis_jobs_job_type_check;
ALTER TABLE sona_synthesis_jobs
  ADD CONSTRAINT sona_synthesis_jobs_job_type_check
  CHECK (job_type IN (
    'evidence_extraction', 'dimension_synthesis', 'module_generation', 'web_research'
  ));
