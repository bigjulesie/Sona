-- Harden user_tier_for_portrait SECURITY DEFINER function.
--
-- The function correctly uses SECURITY DEFINER so that the knowledge_chunks
-- RLS policy can query subscriptions and profiles without infinite recursion.
-- However, it was missing SET search_path = public, leaving a search-path
-- injection vector: a malicious role could shadow the subscriptions or
-- profiles tables with objects in an earlier schema on the search path.
--
-- Fix: add SET search_path = public to pin all unqualified table references
-- to the public schema, matching the hardening already present on the
-- handle_new_user() trigger function.

CREATE OR REPLACE FUNCTION user_tier_for_portrait(portrait_uuid UUID)
RETURNS access_tier
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
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
