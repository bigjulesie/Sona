-- Add creator profile avatar to portrait_discovery view.
--
-- Previously the view only exposed portraits.avatar_url (a portrait-level
-- field). The creator's uploaded profile photo lives in profiles.avatar_url
-- and was never surfaced to the Discover page for cards other than the
-- logged-in user's own portrait.
--
-- Fix: join profiles on creator_id and append two new columns at the end
-- so every SonaCard can display the creator's photo without extra queries.
--
-- New columns are appended after existing aggregates so CREATE OR REPLACE
-- is safe — no column reordering, no DROP required.

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
  COUNT(r.id)                                            AS rating_count,
  prof.avatar_url                                        AS creator_avatar_url,
  prof.avatar_halo_color                                 AS creator_halo_color
FROM portraits p
LEFT JOIN profiles prof ON prof.id = p.creator_id
LEFT JOIN subscriptions s ON s.portrait_id = p.id
LEFT JOIN ratings r ON r.portrait_id = p.id
WHERE p.is_public = true AND p.brand = 'sona'
GROUP BY p.id, prof.avatar_url, prof.avatar_halo_color;

GRANT SELECT ON portrait_discovery TO anon, authenticated;
