import { describe, it, expect } from 'vitest'
import { hasActiveSubscription } from '@/lib/subscriptions'

const mockSupabase = (row: object | null) => ({
  from: () => ({
    select: () => ({
      eq: () => ({
        eq: () => ({
          eq: () => ({
            maybeSingle: async () => ({ data: row }),
          }),
        }),
      }),
    }),
  }),
})

describe('hasActiveSubscription', () => {
  it('returns true when active subscription exists', async () => {
    expect(await hasActiveSubscription(mockSupabase({ id: 'sub-1' }) as any, 'u1', 'p1')).toBe(true)
  })

  it('returns false when no subscription exists', async () => {
    expect(await hasActiveSubscription(mockSupabase(null) as any, 'u1', 'p1')).toBe(false)
  })
})
