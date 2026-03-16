import { describe, it, expect } from 'vitest'
import { buildSearchStrategies, deduplicateResults } from '@/lib/research/search'

describe('buildSearchStrategies', () => {
  it('builds 8 search strategies with no optional URLs', () => {
    const strategies = buildSearchStrategies('Ada Lovelace', null, null, null)
    expect(strategies).toHaveLength(8)
    expect(strategies.every(s => !s.directUrl)).toBe(true)
  })

  it('includes name in all queries', () => {
    const strategies = buildSearchStrategies('Ada Lovelace', null, null, null)
    strategies.filter(s => !s.directUrl).forEach(s => {
      expect(s.query).toContain('"Ada Lovelace"')
    })
  })

  it('includes context in queries when provided', () => {
    const strategies = buildSearchStrategies('Ada Lovelace', 'mathematician', null, null)
    expect(strategies[0].query).toContain('mathematician')
  })

  it('adds a direct-fetch strategy for websiteUrl when provided', () => {
    const strategies = buildSearchStrategies('Ada Lovelace', null, 'https://ada.example.com', null)
    const websiteStrategy = strategies.find(s => s.directUrl === 'https://ada.example.com')
    expect(websiteStrategy).toBeDefined()
    expect(strategies).toHaveLength(9)
  })

  it('adds a direct-fetch strategy for linkedinUrl when provided', () => {
    const strategies = buildSearchStrategies('Ada Lovelace', null, null, 'https://linkedin.com/in/ada')
    const linkedinStrategy = strategies.find(s => s.directUrl === 'https://linkedin.com/in/ada')
    expect(linkedinStrategy).toBeDefined()
    expect(strategies).toHaveLength(9)
  })

  it('adds both direct-fetch strategies when both URLs provided', () => {
    const strategies = buildSearchStrategies('Ada Lovelace', null, 'https://ada.com', 'https://linkedin.com/in/ada')
    expect(strategies).toHaveLength(10)
  })
})

describe('deduplicateResults', () => {
  it('removes duplicate URLs, keeping first occurrence', () => {
    const results = [
      { url: 'https://a.com', title: 'A', content: 'a' },
      { url: 'https://b.com', title: 'B', content: 'b' },
      { url: 'https://a.com', title: 'A again', content: 'a2' },
    ]
    const deduped = deduplicateResults(results)
    expect(deduped).toHaveLength(2)
    expect(deduped[0].title).toBe('A')
  })
})
