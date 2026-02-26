ALTER TABLE portraits
  ADD COLUMN voice_enabled     BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN voice_provider_id TEXT;
