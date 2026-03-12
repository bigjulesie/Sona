// src/components/sona/MindCharacterTab.tsx
'use client'

import { TIER_LABELS } from '@/lib/tiers'

interface DimensionRow {
  dimension_key: string
  narrative: string
  confidence: number
  confidence_flag: string | null
  min_tier: string
  evidence_count: number
}

interface Props {
  grouped: Record<string, DimensionRow[]>
}

const GEIST = 'var(--font-geist-sans)'
const CORMORANT = 'var(--font-cormorant)'

export function MindCharacterTab({ grouped }: Props) {
  if (Object.keys(grouped).length === 0) {
    return (
      <p style={{ fontFamily: GEIST, fontSize: '0.875rem', color: '#6b6b6b', textAlign: 'center', padding: '3rem 0' }}>
        No character profile yet. Add content and deepen your Sona.
      </p>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2.5rem' }}>
      {Object.entries(grouped).map(([category, dims]) => (
        <section key={category}>
          <p style={{
            fontFamily: GEIST,
            fontSize: '0.6875rem',
            fontWeight: 500,
            letterSpacing: '0.09em',
            textTransform: 'uppercase',
            color: '#b0b0b0',
            marginBottom: '1rem',
          }}>
            {category}
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            {dims.map(dim => (
              <div key={dim.dimension_key} className="sona-card" style={{
                padding: '1.25rem 1.5rem',
                borderRadius: 12,
                border: '1px solid rgba(0,0,0,0.07)',
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.5rem' }}>
                  <span style={{ fontFamily: GEIST, fontSize: '0.875rem', fontWeight: 500, color: '#1a1a1a' }}>
                    {dim.dimension_key.replace(/_/g, ' ')}
                  </span>
                  <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                    {dim.confidence_flag && (
                      <span style={{
                        fontFamily: GEIST,
                        fontSize: '0.6875rem',
                        color: '#b0b0b0',
                        border: '1px solid rgba(0,0,0,0.1)',
                        borderRadius: 6,
                        padding: '2px 8px',
                      }}>
                        {dim.confidence_flag === 'LOW_CONFIDENCE' ? 'Needs more content' : 'Complex'}
                      </span>
                    )}
                    <span style={{
                      fontFamily: GEIST,
                      fontSize: '0.6875rem',
                      color: '#6b6b6b',
                      border: '1px solid rgba(0,0,0,0.1)',
                      borderRadius: 6,
                      padding: '2px 8px',
                    }}>
                      {TIER_LABELS[dim.min_tier as keyof typeof TIER_LABELS] ?? dim.min_tier}
                    </span>
                  </div>
                </div>
                {dim.narrative && (
                  <p style={{ fontFamily: CORMORANT, fontStyle: 'italic', fontSize: '1rem', color: '#1a1a1a', lineHeight: 1.6, margin: 0 }}>
                    {dim.narrative}
                  </p>
                )}
                {dim.confidence_flag === 'LOW_CONFIDENCE' && (
                  <p style={{ fontFamily: GEIST, fontSize: '0.75rem', color: '#b0b0b0', marginTop: '0.5rem' }}>
                    More content in this area would improve accuracy.
                  </p>
                )}
              </div>
            ))}
          </div>
        </section>
      ))}
    </div>
  )
}
