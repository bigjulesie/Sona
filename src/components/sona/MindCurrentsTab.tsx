// src/components/sona/MindCurrentsTab.tsx
'use client'

import { TIER_LABELS } from '@/lib/tiers'

interface CurrentRow {
  module_type: string
  title: string
  activation_keywords: string[]
  min_tier: string
  confidence: number
}

export function MindCurrentsTab({ currents }: { currents: CurrentRow[] }) {
  if (currents.length === 0) {
    return (
      <p style={{ fontFamily: 'var(--font-geist-sans)', fontSize: '0.875rem', color: '#6b6b6b', textAlign: 'center', padding: '3rem 0' }}>
        No currents generated yet. Deepen your Sona to build them.
      </p>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      {currents.map((c, i) => (
        <div key={`${c.module_type}-${i}`} className="sona-card" style={{
          padding: '1.25rem 1.5rem',
          borderRadius: 12,
          border: '1px solid rgba(0,0,0,0.07)',
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
            <span style={{ fontFamily: 'var(--font-geist-sans)', fontSize: '0.9375rem', fontWeight: 500, color: '#1a1a1a' }}>
              {c.title}
            </span>
            <span style={{
              fontFamily: 'var(--font-geist-sans)',
              fontSize: '0.6875rem',
              color: '#6b6b6b',
              border: '1px solid rgba(0,0,0,0.1)',
              borderRadius: 6,
              padding: '2px 8px',
            }}>
              {TIER_LABELS[c.min_tier as keyof typeof TIER_LABELS] ?? c.min_tier}
            </span>
          </div>
          <p style={{ fontFamily: 'var(--font-geist-sans)', fontSize: '0.75rem', color: '#6b6b6b', margin: 0 }}>
            {c.activation_keywords.slice(0, 6).join(' · ')}
          </p>
        </div>
      ))}
    </div>
  )
}
