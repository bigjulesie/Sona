// src/lib/synthesis/evidence-extract.ts
import Anthropic from '@anthropic-ai/sdk'
import { createAdminClient } from '@/lib/supabase/admin'
import { createJob, updateJob } from './jobs'
import type { ExtractedEvidence } from './types'

const WINDOW_SIZE = 4000
const WINDOW_OVERLAP = 400

export function buildSectionWindows(text: string): string[] {
  if (text.length <= WINDOW_SIZE) return [text]
  const windows: string[] = []
  let start = 0
  while (start < text.length) {
    windows.push(text.slice(start, start + WINDOW_SIZE))
    start += WINDOW_SIZE - WINDOW_OVERLAP
  }
  return windows
}

export function parseEvidenceResponse(raw: string): ExtractedEvidence[] {
  try {
    // Strip markdown code fence if present
    const cleaned = raw.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '').trim()
    const parsed = JSON.parse(cleaned)
    if (!Array.isArray(parsed)) return []
    return parsed
      .filter((item: any) =>
        item?.dimension_category &&
        item?.dimension_key &&
        item?.evidence_text &&
        item?.evidence_type &&
        typeof item?.confidence === 'number'
      )
      .map((item: any) => ({
        ...item,
        confidence: Math.max(0, Math.min(1, item.confidence)),
      }))
  } catch {
    return []
  }
}

const EXTRACTION_SYSTEM_PROMPT = `You are a precise psychological analyst extracting evidence from a person's content.

For each piece of evidence you find, return a JSON object with exactly these fields:
- dimension_category: one of: personality | values | communication | cognitive | nlp_patterns | expertise | beliefs
- dimension_key: the specific dimension (see reference below)
- evidence_text: verbatim quote or very close paraphrase
- evidence_type: direct_quote | stated_belief | behavioural_pattern | inferred
- confidence: 0.0–1.0 (higher for verbatim quotes, lower for inferred)

DIMENSION REFERENCE:
personality: openness, conscientiousness, extraversion, agreeableness, neuroticism
values: self_direction, stimulation, hedonism, achievement, power, security, conformity, tradition, benevolence, universalism
communication: directness, warmth, formality, analytical_intuitive_balance, use_of_humour
cognitive: decision_making_style, risk_orientation, worldview, chunk_size_preference
nlp_patterns:
  primary_rep_system (visual|auditory|kinaesthetic|auditory_digital — from predicate patterns)
  meta_program_motivation (toward|away_from — does this person move toward goals or away from problems?)
  meta_program_chunk_size (big_picture|detail_oriented)
  meta_program_reference (internal|external — validates internally or seeks external confirmation)
  logical_level_primary (environment|behaviour|capability|beliefs_values|identity|purpose — which Dilts level?)
  language_model_tendency (milton_model|meta_model — abstract/permissive vs precise/direct)
  timeline_orientation (in_time|through_time)
expertise: [auto-identify domain label, e.g. entrepreneurship, medicine, law]
beliefs: [specific belief statements about world, self, or others]

Return ONLY a JSON array. No preamble. No explanation.
Extract only what is clearly present — do not invent or over-infer.`

// Prompt for content where someone else is speaking ABOUT the subject.
// The interviewee's observations, descriptions, and assessments are the evidence.
const THIRD_PARTY_EXTRACTION_SYSTEM_PROMPT = `You are a precise psychological analyst extracting evidence about a person from a third-party interview.

IMPORTANT CONTEXT: This content is from someone speaking ABOUT the subject — not the subject themselves. The interviewee is a person who knows the subject (a friend, colleague, or family member) and is describing them. Extract only the interviewee's observations, assessments, and descriptions of the subject. Ignore interviewer questions.

Map what you find to these evidence types:
- direct_quote: something the interviewee directly quotes the subject as having said
- behavioural_pattern: behaviours the interviewee has repeatedly observed in the subject
- stated_belief: beliefs or values the interviewee attributes to the subject based on close knowledge
- inferred: the interviewee's general impressions or evaluative judgements about the subject

Confidence guidance:
- Quoted statements from the subject: 0.7–0.85 (filtered through memory)
- Observed repeated behaviours: 0.6–0.75 (based on direct experience)
- Attributed beliefs and values: 0.5–0.65 (inferred from close observation)
- General impressions: 0.3–0.5 (subjective assessment)

For each piece of evidence, return a JSON object with exactly these fields:
- dimension_category: one of: personality | values | communication | cognitive | nlp_patterns | expertise | beliefs
- dimension_key: the specific dimension (see reference below)
- evidence_text: the interviewee's words describing the subject, or close paraphrase
- evidence_type: direct_quote | stated_belief | behavioural_pattern | inferred
- confidence: 0.0–1.0 per the guidance above

DIMENSION REFERENCE:
personality: openness, conscientiousness, extraversion, agreeableness, neuroticism
values: self_direction, stimulation, hedonism, achievement, power, security, conformity, tradition, benevolence, universalism
communication: directness, warmth, formality, analytical_intuitive_balance, use_of_humour
cognitive: decision_making_style, risk_orientation, worldview, chunk_size_preference
nlp_patterns:
  primary_rep_system (visual|auditory|kinaesthetic|auditory_digital)
  meta_program_motivation (toward|away_from)
  meta_program_chunk_size (big_picture|detail_oriented)
  meta_program_reference (internal|external)
  logical_level_primary (environment|behaviour|capability|beliefs_values|identity|purpose)
  language_model_tendency (milton_model|meta_model)
  timeline_orientation (in_time|through_time)
expertise: [auto-identify domain label]
beliefs: [specific belief statements about world, self, or others]

Return ONLY a JSON array. No preamble. No explanation.
Extract only what is clearly present — do not invent or over-infer.`

export async function extractEvidenceFromText(
  text: string,
  sourceType: string,
  sourcePerspective: string = 'first_person',
): Promise<ExtractedEvidence[]> {
  const client = new Anthropic()
  const windows = buildSectionWindows(text)
  const allEvidence: ExtractedEvidence[] = []
  const systemPrompt = sourcePerspective === 'third_party'
    ? THIRD_PARTY_EXTRACTION_SYSTEM_PROMPT
    : EXTRACTION_SYSTEM_PROMPT
  const userPrefix = sourcePerspective === 'third_party'
    ? 'Extract psychological evidence about the subject from this third-party interview:'
    : 'Extract psychological evidence from this content:'

  for (const window of windows) {
    const response = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 2048,
      system: systemPrompt,
      messages: [{
        role: 'user',
        content: `${userPrefix}\n\n${window}`,
      }],
    })
    const raw = response.content[0]?.type === 'text' ? response.content[0].text : ''
    allEvidence.push(...parseEvidenceResponse(raw))
  }

  // Deduplicate by (dimension_key, evidence_text) to avoid double-counting overlapping windows
  const seen = new Set<string>()
  return allEvidence.filter(e => {
    const key = `${e.dimension_key}::${e.evidence_text.slice(0, 80)}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

export async function extractEvidenceForSource(
  sourceId: string,
  portraitId: string,
  sourceType: string,
  triggeredBy: string = 'upload',
) {
  const admin = createAdminClient()
  const jobId = await createJob(portraitId, 'evidence_extraction', triggeredBy, sourceId)
  await updateJob(jobId, 'running')

  try {
    // Fetch source perspective so extraction prompt is correctly framed
    const { data: sourceRecord } = await (admin as any)
      .from('content_sources')
      .select('source_perspective')
      .eq('id', sourceId)
      .single()
    const sourcePerspective: string = sourceRecord?.source_perspective ?? 'first_person'

    // Get content text.
    // For third-party audio: use full transcript (all speakers — interviewee's observations are the evidence).
    // For first-person audio: use subject-only transcript (extractSubjectTranscript filters out interviewer).
    // For documents: use knowledge_chunks.
    let text = ''
    if (sourceType === 'interview_audio') {
      const { data: transcription } = await (admin as any)
        .from('sona_transcriptions')
        .select('transcript, transcript_with_speakers')
        .eq('source_id', sourceId)
        .single()

      if (sourcePerspective === 'third_party') {
        // Full transcript — everything the interviewee said is relevant
        text = transcription?.transcript ?? ''
      } else {
        // Subject-only transcript for first-person audio
        const { extractSubjectTranscript } = await import('@/lib/audio/transcribe')
        const segments = transcription?.transcript_with_speakers ?? []
        text = segments.length > 0
          ? extractSubjectTranscript(segments)
          : (transcription?.transcript ?? '')
      }
    } else {
      const { data: chunks } = await admin
        .from('knowledge_chunks')
        .select('content')
        .eq('source_id' as any, sourceId)
        .order('chunk_index' as any)
      text = chunks?.map((c: any) => c.content).join('\n\n') ?? ''
    }

    if (!text.trim()) {
      await updateJob(jobId, 'complete', { evidence_count: 0, reason: 'no text' })
      return
    }

    const evidence = await extractEvidenceFromText(text, sourceType, sourcePerspective)

    // Upsert evidence rows (conflict target: portrait_id + source_id + dimension_key)
    if (evidence.length > 0) {
      const rows = evidence.map(e => ({
        portrait_id: portraitId,
        source_id: sourceId,
        dimension_category: e.dimension_category,
        dimension_key: e.dimension_key,
        evidence_text: e.evidence_text,
        evidence_type: e.evidence_type,
        confidence: e.confidence,
      }))
      await (admin as any)
        .from('sona_evidence')
        .upsert(rows, { onConflict: 'portrait_id,source_id,dimension_key' })
    }

    await updateJob(jobId, 'complete', { evidence_count: evidence.length })

    // Check if automatic synthesis should be triggered (≥3 new extractions since last synthesis)
    const { data: portrait, error: portraitError } = await (admin as any)
      .from('portraits')
      .select('last_synthesised_at')
      .eq('id', portraitId)
      .single()

    if (!portraitError) {
      const sinceDate = portrait?.last_synthesised_at
        ? new Date(portrait.last_synthesised_at)
        : null
      const { countRecentExtractions } = await import('./jobs')
      const recentCount = await countRecentExtractions(portraitId, sinceDate)
      if (recentCount >= 3) {
        const { runFullSynthesis } = await import('./character-synthesise')
        await runFullSynthesis(portraitId, 'upload')
      }
    }
  } catch (err) {
    await updateJob(jobId, 'error', {}, err instanceof Error ? err.message : 'Failed')
  }
}
