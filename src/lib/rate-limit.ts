import { createAdminClient } from '@/lib/supabase/admin'

// Per-user limits per hour
const LIMITS: Record<string, number> = {
  chat:       100,
  tts:         60,
  transcribe:  60,
  group_transcribe: 200,
  ingest:      20,
}

/**
 * Returns true if the user is within the rate limit for the given action.
 * Uses audit_log as the counter — callers must log the action AFTER this check passes.
 */
export async function checkRateLimit(userId: string, action: string): Promise<boolean> {
  const maxPerHour = LIMITS[action]
  if (!maxPerHour) return true

  const windowStart = new Date(Date.now() - 60 * 60 * 1000).toISOString()
  const admin = createAdminClient()

  const { count } = await admin
    .from('audit_log')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('action', action)
    .gte('created_at', windowStart)

  return (count ?? 0) < maxPerHour
}
