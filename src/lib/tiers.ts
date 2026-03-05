// src/lib/tiers.ts
import type { Database } from '@/lib/supabase/types'

export type AccessTier = Database['public']['Enums']['access_tier']

export const TIER_LABELS: Record<AccessTier, string> = {
  public:       'Discovery',
  acquaintance: 'Perspective',
  colleague:    'Wisdom',
  family:       'Legacy',
}

export const TIER_ORDER: AccessTier[] = ['public', 'acquaintance', 'colleague', 'family']

/** All tiers a creator can assign to content. Derived from TIER_ORDER; override here if creator-assignable tiers ever diverge. */
export const CREATOR_TIERS: AccessTier[] = [...TIER_ORDER]
