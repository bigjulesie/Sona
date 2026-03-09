-- Composite index to support the rate-limit COUNT(*) query pattern:
--   WHERE user_id = $1 AND action = $2 AND created_at >= $3
-- Without this, the query does a full table scan as audit_log grows.
CREATE INDEX IF NOT EXISTS idx_audit_log_rate_limit
  ON audit_log (user_id, action, created_at DESC);
