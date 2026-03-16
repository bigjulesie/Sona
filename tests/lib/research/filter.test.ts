import { describe, it, expect } from 'vitest'
import { parseFilterResponse, meetsThresholds } from '@/lib/research/filter'

describe('parseFilterResponse', () => {
  it('parses a valid JSON response', () => {
    const raw = JSON.stringify({ identity_match: 0.9, relevance: 0.8, reason: 'Direct mention' })
    const result = parseFilterResponse(raw)
    expect(result).toEqual({ identity_match: 0.9, relevance: 0.8, reason: 'Direct mention' })
  })

  it('parses JSON wrapped in markdown code fence', () => {
    const raw = '```json\n{"identity_match":0.5,"relevance":0.6,"reason":"Possible"}\n```'
    const result = parseFilterResponse(raw)
    expect(result?.identity_match).toBe(0.5)
  })

  it('returns null for invalid JSON', () => {
    const result = parseFilterResponse('not json at all')
    expect(result).toBeNull()
  })
})

describe('meetsThresholds', () => {
  it('passes when both thresholds are met', () => {
    expect(meetsThresholds({ identity_match: 0.8, relevance: 0.6, reason: '' })).toBe(true)
  })

  it('fails when identity_match is below 0.7', () => {
    expect(meetsThresholds({ identity_match: 0.6, relevance: 0.8, reason: '' })).toBe(false)
  })

  it('fails when relevance is below 0.5', () => {
    expect(meetsThresholds({ identity_match: 0.9, relevance: 0.4, reason: '' })).toBe(false)
  })
})
