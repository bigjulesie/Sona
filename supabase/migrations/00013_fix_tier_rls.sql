-- Fix knowledge_chunks RLS to use per-portrait subscription tier
-- instead of the global profiles.access_tier column.
--
-- A user's effective tier for a given portrait is:
--   1. Their active subscription tier for that portrait (if one exists)
--   2. Their profile access_tier as fallback (defaults to 'public')

CREATE OR REPLACE FUNCTION user_tier_for_portrait(portrait_uuid UUID)
RETURNS access_tier
LANGUAGE plpgsql STABLE SECURITY DEFINER
AS $$
DECLARE
  sub_tier access_tier;
  profile_tier access_tier;
BEGIN
  -- Check for an active subscription to this specific portrait
  SELECT tier INTO sub_tier
  FROM subscriptions
  WHERE subscriber_id = auth.uid()
    AND portrait_id = portrait_uuid
    AND status IN ('active', 'trialing');

  IF FOUND THEN
    RETURN sub_tier;
  END IF;

  -- Fall back to global profile tier
  SELECT access_tier INTO profile_tier
  FROM profiles
  WHERE id = auth.uid();

  RETURN COALESCE(profile_tier, 'public');
END;
$$;

-- Drop the broken policy
DROP POLICY IF EXISTS "Knowledge chunks filtered by user access tier" ON knowledge_chunks;

-- New policy: per-portrait subscription-aware tier check
CREATE POLICY "Knowledge chunks filtered by subscription tier"
  ON knowledge_chunks FOR SELECT
  TO authenticated
  USING (
    tier_level(user_tier_for_portrait(portrait_id))
    >= tier_level(min_tier)
  );
