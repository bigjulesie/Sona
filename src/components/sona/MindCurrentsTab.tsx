// src/components/sona/MindCurrentsTab.tsx
'use client'

import { TIER_LABELS } from '@/lib/tiers'

const GEIST = 'var(--font-geist-sans)'
const CORMORANT = 'var(--font-cormorant)'

// Human-readable labels for module types
const MODULE_TYPE_LABELS: Record<string, string> = {
  communication_style:    'How you communicate',
  values_beliefs:         'What you stand for',
  emotional_register:     'How you carry emotion',
  problem_framing:        'How you approach problems',
  recurring_themes:       'What you keep coming back to',
  decision_making:        'How you make decisions',
  relationship_style:     'How you relate to others',
  humour_tone:            'Your sense of humour',
  intellectual_interests: 'What you find fascinating',
  conflict_response:      'How you handle tension',
  storytelling:           'How you tell stories',
  vocabulary_patterns:    'The language you reach for',
}

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
      <div style={{ padding: '3rem 0 2rem', maxWidth: 480 }}>
        <p style={{
          fontFamily: CORMORANT,
          fontSize: 'clamp(1.1rem, 2vw, 1.3rem)',
          fontStyle: 'italic',
          fontWeight: 400,
          letterSpacing: '-0.01em',
          color: '#1a1a1a',
          margin: '0 0 1rem',
          lineHeight: 1.4,
        }}>
          Nothing here yet — your Sona is still building a picture of you.
        </p>
        <p style={{ fontFamily: GEIST, fontSize: '0.875rem', color: '#6b6b6b', margin: '0 0 1.25rem', lineHeight: 1.7 }}>
          Keep adding to Context and your depth will grow.
        </p>
        <a
          href="/dashboard/content"
          style={{
            fontFamily: GEIST,
            fontSize: '0.8125rem',
            color: '#6b6b6b',
            textDecoration: 'underline',
          }}
        >
          Add more to Context →
        </a>
      </div>
    )
  }

  return (
    <div>
      {/* Explanatory header */}
      <p style={{
        fontFamily: GEIST,
        fontSize: '0.875rem',
        color: '#6b6b6b',
        margin: '0 0 2rem',
        lineHeight: 1.7,
        maxWidth: 560,
      }}>
        These are the recurring patterns in how you think, communicate, and engage — captured from everything you've shared. Your subscribers won't see them, but they'll feel them in every conversation.
      </p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        {currents.map((c, i) => (
          <div key={`${c.module_type}-${i}`} className="sona-card" style={{
            padding: '1.25rem 1.5rem',
            borderRadius: 12,
            border: '1px solid rgba(0,0,0,0.07)',
          }}>
            {/* Module type label */}
            {MODULE_TYPE_LABELS[c.module_type] && (
              <p style={{
                fontFamily: GEIST,
                fontSize: '0.6875rem',
                fontWeight: 500,
                color: '#b0b0b0',
                letterSpacing: '0.09em',
                textTransform: 'uppercase',
                margin: '0 0 0.375rem',
              }}>
                {MODULE_TYPE_LABELS[c.module_type]}
              </p>
            )}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.5rem', gap: '1rem' }}>
              <span style={{ fontFamily: GEIST, fontSize: '0.9375rem', fontWeight: 500, color: '#1a1a1a' }}>
                {c.title}
              </span>
              <span style={{
                fontFamily: GEIST,
                fontSize: '0.6875rem',
                color: '#6b6b6b',
                border: '1px solid rgba(0,0,0,0.1)',
                borderRadius: 6,
                padding: '2px 8px',
                flexShrink: 0,
              }}>
                {TIER_LABELS[c.min_tier as keyof typeof TIER_LABELS] ?? c.min_tier}
              </span>
            </div>
            {c.activation_keywords.length > 0 && (
              <p style={{ fontFamily: GEIST, fontSize: '0.75rem', color: '#6b6b6b', margin: 0 }}>
                {c.activation_keywords.slice(0, 6).join(' · ')}
              </p>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
