-- Enable RLS on all tables
ALTER TABLE portraits ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE knowledge_chunks ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;

-- Portraits: readable by all authenticated users
CREATE POLICY "Portraits are viewable by authenticated users"
  ON portraits FOR SELECT
  TO authenticated
  USING (true);

-- Profiles: users can read their own profile
CREATE POLICY "Users can view own profile"
  ON profiles FOR SELECT
  TO authenticated
  USING (id = auth.uid());

-- Profiles: users can update their own profile (not access_tier)
CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE
  TO authenticated
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

-- Knowledge chunks: tiered access control
-- Maps access_tier enum to numeric value for comparison
CREATE OR REPLACE FUNCTION tier_level(t access_tier) RETURNS INTEGER AS $$
BEGIN
  RETURN CASE t
    WHEN 'public' THEN 0
    WHEN 'acquaintance' THEN 1
    WHEN 'colleague' THEN 2
    WHEN 'family' THEN 3
  END;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

CREATE POLICY "Knowledge chunks filtered by user access tier"
  ON knowledge_chunks FOR SELECT
  TO authenticated
  USING (
    tier_level((SELECT access_tier FROM profiles WHERE id = auth.uid()))
    >= tier_level(min_tier)
  );

-- Conversations: users can only see their own
CREATE POLICY "Users can view own conversations"
  ON conversations FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users can create conversations"
  ON conversations FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own conversations"
  ON conversations FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid());

-- Messages: users can see messages in their own conversations
CREATE POLICY "Users can view messages in own conversations"
  ON messages FOR SELECT
  TO authenticated
  USING (
    conversation_id IN (
      SELECT id FROM conversations WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can create messages in own conversations"
  ON messages FOR INSERT
  TO authenticated
  WITH CHECK (
    conversation_id IN (
      SELECT id FROM conversations WHERE user_id = auth.uid()
    )
  );

-- Audit log: insert-only for service role, no user reads
CREATE POLICY "Service role can insert audit logs"
  ON audit_log FOR INSERT
  TO service_role
  WITH CHECK (true);

CREATE POLICY "Service role can read audit logs"
  ON audit_log FOR SELECT
  TO service_role
  USING (true);
