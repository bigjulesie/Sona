// src/app/api/cron/synthesis-recovery/route.ts
//
// Vercel Cron job — runs every 30 minutes.
// Finds portraits stuck in 'synthesising' status with a synthesis_started_at
// timestamp older than STUCK_THRESHOLD_MS and re-triggers synthesis for them.
//
// A portrait becomes stuck when the Vercel serverless function running
// runFullSynthesis is killed by the platform's 60-second timeout before it
// can finish. In that case no catch block executes and synthesis_status is
// permanently left as 'synthesising', blocking any future run attempts.
//
// Security: Vercel passes the CRON_SECRET header on all cron invocations.
// Set CRON_SECRET in Vercel environment variables (any opaque string).
// The route rejects requests that do not carry the correct value.

import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

// A run is considered stuck if it has been in 'synthesising' state for longer
// than this threshold. 15 minutes is far above the longest plausible successful
// synthesis run (which would be killed at 60s by Vercel anyway) and well below
// the 30-minute cron cadence — so every stuck portrait is recovered within one
// cron cycle.
const STUCK_THRESHOLD_MS = 15 * 60 * 1000 // 15 minutes

export const runtime = 'nodejs'
// Cron handler itself must complete quickly — it only queries DB and fires
// background synthesis via runFullSynthesis (which is also fire-and-forget here,
// matching the existing pattern in /api/creator/deepen).
export const maxDuration = 30

export async function GET(request: NextRequest) {
  // Verify this request comes from Vercel Cron (or an authorised caller).
  const cronSecret = process.env.CRON_SECRET
  if (cronSecret) {
    const authHeader = request.headers.get('authorization')
    if (authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
  }

  const admin = createAdminClient()
  const stuckBefore = new Date(Date.now() - STUCK_THRESHOLD_MS).toISOString()

  // Find all portraits that are stuck in synthesising.
  // We look for:
  //   synthesis_status = 'synthesising'
  //   AND synthesis_started_at < (now - threshold)     ← has synthesis_started_at
  // OR
  //   synthesis_status = 'synthesising'
  //   AND synthesis_started_at IS NULL                 ← pre-migration rows (no timestamp)
  //   AND updated_at < (now - threshold)               ← use updated_at as fallback
  //
  // Both conditions indicate a run that has been stuck for at least STUCK_THRESHOLD_MS.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: stuckByStartedAt, error: e1 } = await (admin as any)
    .from('portraits')
    .select('id, display_name, synthesis_started_at')
    .eq('synthesis_status', 'synthesising')
    .lt('synthesis_started_at', stuckBefore)

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: stuckNoTimestamp, error: e2 } = await (admin as any)
    .from('portraits')
    .select('id, display_name, synthesis_started_at, updated_at')
    .eq('synthesis_status', 'synthesising')
    .is('synthesis_started_at', null)
    .lt('updated_at', stuckBefore)

  if (e1 || e2) {
    console.error('[synthesis-recovery] DB query failed', { e1, e2 })
    return NextResponse.json({ error: 'DB query failed' }, { status: 500 })
  }

  const stuck: Array<{ id: string; display_name: string }> = [
    ...(stuckByStartedAt ?? []),
    ...(stuckNoTimestamp ?? []),
  ]

  if (stuck.length === 0) {
    return NextResponse.json({ ok: true, recovered: 0, message: 'No stuck portraits found' })
  }

  console.log(`[synthesis-recovery] Found ${stuck.length} stuck portrait(s):`,
    stuck.map(p => `${p.display_name} (${p.id})`).join(', '))

  // Reset all stuck portraits to 'error' in one batch update, then re-trigger
  // synthesis for each. We reset first so that runFullSynthesis's own concurrency
  // guard (which skips portraits already in 'synthesising') does not block re-entry.
  const stuckIds = stuck.map(p => p.id)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error: resetError } = await (admin as any)
    .from('portraits')
    .update({
      synthesis_status: 'error',
      synthesis_started_at: null,
    })
    .in('id', stuckIds)

  if (resetError) {
    console.error('[synthesis-recovery] Failed to reset stuck portraits', resetError)
    return NextResponse.json({ error: 'Failed to reset portraits' }, { status: 500 })
  }

  // Mark any orphaned running jobs for these portraits as errored
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (admin as any)
    .from('sona_synthesis_jobs')
    .update({
      status: 'error',
      error_msg: 'Terminated by synthesis-recovery cron — serverless timeout',
      completed_at: new Date().toISOString(),
    })
    .in('portrait_id', stuckIds)
    .in('status', ['running', 'pending'])

  // Re-trigger synthesis for each portrait.
  // runFullSynthesis is fire-and-forget (matching /api/creator/deepen pattern).
  // We import dynamically to avoid the module being bundled unnecessarily.
  const { runFullSynthesis } = await import('@/lib/synthesis/character-synthesise')

  const results: Array<{ id: string; name: string; action: string }> = []

  for (const portrait of stuck) {
    try {
      // Fire and forget — the cron handler returns quickly, synthesis runs in background
      runFullSynthesis(portrait.id, 'cron_recovery').catch((err: unknown) => {
        console.error(`[synthesis-recovery] Re-synthesis failed for ${portrait.id}:`, err)
      })
      results.push({ id: portrait.id, name: portrait.display_name, action: 'synthesis_retriggered' })
    } catch (err) {
      console.error(`[synthesis-recovery] Could not re-trigger synthesis for ${portrait.id}:`, err)
      results.push({ id: portrait.id, name: portrait.display_name, action: 'retrigger_failed' })
    }
  }

  console.log('[synthesis-recovery] Recovery complete:', results)
  return NextResponse.json({ ok: true, recovered: stuck.length, results })
}
