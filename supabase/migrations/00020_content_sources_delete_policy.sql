-- Allow creators to delete their own content sources.
-- The existing SELECT policy (creator_read_own_sources) uses the same ownership check;
-- this adds the matching DELETE policy so deleteContentSource() in server actions works.

CREATE POLICY "creator_delete_own_sources" ON content_sources
  FOR DELETE USING (
    portrait_id IN (
      SELECT id FROM portraits WHERE creator_id = auth.uid()
    )
  );
