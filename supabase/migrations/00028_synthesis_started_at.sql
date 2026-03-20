-- supabase/migrations/00028_synthesis_started_at.sql
--
-- Add synthesis_started_at to portraits so the recovery cron can detect runs
-- that were killed by a Vercel serverless timeout (no catch block runs on SIGKILL).
--
-- A portrait is considered stuck when:
--   synthesis_status = 'synthesising'
--   AND synthesis_started_at < NOW() - INTERVAL '15 minutes'
--
-- The threshold is generous: the longest plausible synthesis (30+ dimensions,
-- 4 identity prompts, 10 currents) takes ~90s on a fast day and would fail at
-- the 60s Vercel Pro timeout. 15 minutes gives ample margin for legitimate runs
-- while still recovering promptly.

ALTER TABLE portraits
  ADD COLUMN IF NOT EXISTS synthesis_started_at timestamptz;

-- Index to make the recovery cron query fast even with many portraits
CREATE INDEX IF NOT EXISTS idx_portraits_synthesis_started_at
  ON portraits (synthesis_started_at)
  WHERE synthesis_status = 'synthesising';

-- Also add 'web_research' to the synthesis_jobs job_type check if not already present.
-- (The web_research type was referenced in types.ts but the DB constraint only covers
-- the original four types. This is a safety migration only — add IF NOT EXISTS via
-- a conditional DO block since ALTER TABLE ... ADD CONSTRAINT IF NOT EXISTS is not
-- available in all Postgres versions.)
DO $$
BEGIN
  -- Attempt to drop and recreate the constraint to add web_research.
  -- Wrapped in exception handler so it's a no-op if already correct.
  BEGIN
    ALTER TABLE sona_synthesis_jobs
      DROP CONSTRAINT IF EXISTS sona_synthesis_jobs_job_type_check;
    ALTER TABLE sona_synthesis_jobs
      ADD CONSTRAINT sona_synthesis_jobs_job_type_check
        CHECK (job_type IN ('evidence_extraction','dimension_synthesis','module_generation','web_research'));
  EXCEPTION WHEN OTHERS THEN
    -- Ignore — constraint may already include web_research
    NULL;
  END;
END
$$;
