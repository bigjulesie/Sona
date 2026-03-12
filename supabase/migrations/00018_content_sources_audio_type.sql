-- Add interview_audio to the content_sources source_type check constraint
ALTER TABLE content_sources
  DROP CONSTRAINT IF EXISTS content_sources_source_type_check;

ALTER TABLE content_sources
  ADD CONSTRAINT content_sources_source_type_check
  CHECK (source_type IN (
    'transcript', 'interview', 'interview_audio',
    'article', 'book', 'essay', 'speech', 'letter', 'other'
  ));
