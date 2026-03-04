-- Allow unauthenticated (anon) users to read public Sona portraits
-- This is required for the /explore page and /sona/[slug] profile page
CREATE POLICY "Public Sona portraits are readable by anyone"
  ON portraits FOR SELECT
  TO anon
  USING (brand = 'sona' AND is_public = true);

-- Allow anon users to read portrait_discovery view data
-- (The view already filters to is_public=true AND brand='sona')
-- No RLS needed on the view itself; it reads portraits with the above policy.

-- Allow anon reads on knowledge_chunks at public tier for Sona portraits
-- (So the teaser preview chat can fetch public-tier chunks)
CREATE POLICY "Public tier chunks readable by anyone for Sona portraits"
  ON knowledge_chunks FOR SELECT
  TO anon
  USING (
    min_tier = 'public'
    AND portrait_id IN (
      SELECT id FROM portraits WHERE brand = 'sona' AND is_public = true
    )
  );
