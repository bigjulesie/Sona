// src/__tests__/synthesis/evidence-extract.test.ts
import { describe, it, expect, vi } from 'vitest'
import { parseEvidenceResponse, buildSectionWindows } from '@/lib/synthesis/evidence-extract'

describe('buildSectionWindows', () => {
  it('returns the full text as one window when under 4000 chars', () => {
    const text = 'Short text about something'
    const windows = buildSectionWindows(text)
    expect(windows).toHaveLength(1)
    expect(windows[0]).toBe(text)
  })

  it('splits long text into overlapping windows of ~4000 chars', () => {
    const text = 'word '.repeat(1000) // ~5000 chars
    const windows = buildSectionWindows(text)
    expect(windows.length).toBeGreaterThan(1)
    windows.forEach(w => expect(w.length).toBeLessThanOrEqual(4200))
  })
})

describe('parseEvidenceResponse', () => {
  it('parses valid JSON array of evidence items', () => {
    const raw = JSON.stringify([
      {
        dimension_category: 'personality',
        dimension_key: 'openness',
        evidence_text: 'I love exploring new ideas',
        evidence_type: 'direct_quote',
        confidence: 0.9,
      },
      {
        dimension_category: 'nlp_patterns',
        dimension_key: 'primary_rep_system',
        evidence_text: 'I see the picture clearly',
        evidence_type: 'behavioural_pattern',
        confidence: 0.7,
      },
    ])
    const result = parseEvidenceResponse(raw)
    expect(result).toHaveLength(2)
    expect(result[0].dimension_category).toBe('personality')
    expect(result[1].dimension_key).toBe('primary_rep_system')
  })

  it('handles JSON wrapped in markdown code block', () => {
    const raw = '```json\n[{"dimension_category":"values","dimension_key":"benevolence","evidence_text":"I care deeply","evidence_type":"stated_belief","confidence":0.8}]\n```'
    const result = parseEvidenceResponse(raw)
    expect(result).toHaveLength(1)
    expect(result[0].dimension_key).toBe('benevolence')
  })

  it('returns empty array on unparseable response', () => {
    expect(parseEvidenceResponse('not json')).toEqual([])
  })

  it('filters out items missing required fields', () => {
    const raw = JSON.stringify([
      { dimension_key: 'openness', evidence_text: 'text', evidence_type: 'direct_quote', confidence: 0.9 },
      { dimension_category: 'personality', dimension_key: 'conscientiousness', evidence_text: 'text', evidence_type: 'direct_quote', confidence: 0.8 },
    ])
    const result = parseEvidenceResponse(raw)
    expect(result).toHaveLength(1) // First item missing dimension_category
  })
})
