// src/lib/synthesis/currents-generate.ts
import Anthropic from '@anthropic-ai/sdk'
import { createAdminClient } from '@/lib/supabase/admin'
import { generateEmbedding } from '@/lib/ingest/embeddings'
import { createJob, updateJob } from './jobs'
import type { GeneratedCurrent } from './types'

export const CANDIDATE_MODULE_TYPES = [
  'business_strategy',
  'leadership_management',
  'relationships_personal',
  'decision_making',
  'personal_philosophy',
  'creative_process',
  'learning_growth',
  'communication_influence',
  'emotional_intelligence',
  'conflict_resolution',
] as const

// Which dimension keys signal relevance for each module type
const MODULE_DIMENSION_SIGNALS: Record<string, string[]> = {
  business_strategy: ['achievement', 'risk_orientation', 'conscientiousness', 'self_direction'],
  leadership_management: ['achievement', 'power', 'extraversion', 'conscientiousness'],
  relationships_personal: ['agreeableness', 'benevolence', 'warmth', 'meta_program_reference'],
  decision_making: ['risk_orientation', 'achievement', 'conscientiousness', 'decision_making_style', 'logical_level_primary', 'meta_program_motivation'],
  personal_philosophy: ['universalism', 'self_direction', 'tradition', 'worldview'],
  creative_process: ['openness', 'stimulation', 'chunk_size_preference'],
  learning_growth: ['openness', 'self_direction', 'conscientiousness'],
  communication_influence: ['directness', 'warmth', 'language_model_tendency', 'primary_rep_system'],
  emotional_intelligence: ['agreeableness', 'neuroticism', 'warmth', 'meta_program_reference'],
  conflict_resolution: ['agreeableness', 'directness', 'meta_program_motivation'],
}

interface DimensionSummary {
  dimension_key: string
  dimension_category: string
  confidence: number
  evidence_count: number
  narrative?: string
}

export function identifyRelevantModuleTypes(dimensions: DimensionSummary[]): string[] {
  const qualifiedKeys = new Set(
    dimensions
      .filter(d => d.confidence >= 0.5 && d.evidence_count >= 3)
      .map(d => d.dimension_key)
  )

  return CANDIDATE_MODULE_TYPES.filter(moduleType => {
    const signals = MODULE_DIMENSION_SIGNALS[moduleType] ?? []
    const matchCount = signals.filter(s => qualifiedKeys.has(s)).length
    return matchCount >= 2 // Need at least 2 qualified signals
  })
}

async function generateCurrent(
  moduleType: string,
  displayName: string,
  dimensions: DimensionSummary[],
  nlpProfile: DimensionSummary[],
): Promise<GeneratedCurrent | null> {
  const client = new Anthropic()
  const signals = MODULE_DIMENSION_SIGNALS[moduleType] ?? []
  const relevantDims = dimensions.filter(d => signals.includes(d.dimension_key))
  const dimSummary = relevantDims
    .filter(d => d.narrative)
    .map(d => `${d.dimension_key}: ${d.narrative}`)
    .join('\n')

  const nlpSummary = nlpProfile
    .filter(d => d.narrative)
    .map(d => `${d.dimension_key}: ${d.narrative}`)
    .join('\n')

  const response = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 1000,
    messages: [{
      role: 'user',
      content: `Create a contextual behavioural current (a focused system prompt module) for ${displayName}'s Sona in the domain: ${moduleType.replace(/_/g, ' ')}.

Relevant character dimensions:
${dimSummary}

NLP communication profile:
${nlpSummary}

Return a JSON object with:
- title: short human-readable name (e.g. "Strategic Thinking")
- prompt_content: the behavioural instruction for Claude (second person, "When discussing [domain], you approach it this way..."). 150–250 words.
- activation_keywords: array of 8–12 terms/phrases that indicate this current is relevant
- nlp_delivery_notes: precise NLP-calibrated delivery instructions — which predicates to use, Dilts level, motivation direction, chunk size, language model tendency. 60–80 words.
- confidence: 0.0–1.0 based on strength of available evidence

If there is insufficient evidence to generate a credible current, return null.

Return ONLY valid JSON. No preamble.`,
    }],
  })

  try {
    const raw = response.content[0]?.type === 'text' ? response.content[0].text : 'null'
    const cleaned = raw.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '').trim()
    const parsed = JSON.parse(cleaned)
    if (!parsed || !parsed.prompt_content) return null
    return {
      module_type: moduleType,
      title: parsed.title ?? moduleType,
      prompt_content: parsed.prompt_content,
      activation_keywords: parsed.activation_keywords ?? [],
      nlp_delivery_notes: parsed.nlp_delivery_notes ?? '',
      confidence: Math.max(0, Math.min(1, parsed.confidence ?? 0.5)),
    }
  } catch {
    return null
  }
}

export async function generateCurrents(portraitId: string, triggeredBy: string) {
  const admin = createAdminClient()
  const jobId = await createJob(portraitId, 'module_generation', triggeredBy)
  await updateJob(jobId, 'running')

  try {
    const { data: portrait } = await (admin as any)
      .from('portraits')
      .select('display_name')
      .eq('id', portraitId)
      .single()

    const { data: allDimensions } = await (admin as any)
      .from('sona_dimensions')
      .select('dimension_key, dimension_category, confidence, evidence_count, narrative')
      .eq('portrait_id', portraitId)

    const dimensions: DimensionSummary[] = allDimensions ?? []
    const nlpProfile = dimensions.filter(d => d.dimension_category === 'nlp_patterns')
    const moduleTypes = identifyRelevantModuleTypes(dimensions)

    // Soft-delete existing active currents
    await (admin as any).from('sona_modules')
      .update({ superseded_at: new Date().toISOString() })
      .eq('portrait_id', portraitId)
      .is('superseded_at', null)

    let generatedCount = 0
    for (const moduleType of moduleTypes) {
      const current = await generateCurrent(
        moduleType,
        portrait?.display_name ?? 'this person',
        dimensions,
        nlpProfile,
      )
      if (!current) continue

      // Generate activation embedding
      const embeddingText = `${current.title} ${current.activation_keywords.join(' ')} ${moduleType.replace(/_/g, ' ')}`
      const embedding = await generateEmbedding(embeddingText)

      await (admin as any).from('sona_modules').insert({
        portrait_id: portraitId,
        module_type: current.module_type,
        title: current.title,
        prompt_content: current.prompt_content,
        activation_keywords: current.activation_keywords,
        activation_embedding: JSON.stringify(embedding),
        nlp_delivery_notes: current.nlp_delivery_notes,
        min_tier: 'public',
        confidence: current.confidence,
      })
      generatedCount++
    }

    // Synthesis complete — only now update status to 'ready'
    await (admin as any).from('portraits').update({
      synthesis_status: 'ready',
      last_synthesised_at: new Date().toISOString(),
    }).eq('id', portraitId)

    await updateJob(jobId, 'complete', { currents_generated: generatedCount })
  } catch (err) {
    await (admin as any).from('portraits')
      .update({ synthesis_status: 'error' })
      .eq('id', portraitId)
    await updateJob(jobId, 'error', {}, err instanceof Error ? err.message : 'Failed')
  }
}
