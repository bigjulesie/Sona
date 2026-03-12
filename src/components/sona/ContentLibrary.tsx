// src/components/sona/ContentLibrary.tsx
'use client'

import { useState } from 'react'
import { TIER_LABELS } from '@/lib/tiers'
import { ContentAddForm } from './ContentAddForm'

const GEIST = 'var(--font-geist-sans)'
const CORMORANT = 'var(--font-cormorant)'

const TYPE_LABELS: Record<string, string> = {
  transcript: 'Transcript',
  interview:  'Interview',
  article:    'Article',
  book:       'Book',
  essay:      'Essay',
  speech:     'Speech',
  letter:     'Letter',
  other:      'Other',
}

const TIER_COLORS: Record<string, string> = {
  public:       'rgba(0,0,0,0.06)',
  acquaintance: 'rgba(222,62,123,0.08)',
  colleague:    'rgba(26,122,90,0.08)',
  family:       'rgba(180,120,20,0.08)',
}

const TIER_TEXT_COLORS: Record<string, string> = {
  public:       '#9b9b9b',
  acquaintance: '#DE3E7B',
  colleague:    '#1a7a5a',
  family:       '#b08850',
}

interface Source {
  id: string
  title: string
  source_type: string
  min_tier: string
  status: string
  created_at: string
}

interface Props {
  sources: Source[]
  portraitId: string
  portraitName: string
}

export function ContentLibrary({ sources, portraitId, portraitName }: Props) {
  const [showForm, setShowForm] = useState(false)

  function formatDate(iso: string) {
    const d = new Date(iso)
    return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' })
  }

  return (
    <div>
      {/* Add content button */}
      {!showForm && (
        <div style={{ marginBottom: 32 }}>
          <button
            onClick={() => setShowForm(true)}
            className="sona-btn-dark"
            style={{
              fontFamily: GEIST,
              fontSize: '0.875rem',
              fontWeight: 500,
              letterSpacing: '-0.01em',
              padding: '10px 24px',
              borderRadius: '980px',
              background: '#1a1a1a',
              color: '#fff',
              border: 'none',
              cursor: 'pointer',
            }}
          >
            + Add context
          </button>
        </div>
      )}

      {/* Add form */}
      {showForm && (
        <div style={{
          border: '1px solid rgba(0,0,0,0.08)',
          borderRadius: 18,
          padding: '28px 28px',
          marginBottom: 32,
          backgroundColor: '#fafafa',
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
            <p style={{ fontFamily: GEIST, fontSize: '0.875rem', fontWeight: 500, color: '#1a1a1a', margin: 0 }}>
              Add context
            </p>
            <button
              onClick={() => setShowForm(false)}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#b0b0b0', fontSize: '1.25rem', lineHeight: 1, padding: 0 }}
            >
              ×
            </button>
          </div>
          <ContentAddForm
            portraitId={portraitId}
            portraitName={portraitName}
            onSuccess={() => setShowForm(false)}
          />
        </div>
      )}

      {/* Empty state */}
      {sources.length === 0 && !showForm && (
        <div style={{
          border: '1px solid rgba(0,0,0,0.07)',
          borderRadius: 14,
          padding: '36px 28px',
          textAlign: 'center',
        }}>
          <p style={{ fontFamily: CORMORANT, fontSize: '1.375rem', fontWeight: 400, fontStyle: 'italic', color: '#1a1a1a', margin: '0 0 8px', lineHeight: 1.3 }}>
            No context yet.
          </p>
          <p style={{ fontFamily: GEIST, fontSize: '0.8125rem', fontWeight: 300, color: '#9b9b9b', margin: 0, lineHeight: 1.6 }}>
            Your WhatsApp interview is the primary source. Add documents to enrich your Sona further.
          </p>
        </div>
      )}

      {/* Source list */}
      {sources.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {sources.map(source => (
            <div
              key={source.id}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                padding: '14px 16px',
                borderRadius: 12,
                border: '1px solid rgba(0,0,0,0.06)',
                backgroundColor: '#fff',
              }}
            >
              {/* Title + type */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{
                  fontFamily: GEIST,
                  fontSize: '0.875rem',
                  fontWeight: 400,
                  color: '#1a1a1a',
                  margin: '0 0 2px',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}>
                  {source.title}
                </p>
                <p style={{ fontFamily: GEIST, fontSize: '0.75rem', fontWeight: 300, color: '#b0b0b0', margin: 0 }}>
                  {TYPE_LABELS[source.source_type] ?? source.source_type} · {formatDate(source.created_at)}
                </p>
              </div>

              {/* Tier badge */}
              <span style={{
                fontFamily: GEIST,
                fontSize: '0.6875rem',
                fontWeight: 500,
                letterSpacing: '0.04em',
                padding: '3px 10px',
                borderRadius: '980px',
                backgroundColor: TIER_COLORS[source.min_tier] ?? 'rgba(0,0,0,0.06)',
                color: TIER_TEXT_COLORS[source.min_tier] ?? '#9b9b9b',
                flexShrink: 0,
              }}>
                {TIER_LABELS[source.min_tier as keyof typeof TIER_LABELS] ?? source.min_tier}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
