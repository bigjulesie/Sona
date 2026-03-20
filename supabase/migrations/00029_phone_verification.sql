-- 00029_phone_verification.sql
-- Adds phone verification, timezone, and creator consent fields to profiles.
-- Also creates the whatsapp_otps table used by the OTP send/verify API.

-- Profile extensions for Sona creators
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS phone_number      TEXT,
  ADD COLUMN IF NOT EXISTS phone_verified    BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS timezone          TEXT,
  ADD COLUMN IF NOT EXISTS consent_given_at  TIMESTAMPTZ;

-- OTP storage — short-lived, indexed for fast lookup
CREATE TABLE IF NOT EXISTS whatsapp_otps (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  phone_number TEXT        NOT NULL,
  otp_hash     TEXT        NOT NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at   TIMESTAMPTZ NOT NULL DEFAULT NOW() + INTERVAL '10 minutes',
  used         BOOLEAN     NOT NULL DEFAULT false
);

-- Only index unused OTPs — once used they are never queried again
CREATE INDEX IF NOT EXISTS idx_whatsapp_otps_phone_active
  ON whatsapp_otps (phone_number, expires_at)
  WHERE NOT used;

-- Auto-cleanup: delete expired/used OTPs older than 1 hour (keeps the table small)
-- This is enforced via the query logic; a pg_cron cleanup can be added later if volume warrants it.
