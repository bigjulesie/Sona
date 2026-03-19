-- Allow public read of profiles belonging to users with a public Sona portrait.
--
-- The portrait_discovery view uses security_invoker = true, so its join to
-- profiles respects RLS. The existing profiles SELECT policy is
-- "id = auth.uid()", which means only the logged-in user's own profile row
-- is visible — causing creator_avatar_url to be NULL for every other card
-- on the Discover page.
--
-- Creator avatars are display-only public data (the avatars bucket is
-- already publicly readable). This policy makes the profile row readable
-- for any creator who has opted into a public Sona — consistent with the
-- data already exposed via portrait_discovery.

CREATE POLICY "public_read_creator_profiles"
  ON profiles FOR SELECT
  TO anon, authenticated
  USING (
    EXISTS (
      SELECT 1 FROM portraits
      WHERE portraits.creator_id = profiles.id
        AND portraits.is_public  = true
        AND portraits.brand      = 'sona'
    )
  );
