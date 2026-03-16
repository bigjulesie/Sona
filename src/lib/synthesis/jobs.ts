// src/lib/synthesis/jobs.ts
import { createAdminClient } from '@/lib/supabase/admin'
import type { SynthesisJobType, SynthesisJobStatus } from './types'

const SOURCE_TYPE_WEIGHTS: Record<string, number> = {
  interview_audio: 1.3,
  interview: 1.2,
  article: 1.0,
  book: 1.0,
  essay: 1.0,
  transcript: 1.0,
  speech: 1.0,
  letter: 1.0,
  social_media: 0.8,
  other: 0.9,
  web_research: 1.0,
}

export const EVIDENCE_TYPE_WEIGHTS: Record<string, number> = {
  direct_quote: 1.0,
  stated_belief: 0.9,
  behavioural_pattern: 0.7,
  inferred: 0.4,
}

/**
 * Exponential decay recency weight.
 * Half-life ≈ 5 years: weight(0yr) = 1.0, weight(3yr) ≈ 0.66, weight(5yr) ≈ 0.50
 */
export function calculateRecencyWeight(date: Date | null): number {
  const d = date ?? new Date()
  const yearsAgo = (Date.now() - d.getTime()) / (1000 * 60 * 60 * 24 * 365.25)
  return Math.exp(-0.138 * yearsAgo)
}

export function getSourceTypeWeight(sourceType: string): number {
  return SOURCE_TYPE_WEIGHTS[sourceType] ?? 0.9
}

export async function createJob(
  portraitId: string,
  jobType: SynthesisJobType,
  triggeredBy: string,
  sourceId?: string,
): Promise<string> {
  const admin = createAdminClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (admin as any)
    .from('sona_synthesis_jobs')
    .insert({
      portrait_id: portraitId,
      job_type: jobType,
      status: 'pending',
      triggered_by: triggeredBy,
      source_id: sourceId ?? null,
    })
    .select('id')
    .single()
  if (error) throw error
  return data.id
}

export async function updateJob(
  jobId: string,
  status: SynthesisJobStatus,
  metadata?: Record<string, unknown>,
  errorMsg?: string,
) {
  const admin = createAdminClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (admin as any)
    .from('sona_synthesis_jobs')
    .update({
      status,
      metadata: metadata ?? {},
      error_msg: errorMsg ?? null,
      started_at: status === 'running' ? new Date().toISOString() : undefined,
      completed_at: status === 'complete' || status === 'error'
        ? new Date().toISOString()
        : undefined,
    })
    .eq('id', jobId)
}

export async function countRecentExtractions(
  portraitId: string,
  sinceLastSynthesis: Date | null,
): Promise<number> {
  const admin = createAdminClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let query = (admin as any)
    .from('sona_synthesis_jobs')
    .select('id', { count: 'exact', head: true })
    .eq('portrait_id', portraitId)
    .eq('job_type', 'evidence_extraction')
    .eq('status', 'complete')
  if (sinceLastSynthesis) {
    query = query.gt('completed_at', sinceLastSynthesis.toISOString())
  }
  const { count } = await query
  return count ?? 0
}
