ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS stripe_customer_id  TEXT,
  ADD COLUMN IF NOT EXISTS onboarding_complete BOOLEAN NOT NULL DEFAULT false;

CREATE TABLE IF NOT EXISTS subscriptions (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subscriber_id           UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  portrait_id             UUID NOT NULL REFERENCES portraits(id) ON DELETE CASCADE,
  stripe_subscription_id  TEXT UNIQUE,
  status                  TEXT NOT NULL
                            CHECK (status IN ('active', 'past_due', 'cancelled', 'trialing')),
  tier                    access_tier NOT NULL DEFAULT 'acquaintance',
  current_period_end      TIMESTAMPTZ,
  created_at              TIMESTAMPTZ DEFAULT now(),
  UNIQUE(subscriber_id, portrait_id)
);

CREATE INDEX IF NOT EXISTS idx_subscriptions_subscriber ON subscriptions(subscriber_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_portrait ON subscriptions(portrait_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_stripe
  ON subscriptions(stripe_subscription_id) WHERE stripe_subscription_id IS NOT NULL;

ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;

-- Subscribers see their own subscriptions
CREATE POLICY "subscribers_read_own" ON subscriptions
  FOR SELECT USING (subscriber_id = auth.uid());

-- Service role manages all (webhook handler uses service role key)
CREATE POLICY "service_role_all" ON subscriptions
  FOR ALL USING (auth.role() = 'service_role');
