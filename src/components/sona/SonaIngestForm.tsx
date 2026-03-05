'use client'

import { useState } from 'react'
import { ingestContent } from '@/app/(nh)/admin/ingest/actions'

const GEIST = 'var(--font-geist-sans)'
const CORMORANT = 'var(--font-cormorant)'

const SOURCE_TYPES = [
  { value: 'transcript', label: 'Transcript' },
  { value: 'interview',  label: 'Interview' },
  { value: 'letter',     label: 'Letter' },
  { value: 'article',    label: 'Article' },
  { value: 'other',      label: 'Other' },
]

interface Props {
  portraitId: string
  portraitName: string
}

export function SonaIngestForm({ portraitId, portraitName }: Props) {
  const [result, setResult] = useState<{ success?: boolean; chunksCreated?: number; error?: string } | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(formData: FormData) {
    setLoading(true)
    setResult(null)
    const res = await ingestContent(formData)
    setResult(res)
    setLoading(false)
  }

  return (
    <form action={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 32 }}>
      {/* Hidden fields */}
      <input type="hidden" name="portrait_id" value={portraitId} />
      <input type="hidden" name="min_tier" value="public" />

      {/* Adding to label */}
      <p style={{
        fontFamily: GEIST,
        fontSize: '0.8125rem',
        fontWeight: 300,
        color: '#b0b0b0',
        margin: 0,
      }}>
        Adding content to{' '}
        <span style={{ fontFamily: CORMORANT, fontStyle: 'italic', fontWeight: 400, color: '#6b6b6b', fontSize: '0.9375rem' }}>
          {portraitName}
        </span>
      </p>

      {/* Source title */}
      <div>
        <label style={{
          fontFamily: GEIST,
          fontSize: '0.6875rem',
          fontWeight: 500,
          letterSpacing: '0.09em',
          textTransform: 'uppercase' as const,
          color: '#b0b0b0',
          display: 'block',
          marginBottom: 10,
        }}>
          Source title
        </label>
        <input
          name="source_title"
          placeholder="e.g. Interview with The Guardian, 2019"
          className="sona-input"
          style={{
            fontFamily: GEIST,
            fontSize: '0.9375rem',
            fontWeight: 300,
            color: '#1a1a1a',
            width: '100%',
            background: 'transparent',
            border: 'none',
            borderBottom: '1px solid rgba(0,0,0,0.15)',
            padding: '8px 0',
            outline: 'none',
            boxSizing: 'border-box' as const,
          }}
        />
      </div>

      {/* Source type */}
      <div>
        <label style={{
          fontFamily: GEIST,
          fontSize: '0.6875rem',
          fontWeight: 500,
          letterSpacing: '0.09em',
          textTransform: 'uppercase' as const,
          color: '#b0b0b0',
          display: 'block',
          marginBottom: 10,
        }}>
          Type
        </label>
        <select
          name="source_type"
          className="sona-input"
          style={{
            fontFamily: GEIST,
            fontSize: '0.9375rem',
            fontWeight: 300,
            color: '#1a1a1a',
            width: '100%',
            background: 'transparent',
            border: 'none',
            borderBottom: '1px solid rgba(0,0,0,0.15)',
            padding: '8px 0',
            outline: 'none',
            cursor: 'pointer',
            appearance: 'none' as const,
            WebkitAppearance: 'none' as const,
            backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='8' viewBox='0 0 12 8'%3E%3Cpath d='M1 1l5 5 5-5' stroke='%23b0b0b0' stroke-width='1.5' fill='none' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E")`,
            backgroundRepeat: 'no-repeat',
            backgroundPosition: 'right 4px center',
            paddingRight: 24,
            boxSizing: 'border-box' as const,
          }}
        >
          {SOURCE_TYPES.map(t => (
            <option key={t.value} value={t.value}>{t.label}</option>
          ))}
        </select>
      </div>

      {/* Content */}
      <div>
        <label style={{
          fontFamily: GEIST,
          fontSize: '0.6875rem',
          fontWeight: 500,
          letterSpacing: '0.09em',
          textTransform: 'uppercase' as const,
          color: '#b0b0b0',
          display: 'block',
          marginBottom: 10,
        }}>
          Content
        </label>
        <textarea
          name="content"
          required
          rows={12}
          placeholder="Paste a transcript, article, letter, or any text that represents your thinking…"
          style={{
            fontFamily: GEIST,
            fontSize: '0.9375rem',
            fontWeight: 300,
            color: '#1a1a1a',
            lineHeight: 1.7,
            width: '100%',
            background: '#fafafa',
            border: '1px solid rgba(0,0,0,0.08)',
            borderRadius: 12,
            padding: '14px 16px',
            outline: 'none',
            resize: 'vertical' as const,
            boxSizing: 'border-box' as const,
          }}
        />
      </div>

      {/* Error */}
      {result?.error && (
        <p style={{
          fontFamily: GEIST,
          fontSize: '0.8125rem',
          color: '#DE3E7B',
          margin: '-16px 0 0',
        }}>
          {result.error}
        </p>
      )}

      {/* Success */}
      {result?.success && (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          padding: '14px 18px',
          border: '1px solid rgba(0,0,0,0.08)',
          borderRadius: 12,
          marginTop: -16,
        }}>
          <span style={{
            width: 20,
            height: 20,
            borderRadius: '50%',
            backgroundColor: '#DE3E7B',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}>
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round">
              <path d="M5 13l4 4L19 7" />
            </svg>
          </span>
          <p style={{
            fontFamily: GEIST,
            fontSize: '0.875rem',
            fontWeight: 300,
            color: '#6b6b6b',
            margin: 0,
          }}>
            {result.chunksCreated} chunks added to your Sona.
          </p>
        </div>
      )}

      {/* Submit */}
      <div>
        <button
          type="submit"
          disabled={loading}
          className="sona-btn-dark"
          style={{
            fontFamily: GEIST,
            fontSize: '0.9375rem',
            fontWeight: 500,
            letterSpacing: '-0.01em',
            padding: '12px 32px',
            borderRadius: '980px',
            background: '#1a1a1a',
            color: '#fff',
            border: 'none',
            cursor: loading ? 'default' : 'pointer',
            opacity: loading ? 0.5 : 1,
          }}
        >
          {loading ? 'Processing…' : 'Add content'}
        </button>
      </div>

    </form>
  )
}
