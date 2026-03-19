-- Add voice_gender preference to profiles.
-- Stores the user's chosen voice for their Sona's spoken responses.
-- Null until the user makes a selection during onboarding or in account settings.

ALTER TABLE profiles
  ADD COLUMN voice_gender TEXT CHECK (voice_gender IN ('male', 'female'));
