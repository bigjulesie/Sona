'use client'

import { useState } from 'react'
import Link from 'next/link'
import { togglePortraitPublished } from './actions'

const GEIST = 'var(--font-geist-sans)'
const CORMORANT = 'var(--font-cormorant)'

interface PortraitData {
  id: string
  display_name: string
  creator_email: string
  is_public: boolean
  synthesis_status: string | null
  web_research_status: string
  last_synthesised_at: string | null
  created_at: string
  content_count: number
  evidence_count: number
  subscriber_count: number
  has_interview: boolean
}

interface Props {
  portraits: PortraitData[]
}

function StatusBadge({ status }: { status: string | null }) {
  const label = status ?? 'never'
  const colors: Record<string, { bg: string; color: string }> = {
    ready:       { bg: 'rgba(42,124,79,0.08)',   color: '#2a7c4f' },
    complete:    { bg: 'rgba(42,124,79,0.08)',   color: '#2a7c4f' },
    processing:  { bg: 'rgba(180,120,20,0.08)',  color: '#b08850' },
    synthesising:{ bg: 'rgba(180,120,20,0.08)',  color: '#b08850' },
    running:     { bg: 'rgba(100,100,220,0.08)', color: '#5555cc' },
    pending:     { bg: 'rgba(180,120,20,0.08)',  color: '#b08850' },
    error:       { bg: 'rgba(222,62,123,0.08)',  color: '#DE3E7B' },
    never:       { bg: 'rgba(0,0,0,0.04)',        color: '#c0c0c0' },
  }
  const c = colors[label] ?? colors.never
  return (
    <span style={{
      fontFamily: GEIST,
      fontSize: '0.6875rem',
      fontWeight: 500,
      letterSpacing: '0.04em',
      padding: '3px 10px',
      borderRadius: '980px',
      backgroundColor: c.bg,
      color: c.color,
    }}>
      {label}
    </span>
  )
}

function PortraitTableRow({ portrait }: { portrait: PortraitData }) {
  const [isPublic, setIsPublic] = useState(portrait.is_public)
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  async function handleToggle() {
    const next = !isPublic
    setIsPublic(next)
    setError(null)
    setPending(true)
    try {
      await togglePortraitPublished(portrait.id, next)
    } catch {
      setIsPublic(!next) // rollback
      setError('Failed to update')
    } finally {
      setPending(false)
    }
  }

  function formatDate(iso: string) {
    return new Date(iso).toLocaleDateString('en-GB', {
      day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC',
    })
  }

  return (
    <tr
      className="sona-row-hover"
      style={{ borderTop: '1px solid rgba(0,0,0,0.05)' }}
    >
      {/* Portrait name */}
      <td style={{ padding: '14px 16px' }}>
        <p style={{ fontFamily: CORMORANT, fontSize: '1rem', fontStyle: 'italic', fontWeight: 400, color: '#1a1a1a', margin: 0 }}>
          {portrait.display_name}
        </p>
        <p style={{ fontFamily: GEIST, fontSize: '0.75rem', fontWeight: 300, color: '#b0b0b0', margin: '2px 0 0' }}>
          {portrait.creator_email}
        </p>
      </td>

      {/* Interview */}
      <td style={{ padding: '14px 16px' }}>
        <span style={{ fontFamily: GEIST, fontSize: '0.8125rem', color: portrait.has_interview ? '#1a1a1a' : '#c0c0c0' }}>
          {portrait.has_interview ? 'Requested' : '—'}
        </span>
      </td>

      {/* Content */}
      <td style={{ padding: '14px 16px' }}>
        <span style={{ fontFamily: GEIST, fontSize: '0.8125rem', color: '#6b6b6b' }}>
          {portrait.content_count} source{portrait.content_count !== 1 ? 's' : ''}
        </span>
        {portrait.web_research_status !== 'never' && (
          <div style={{ marginTop: 4 }}>
            <StatusBadge status={portrait.web_research_status} />
          </div>
        )}
      </td>

      {/* Synthesis */}
      <td style={{ padding: '14px 16px' }}>
        <StatusBadge status={portrait.synthesis_status} />
        {portrait.evidence_count > 0 && (
          <div style={{ marginTop: 4, fontFamily: GEIST, fontSize: '0.6875rem', color: '#b0b0b0' }}>
            {portrait.evidence_count} evidence
          </div>
        )}
        {portrait.last_synthesised_at && (
          <div style={{ marginTop: 2, fontFamily: GEIST, fontSize: '0.6875rem', color: '#c0c0c0' }}>
            {formatDate(portrait.last_synthesised_at)}
          </div>
        )}
      </td>

      {/* Subscribers */}
      <td style={{ padding: '14px 16px', fontFamily: GEIST, fontSize: '0.8125rem', color: '#6b6b6b' }}>
        {portrait.subscriber_count}
      </td>

      {/* Joined */}
      <td style={{ padding: '14px 16px', fontFamily: GEIST, fontSize: '0.75rem', fontWeight: 300, color: '#b0b0b0', whiteSpace: 'nowrap' }}>
        {formatDate(portrait.created_at)}
      </td>

      {/* Publish toggle + upload interview */}
      <td style={{ padding: '14px 16px' }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 6 }}>
          <button
            onClick={handleToggle}
            disabled={pending}
            style={{
              fontFamily: GEIST,
              fontSize: '0.6875rem',
              fontWeight: 500,
              letterSpacing: '0.04em',
              padding: '4px 12px',
              borderRadius: '980px',
              border: '1px solid',
              borderColor: isPublic ? 'rgba(42,124,79,0.3)' : 'rgba(0,0,0,0.15)',
              background: isPublic ? 'rgba(42,124,79,0.08)' : 'transparent',
              color: isPublic ? '#2a7c4f' : '#6b6b6b',
              cursor: pending ? 'default' : 'pointer',
              opacity: pending ? 0.5 : 1,
            }}
          >
            {isPublic ? 'Live' : 'Draft'}
          </button>
          <Link
            href={`/sona-admin/${portrait.id}/upload`}
            style={{
              fontFamily: GEIST,
              fontSize: '0.6875rem',
              fontWeight: 400,
              color: '#DE3E7B',
              textDecoration: 'none',
              whiteSpace: 'nowrap',
            }}
          >
            + Upload interview
          </Link>
          {error && (
            <span style={{ fontFamily: GEIST, fontSize: '0.6875rem', color: '#DE3E7B' }}>{error}</span>
          )}
        </div>
      </td>
    </tr>
  )
}

export function PortraitsTable({ portraits }: Props) {
  if (portraits.length === 0) {
    return (
      <div style={{ padding: '48px 0', textAlign: 'center' }}>
        <p style={{ fontFamily: CORMORANT, fontSize: '1.375rem', fontStyle: 'italic', color: '#1a1a1a', margin: 0 }}>
          No portraits yet.
        </p>
      </div>
    )
  }

  const thStyle = {
    fontFamily: GEIST,
    fontSize: '0.6875rem',
    fontWeight: 500,
    letterSpacing: '0.09em',
    textTransform: 'uppercase' as const,
    color: '#b0b0b0',
    padding: '10px 16px',
    textAlign: 'left' as const,
    borderBottom: '1px solid rgba(0,0,0,0.07)',
    whiteSpace: 'nowrap' as const,
  }

  return (
    <div style={{ border: '1px solid rgba(0,0,0,0.07)', borderRadius: 14, overflow: 'hidden' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr>
            {['Portrait', 'Interview', 'Context', 'Synthesis', 'Subscribers', 'Joined', 'Status'].map(h => (
              <th key={h} style={thStyle}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {portraits.map(p => <PortraitTableRow key={p.id} portrait={p} />)}
        </tbody>
      </table>
    </div>
  )
}
