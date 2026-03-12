// src/__tests__/synthesis/character-synthesise.test.ts
import { describe, it, expect } from 'vitest'
import { computeWeightedConfidence, groupEvidenceByDimension } from '@/lib/synthesis/character-synthesise'

describe('computeWeightedConfidence', () => {
  it('weights direct_quote higher than inferred', () => {
    const quoteWeight = computeWeightedConfidence({
      raw_confidence: 0.9,
      evidence_type: 'direct_quote',
      source_type: 'interview',
      source_date: new Date(),
    })
    const inferredWeight = computeWeightedConfidence({
      raw_confidence: 0.9,
      evidence_type: 'inferred',
      source_type: 'interview',
      source_date: new Date(),
    })
    expect(quoteWeight).toBeGreaterThan(inferredWeight)
  })

  it('weights interview_audio source higher than social_media', () => {
    const audioWeight = computeWeightedConfidence({
      raw_confidence: 0.8,
      evidence_type: 'stated_belief',
      source_type: 'interview_audio',
      source_date: new Date(),
    })
    const socialWeight = computeWeightedConfidence({
      raw_confidence: 0.8,
      evidence_type: 'stated_belief',
      source_type: 'social_media',
      source_date: new Date(),
    })
    expect(audioWeight).toBeGreaterThan(socialWeight)
  })
})

describe('groupEvidenceByDimension', () => {
  it('groups evidence rows by dimension_key', () => {
    const rows = [
      { dimension_key: 'openness', dimension_category: 'personality', evidence_text: 'A', evidence_type: 'direct_quote', confidence: 0.9, source_type: 'article', source_date: null },
      { dimension_key: 'openness', dimension_category: 'personality', evidence_text: 'B', evidence_type: 'inferred', confidence: 0.5, source_type: 'article', source_date: null },
      { dimension_key: 'benevolence', dimension_category: 'values', evidence_text: 'C', evidence_type: 'stated_belief', confidence: 0.8, source_type: 'interview', source_date: null },
    ]
    const grouped = groupEvidenceByDimension(rows)
    expect(Object.keys(grouped)).toHaveLength(2)
    expect(grouped['openness']).toHaveLength(2)
    expect(grouped['benevolence']).toHaveLength(1)
  })
})
