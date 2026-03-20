-- Add source perspective and interviewee relationship to content_sources.
--
-- source_perspective distinguishes content created by the Sona subject themselves
-- (first_person) from content created by someone speaking about them (third_party).
-- This drives perspective-aware evidence extraction and a conservative weighting
-- multiplier in the synthesis pipeline.
--
-- interviewee_relationship is optional metadata recorded when the source is a
-- third-party interview — useful context for evidence quality assessment.

ALTER TABLE content_sources
  ADD COLUMN source_perspective TEXT NOT NULL DEFAULT 'first_person'
    CHECK (source_perspective IN ('first_person', 'third_party')),
  ADD COLUMN interviewee_relationship TEXT
    CHECK (interviewee_relationship IN ('friend', 'colleague', 'family', 'professional', 'other'));
