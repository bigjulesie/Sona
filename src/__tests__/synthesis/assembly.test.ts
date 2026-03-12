// src/__tests__/synthesis/assembly.test.ts
import { describe, it, expect } from 'vitest'
import { resolveSubscriberTier, buildAssembledPrompt } from '@/lib/synthesis/assembly'

describe('resolveSubscriberTier', () => {
  it('returns public when no subscription', () => {
    expect(resolveSubscriberTier(null)).toBe('public')
  })

  it('returns the tier from an active subscription', () => {
    expect(resolveSubscriberTier({ tier: 'colleague', status: 'active' })).toBe('colleague')
  })

  it('returns public for non-active subscription', () => {
    expect(resolveSubscriberTier({ tier: 'acquaintance', status: 'cancelled' })).toBe('public')
  })
})

describe('buildAssembledPrompt', () => {
  it('includes identity prompt and RAG chunks', () => {
    const prompt = buildAssembledPrompt({
      identityPrompt: 'You are Jane.',
      selectedCurrents: [],
      ragContext: 'Some knowledge here.',
      displayName: 'Jane',
    })
    expect(prompt).toContain('You are Jane.')
    expect(prompt).toContain('Some knowledge here.')
  })

  it('includes current prompt_content and NLP notes when current is provided', () => {
    const prompt = buildAssembledPrompt({
      identityPrompt: 'You are Jane.',
      selectedCurrents: [{
        prompt_content: 'When discussing strategy, you think boldly.',
        nlp_delivery_notes: 'Use visual predicates.',
      }],
      ragContext: 'Knowledge.',
      displayName: 'Jane',
    })
    expect(prompt).toContain('When discussing strategy')
    expect(prompt).toContain('Use visual predicates.')
  })

  it('does not include current section when no currents selected', () => {
    const prompt = buildAssembledPrompt({
      identityPrompt: 'You are Jane.',
      selectedCurrents: [],
      ragContext: '',
      displayName: 'Jane',
    })
    expect(prompt).not.toContain('undefined')
    expect(prompt).not.toContain('null')
  })
})
