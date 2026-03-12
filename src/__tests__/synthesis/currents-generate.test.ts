// src/__tests__/synthesis/currents-generate.test.ts
import { describe, it, expect } from 'vitest'
import { identifyRelevantModuleTypes, CANDIDATE_MODULE_TYPES } from '@/lib/synthesis/currents-generate'

describe('identifyRelevantModuleTypes', () => {
  it('returns module types where sufficient evidence exists in relevant dimensions', () => {
    const dimensions = [
      { dimension_key: 'achievement', dimension_category: 'values', confidence: 0.8, evidence_count: 5 },
      { dimension_key: 'risk_orientation', dimension_category: 'cognitive', confidence: 0.7, evidence_count: 4 },
      { dimension_key: 'conscientiousness', dimension_category: 'personality', confidence: 0.9, evidence_count: 6 },
    ]
    const types = identifyRelevantModuleTypes(dimensions)
    expect(types).toContain('business_strategy')
    expect(types).toContain('decision_making')
  })

  it('excludes module types where evidence is insufficient', () => {
    const dimensions = [
      { dimension_key: 'benevolence', dimension_category: 'values', confidence: 0.3, evidence_count: 1 },
    ]
    const types = identifyRelevantModuleTypes(dimensions)
    // Low confidence + low count should not qualify
    expect(types.length).toBe(0)
  })

  it('CANDIDATE_MODULE_TYPES contains core types', () => {
    expect(CANDIDATE_MODULE_TYPES).toContain('business_strategy')
    expect(CANDIDATE_MODULE_TYPES).toContain('personal_philosophy')
    expect(CANDIDATE_MODULE_TYPES).toContain('decision_making')
  })
})
