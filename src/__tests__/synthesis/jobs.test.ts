// src/__tests__/synthesis/jobs.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'

// We test the pure logic functions only — Supabase calls are integration concerns
import { calculateRecencyWeight } from '@/lib/synthesis/jobs'

describe('calculateRecencyWeight', () => {
  it('returns 1.0 for content from this year', () => {
    const thisYear = new Date()
    expect(calculateRecencyWeight(thisYear)).toBeCloseTo(1.0, 1)
  })

  it('returns ~0.7 for content from 3 years ago', () => {
    const threeYearsAgo = new Date()
    threeYearsAgo.setFullYear(threeYearsAgo.getFullYear() - 3)
    const weight = calculateRecencyWeight(threeYearsAgo)
    expect(weight).toBeGreaterThan(0.6)
    expect(weight).toBeLessThan(0.8)
  })

  it('returns ~0.5 for content from 5+ years ago', () => {
    const fiveYearsAgo = new Date()
    fiveYearsAgo.setFullYear(fiveYearsAgo.getFullYear() - 5)
    const weight = calculateRecencyWeight(fiveYearsAgo)
    expect(weight).toBeGreaterThan(0.4)
    expect(weight).toBeLessThan(0.6)
  })

  it('uses today as fallback when date is null', () => {
    expect(calculateRecencyWeight(null)).toBeCloseTo(1.0, 1)
  })
})
