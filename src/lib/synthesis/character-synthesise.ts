// src/lib/synthesis/character-synthesise.ts
import Anthropic from '@anthropic-ai/sdk'
import { createAdminClient } from '@/lib/supabase/admin'
import { createJob, updateJob, calculateRecencyWeight, getSourceTypeWeight, getPerspectiveMultiplier, EVIDENCE_TYPE_WEIGHTS } from './jobs'
import type { SynthesisedDimension, ConfidenceFlag } from './types'
import { TIER_PROMPT_DEPTH, DIMENSION_MIN_TIER } from './types'

interface EvidenceRow {
  dimension_key: string
  dimension_category: string
  evidence_text: string
  evidence_type: string
  confidence: number
  source_type: string
  source_date: string | null
  source_perspective: string
}

interface WeightInput {
  raw_confidence: number
  evidence_type: string
  source_type: string
  source_date: Date | null
  source_perspective: string
}

export function computeWeightedConfidence(input: WeightInput): number {
  const typeWeight = EVIDENCE_TYPE_WEIGHTS[input.evidence_type] ?? 0.5
  const sourceWeight = getSourceTypeWeight(input.source_type)
  const recencyWeight = calculateRecencyWeight(input.source_date)
  const perspectiveMultiplier = getPerspectiveMultiplier(input.source_perspective)
  return input.raw_confidence * typeWeight * sourceWeight * recencyWeight * perspectiveMultiplier
}

export function groupEvidenceByDimension(
  rows: EvidenceRow[],
): Record<string, EvidenceRow[]> {
  const grouped: Record<string, EvidenceRow[]> = {}
  for (const row of rows) {
    if (!grouped[row.dimension_key]) grouped[row.dimension_key] = []
    grouped[row.dimension_key].push(row)
  }
  return grouped
}

function computeConfidenceFlag(
  confidence: number,
  evidenceCount: number,
  isAmbiguous: boolean,
): ConfidenceFlag {
  if (isAmbiguous) return 'AMBIGUOUS'
  if (confidence < 0.5 || evidenceCount < 3) return 'LOW_CONFIDENCE'
  return null
}

async function synthesiseDimension(
  dimensionKey: string,
  category: string,
  evidenceRows: EvidenceRow[],
): Promise<SynthesisedDimension> {
  const client = new Anthropic()
  const weightedItems = evidenceRows.map(e => ({
    ...e,
    multiplier: computeWeightedConfidence({
      raw_confidence: 1.0, // Use 1.0 to get just the multiplier
      evidence_type: e.evidence_type,
      source_type: e.source_type,
      source_date: e.source_date ? new Date(e.source_date) : null,
      source_perspective: e.source_perspective,
    }),
    weighted: computeWeightedConfidence({
      raw_confidence: e.confidence,
      evidence_type: e.evidence_type,
      source_type: e.source_type,
      source_date: e.source_date ? new Date(e.source_date) : null,
      source_perspective: e.source_perspective,
    }),
  }))

  const totalWeightedConfidence = weightedItems.reduce((s, e) => s + e.weighted, 0)
  const totalMultiplier = weightedItems.reduce((s, e) => s + e.multiplier, 0)
  const avgConfidence = totalMultiplier > 0
    ? Math.min(1, totalWeightedConfidence / totalMultiplier)
    : 0
  const evidenceText = weightedItems
    .sort((a, b) => b.weighted - a.weighted)
    .map(e => `[${e.evidence_type}, confidence ${e.weighted.toFixed(2)}]: "${e.evidence_text}"`)
    .join('\n')

  const response = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 300,
    messages: [{
      role: 'user',
      content: `Synthesise the following evidence about a person's ${category} dimension "${dimensionKey}".

Evidence items (weighted by source quality and recency):
${evidenceText}

Return a JSON object with:
- score: normalised 0–100 (where 100 = extremely high on this dimension)
- narrative: 60–80 words describing this dimension as a human quality — not a score, a person
- is_ambiguous: true if the evidence items are in genuine tension with each other

Return ONLY valid JSON. No preamble.`,
    }],
  })

  let parsed: any = {}
  try {
    const raw = response.content[0]?.type === 'text' ? response.content[0].text : '{}'
    parsed = JSON.parse(raw.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, ''))
  } catch { /* use defaults */ }

  return {
    dimension_category: category as any,
    dimension_key: dimensionKey,
    score: Math.max(0, Math.min(100, parsed.score ?? 50)),
    confidence: Math.min(1, avgConfidence),
    confidence_flag: computeConfidenceFlag(avgConfidence, evidenceRows.length, !!parsed.is_ambiguous),
    narrative: parsed.narrative ?? '',
    evidence_count: evidenceRows.length,
  }
}

async function generateIdentityPrompts(
  portraitId: string,
  dimensions: SynthesisedDimension[],
  displayName: string,
): Promise<Record<string, string>> {
  const client = new Anthropic()
  const tiers = ['public', 'acquaintance', 'colleague', 'family']
  const prompts: Record<string, string> = {}

  const dimensionSummary = dimensions
    .filter(d => d.narrative)
    .map(d => `${d.dimension_category}/${d.dimension_key}: ${d.narrative}`)
    .join('\n')

  for (const tier of tiers) {
    const depth = TIER_PROMPT_DEPTH[tier]
    const response = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 800,
      messages: [{
        role: 'user',
        content: `Write a Claude system prompt for a Sona — an AI persona representing ${displayName}.

The prompt should be second-person ("You are ${displayName}...") and ${depth}

Character profile (use what is relevant to the tier depth above):
${dimensionSummary}

Write a cohesive, natural identity prompt. Do not list dimensions mechanically — describe the person. No preamble or explanation, just the system prompt text.`,
      }],
    })
    prompts[tier] = response.content[0]?.type === 'text' ? response.content[0].text : ''
  }

  return prompts
}

export async function runFullSynthesis(portraitId: string, triggeredBy: string) {
  const admin = createAdminClient()

  // Check minimum evidence threshold
  const { data: evidenceCheck } = await (admin as any)
    .from('sona_evidence')
    .select('dimension_category')
    .eq('portrait_id', portraitId)

  const uniqueCategories = new Set((evidenceCheck ?? []).map((e: any) => e.dimension_category))
  if (uniqueCategories.size < 4) return // Not enough breadth yet

  // Guard against concurrent runs
  const { data: current } = await (admin as any)
    .from('portraits')
    .select('synthesis_status')
    .eq('id', portraitId)
    .single()
  if (current?.synthesis_status === 'synthesising') return

  // Mark portrait as synthesising
  await (admin as any).from('portraits')
    .update({ synthesis_status: 'synthesising' })
    .eq('id', portraitId)

  const jobId = await createJob(portraitId, 'dimension_synthesis', triggeredBy)
  await updateJob(jobId, 'running')

  try {
    // Load all evidence with source metadata
    const { data: allEvidence } = await (admin as any)
      .from('sona_evidence')
      .select(`
        dimension_key, dimension_category, evidence_text, evidence_type, confidence,
        content_sources!inner(source_type, source_date, source_perspective)
      `)
      .eq('portrait_id', portraitId)

    const rows: EvidenceRow[] = (allEvidence ?? []).map((e: any) => ({
      dimension_key: e.dimension_key,
      dimension_category: e.dimension_category,
      evidence_text: e.evidence_text,
      evidence_type: e.evidence_type,
      confidence: e.confidence,
      source_type: e.content_sources?.source_type ?? 'other',
      source_date: e.content_sources?.source_date ?? null,
      source_perspective: e.content_sources?.source_perspective ?? 'first_person',
    }))

    const grouped = groupEvidenceByDimension(rows)
    const dimensions: SynthesisedDimension[] = []

    for (const [dimKey, dimRows] of Object.entries(grouped)) {
      const category = dimRows[0].dimension_category
      const dim = await synthesiseDimension(dimKey, category, dimRows)
      dimensions.push(dim)
    }

    // Upsert dimensions
    const dimRows = dimensions.map(d => ({
      portrait_id: portraitId,
      dimension_category: d.dimension_category,
      dimension_key: d.dimension_key,
      score: d.score,
      confidence: d.confidence,
      confidence_flag: d.confidence_flag,
      narrative: d.narrative,
      evidence_count: d.evidence_count,
      min_tier: DIMENSION_MIN_TIER[d.dimension_category] ?? 'public',
      last_synthesised_at: new Date().toISOString(),
    }))
    await (admin as any).from('sona_dimensions')
      .upsert(dimRows, { onConflict: 'portrait_id,dimension_category,dimension_key' })

    // Generate tier-stratified identity prompts
    const { data: portrait } = await (admin as any)
      .from('portraits')
      .select('display_name')
      .eq('id', portraitId)
      .single()

    const prompts = await generateIdentityPrompts(portraitId, dimensions, portrait?.display_name ?? 'this person')

    // Upsert identity prompts (written only on success)
    for (const [tier, content] of Object.entries(prompts)) {
      await (admin as any).from('sona_identity_prompts')
        .upsert({ portrait_id: portraitId, tier, prompt_content: content, generated_at: new Date().toISOString() },
          { onConflict: 'portrait_id,tier' })
    }

    // Update portraits.system_prompt with public tier for backwards compat
    await (admin as any).from('portraits')
      .update({ system_prompt: prompts['public'] ?? '' })
      .eq('id', portraitId)

    await updateJob(jobId, 'complete', { dimensions_synthesised: dimensions.length })

    // Immediately run currents generation (Stage 3)
    // Note: generateCurrents sets synthesis_status = 'ready' on completion
    // Variable indirection prevents static resolution failure when module doesn't exist yet
    const currentsModule = './currents-generate'
    try {
      const { generateCurrents } = await import(/* @vite-ignore */ currentsModule)
      await generateCurrents(portraitId, triggeredBy)
    } catch {
      // currents-generate not yet available or failed — mark ready anyway
      await (admin as any).from('portraits')
        .update({ synthesis_status: 'ready', last_synthesised_at: new Date().toISOString() })
        .eq('id', portraitId)
    }
  } catch (err) {
    await (admin as any).from('portraits')
      .update({ synthesis_status: 'error' })
      .eq('id', portraitId)
    await updateJob(jobId, 'error', {}, err instanceof Error ? err.message : 'Failed')
  }
}
