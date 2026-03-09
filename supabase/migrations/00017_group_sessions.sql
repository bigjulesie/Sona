-- Group sessions track the lifecycle of an "In the Room" listening session.
-- Each session links to a conversation where the Sona's asides are stored as messages.
-- Raw audio transcript is always ephemeral — never stored here.

CREATE TABLE group_sessions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subscriber_id   UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  portrait_id     UUID NOT NULL REFERENCES portraits(id) ON DELETE CASCADE,
  conversation_id UUID REFERENCES conversations(id) ON DELETE SET NULL,
  status          TEXT NOT NULL DEFAULT 'active'
                    CHECK (status IN ('active', 'paused', 'ended')),
  mode            TEXT NOT NULL DEFAULT 'listening'
                    CHECK (mode IN ('listening', 'active')),
  started_at      TIMESTAMPTZ DEFAULT now(),
  ended_at        TIMESTAMPTZ,
  created_at      TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_group_sessions_subscriber ON group_sessions(subscriber_id);
CREATE INDEX idx_group_sessions_portrait   ON group_sessions(portrait_id);

ALTER TABLE group_sessions ENABLE ROW LEVEL SECURITY;

-- Subscribers manage their own sessions
CREATE POLICY "subscribers_own_group_sessions" ON group_sessions
  FOR ALL USING (subscriber_id = auth.uid());

-- Service role has full access (for PATCH from API routes using admin client)
CREATE POLICY "service_role_group_sessions" ON group_sessions
  FOR ALL USING (auth.role() = 'service_role');

-- Link conversations back to the group session that spawned them
ALTER TABLE conversations
  ADD COLUMN IF NOT EXISTS group_session_id UUID
    REFERENCES group_sessions(id) ON DELETE SET NULL;

CREATE INDEX idx_conversations_group_session
  ON conversations(group_session_id)
  WHERE group_session_id IS NOT NULL;
