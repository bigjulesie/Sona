'use client'

import { useState } from 'react'

const GEIST = 'var(--font-geist-sans)'
const CORMORANT = 'var(--font-cormorant)'

export function InterviewStep({ portraitId, returnHref }: { portraitId: string; returnHref?: string }) {
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    const fd = new FormData(e.currentTarget)
    try {
      const res = await fetch('/api/interview-requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          portrait_id: portraitId,
          whatsapp_number: fd.get('whatsapp_number'),
          notes: fd.get('notes'),
        }),
      })
      if (!res.ok) {
        setError('Something went wrong. Please try again.')
        return
      }
      setDone(true)
    } catch {
      setError('Something went wrong. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const continueHref = returnHref ?? `/dashboard/create?step=4&portrait_id=${portraitId}`

  if (done) {
    return (
      <div style={{ textAlign: 'center', padding: '24px 0' }}>
        {/* Coral check */}
        <div style={{
          width: 52,
          height: 52,
          borderRadius: '50%',
          backgroundColor: '#DE3E7B',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          margin: '0 auto 20px',
        }}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
            <path d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <p style={{
          fontFamily: CORMORANT,
          fontSize: '1.5rem',
          fontWeight: 400,
          fontStyle: 'italic',
          color: '#1a1a1a',
          margin: '0 0 8px',
          lineHeight: 1.3,
        }}>
          Interview requested.
        </p>
        <p style={{
          fontFamily: GEIST,
          fontSize: '0.875rem',
          fontWeight: 300,
          color: '#6b6b6b',
          margin: '0 0 28px',
        }}>
          We'll be in touch via WhatsApp to schedule a time.
        </p>
        <a
          href={continueHref}
          className="sona-btn-dark"
          style={{
            fontFamily: GEIST,
            display: 'inline-block',
            fontSize: '0.9375rem',
            fontWeight: 500,
            letterSpacing: '-0.01em',
            padding: '12px 32px',
            borderRadius: '980px',
            background: '#1a1a1a',
            color: '#fff',
            textDecoration: 'none',
          }}
        >
          {returnHref ? 'Back to dashboard' : 'Continue'}
        </a>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 32 }}>

      {/* WhatsApp number */}
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
          WhatsApp number
        </label>
        <input
          name="whatsapp_number"
          type="tel"
          required
          placeholder="+44 7700 900000"
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

      {/* Preferred times */}
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
          Preferred times <span style={{ fontWeight: 300, textTransform: 'none' as const, letterSpacing: 0 }}>— optional</span>
        </label>
        <textarea
          name="notes"
          rows={3}
          placeholder="e.g. weekday mornings, weekends"
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
            resize: 'none' as const,
            boxSizing: 'border-box' as const,
          }}
        />
      </div>

      {error && (
        <p style={{
          fontFamily: GEIST,
          fontSize: '0.8125rem',
          color: '#DE3E7B',
          margin: '-16px 0 0',
        }}>
          {error}
        </p>
      )}

      {/* Submit */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 14 }}>
        <button
          type="submit"
          disabled={loading}
          className="sona-btn-dark"
          style={{
            fontFamily: GEIST,
            fontSize: '0.9375rem',
            fontWeight: 500,
            letterSpacing: '-0.01em',
            padding: '12px 36px',
            borderRadius: '980px',
            background: '#1a1a1a',
            color: '#fff',
            border: 'none',
            cursor: loading ? 'default' : 'pointer',
            opacity: loading ? 0.5 : 1,
          }}
        >
          {loading ? 'Submitting…' : 'Request interview'}
        </button>

        {!returnHref && (
          <a
            href={`/dashboard/create?step=4&portrait_id=${portraitId}`}
            className="sona-link"
            style={{
              fontFamily: GEIST,
              fontSize: '0.8125rem',
              fontWeight: 300,
              color: '#b0b0b0',
              textDecoration: 'none',
            }}
          >
            Skip for now
          </a>
        )}
      </div>

    </form>
  )
}
