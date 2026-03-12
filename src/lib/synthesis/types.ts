// src/lib/synthesis/types.ts
export type DimensionCategory =
  | 'personality'
  | 'values'
  | 'communication'
  | 'cognitive'
  | 'nlp_patterns'
  | 'expertise'
  | 'beliefs'

export type EvidenceType =
  | 'direct_quote'
  | 'stated_belief'
  | 'behavioural_pattern'
  | 'inferred'

export type ConfidenceFlag = 'LOW_CONFIDENCE' | 'AMBIGUOUS' | null

export interface ExtractedEvidence {
  dimension_category: DimensionCategory
  dimension_key: string
  evidence_text: string
  evidence_type: EvidenceType
  confidence: number
}

export interface WeightedEvidence {
  dimension_category: DimensionCategory
  dimension_key: string
  evidence_text: string
  evidence_type: EvidenceType
  raw_confidence: number
  weighted_confidence: number
  source_type: string
  source_date: Date | null
}

export interface SynthesisedDimension {
  dimension_category: DimensionCategory
  dimension_key: string
  score: number
  confidence: number
  confidence_flag: ConfidenceFlag
  narrative: string
  evidence_count: number
}

export interface GeneratedCurrent {
  module_type: string
  title: string
  prompt_content: string
  activation_keywords: string[]
  nlp_delivery_notes: string
  confidence: number
}

export type SynthesisJobType =
  | 'evidence_extraction'
  | 'dimension_synthesis'
  | 'module_generation'

export type SynthesisJobStatus = 'pending' | 'running' | 'complete' | 'error'

// Tier → identity prompt depth
export const TIER_PROMPT_DEPTH: Record<string, string> = {
  public: 'Surface communication style and public expertise domains only.',
  acquaintance: 'Include Big Five personality traits, core values, and primary NLP communication patterns.',
  colleague: 'Include cognitive patterns, belief structures, meta-programs, and relationship approach.',
  family: 'Full depth: all character dimensions, complete NLP profile, personal philosophy, and emotional intelligence patterns.',
}

// Dimension categories → user-facing group labels
export const DIMENSION_CATEGORY_LABELS: Record<DimensionCategory, string> = {
  personality: 'Personality',
  values: 'Values',
  communication: 'Communication Style',
  cognitive: 'Cognitive Patterns',
  nlp_patterns: 'Thinking Style',
  expertise: 'Expertise',
  beliefs: 'Beliefs',
}

// Minimum tier required to access each dimension category
export const DIMENSION_MIN_TIER: Record<DimensionCategory, string> = {
  personality: 'acquaintance',
  values: 'acquaintance',
  communication: 'public',
  cognitive: 'colleague',
  nlp_patterns: 'acquaintance',
  expertise: 'public',
  beliefs: 'colleague',
}
