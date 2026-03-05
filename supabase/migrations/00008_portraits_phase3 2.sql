-- Phase 3: portraits additions
ALTER TABLE portraits
  ADD COLUMN IF NOT EXISTS creator_id          UUID REFERENCES profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS brand               TEXT NOT NULL DEFAULT 'nh'
                                                 CHECK (brand IN ('nh', 'sona')),
  ADD COLUMN IF NOT EXISTS is_public           BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS monthly_price_cents INTEGER,
  ADD COLUMN IF NOT EXISTS stripe_price_id     TEXT,
  ADD COLUMN IF NOT EXISTS tagline             TEXT,
  ADD COLUMN IF NOT EXISTS bio                 TEXT,
  ADD COLUMN IF NOT EXISTS category            TEXT,
  ADD COLUMN IF NOT EXISTS tags                TEXT[] DEFAULT '{}';

CREATE INDEX IF NOT EXISTS idx_portraits_brand_public
  ON portraits(brand, is_public) WHERE is_public = true;

CREATE INDEX IF NOT EXISTS idx_portraits_creator
  ON portraits(creator_id) WHERE creator_id IS NOT NULL;
