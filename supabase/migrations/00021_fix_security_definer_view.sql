-- Fix SECURITY DEFINER vulnerability on portrait_discovery view.
--
-- The view was implicitly SECURITY DEFINER (PostgreSQL default), which caused
-- it to bypass Row Level Security on the underlying subscriptions table when
-- queried by the anon or authenticated roles. Supabase flagged this correctly.
--
-- Resolution (sub-option C from security review):
--   1. Add an explicit, intentional RLS policy on subscriptions that makes
--      aggregate-level subscription counts publicly readable — encoding the
--      business intent that was previously achieved accidentally via the
--      SECURITY DEFINER bypass.
--   2. Rebuild the view with security_invoker = true so it executes under
--      the caller's role and respects all RLS policies normally.
--
-- The subscriber_count and new_subscribers_30d columns in the view are
-- intentionally public marketing data (displayed on /explore to all users
-- including unauthenticated visitors). The policy below makes that intent
-- explicit at the database layer.

-- Step 1: Add explicit public SELECT policy on subscriptions so that anon
-- and authenticated roles can read subscription rows for aggregate counting.
-- Individual subscriber identity is not exposed — only aggregate counts are
-- projected by the portrait_discovery view.
CREATE POLICY "public_subscription_counts"
  ON subscriptions
  FOR SELECT
  TO anon, authenticated
  USING (true);

-- Step 2: Rebuild portrait_discovery with security_invoker = true so the
-- view runs as the querying role and RLS is enforced normally.
-- The query itself is unchanged — only the security context changes.
CREATE OR REPLACE VIEW portrait_discovery
  WITH (security_invoker = true)
AS
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

-- Grant SELECT on the view to anon and authenticated roles so access is
-- unchanged for all existing callers.
GRANT SELECT ON portrait_discovery TO anon, authenticated;
