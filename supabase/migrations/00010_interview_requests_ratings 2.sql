CREATE TABLE IF NOT EXISTS interview_requests (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_id       UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  portrait_id      UUID NOT NULL REFERENCES portraits(id) ON DELETE CASCADE,
  whatsapp_number  TEXT NOT NULL,
  notes            TEXT,
  status           TEXT NOT NULL DEFAULT 'pending'
                     CHECK (status IN ('pending', 'scheduled', 'completed')),
  scheduled_at     TIMESTAMPTZ,
  created_at       TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE interview_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "creators_manage_own" ON interview_requests
  FOR ALL USING (creator_id = auth.uid());

CREATE POLICY "admins_read_all" ON interview_requests
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true)
  );

CREATE POLICY "admins_update" ON interview_requests
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true)
  );

CREATE TABLE IF NOT EXISTS ratings (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subscriber_id  UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  portrait_id    UUID NOT NULL REFERENCES portraits(id) ON DELETE CASCADE,
  score          INTEGER NOT NULL CHECK (score BETWEEN 1 AND 5),
  created_at     TIMESTAMPTZ DEFAULT now(),
  UNIQUE(subscriber_id, portrait_id)
);

ALTER TABLE ratings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "subscribers_manage_own_ratings" ON ratings
  FOR ALL USING (subscriber_id = auth.uid());

CREATE POLICY "public_read_ratings" ON ratings
  FOR SELECT USING (true);

-- Discovery view: aggregate stats per public Sona portrait
CREATE OR REPLACE VIEW portrait_discovery AS
SELECT
  p.id,
  p.slug,
  p.display_name,
  p.tagline,
  p.avatar_url,
  p.category,
  p.tags,
  p.monthly_price_cents,
  p.brand,
  COUNT(DISTINCT s.id) FILTER (
    WHERE s.status = 'active'
  )                                                       AS subscriber_count,
  COUNT(DISTINCT s.id) FILTER (
    WHERE s.status = 'active'
    AND s.created_at > now() - interval '30 days'
  )                                                       AS new_subscribers_30d,
  ROUND(AVG(r.score)::numeric, 1)                        AS avg_rating,
  COUNT(r.id)                                            AS rating_count
FROM portraits p
LEFT JOIN subscriptions s ON s.portrait_id = p.id
LEFT JOIN ratings r ON r.portrait_id = p.id
WHERE p.is_public = true AND p.brand = 'sona'
GROUP BY p.id;
