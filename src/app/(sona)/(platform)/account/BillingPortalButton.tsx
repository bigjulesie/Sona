'use client'

import { useState } from 'react'

const GEIST = 'var(--font-geist-sans)'

export function BillingPortalButton() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function openPortal() {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/stripe/portal', { method: 'POST' })
      if (!res.ok) {
        setError('Unable to open billing portal. Please try again.')
        return
      }
      const { url } = await res.json()
      if (url) {
        window.location.href = url
      } else {
        setError('Unable to open billing portal. Please try again.')
      }
    } catch {
      setError('Unable to open billing portal. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div>
      <button
        onClick={openPortal}
        disabled={loading}
        className="sona-btn-outline"
        style={{
          fontFamily: GEIST,
          fontSize: '0.875rem',
          fontWeight: 400,
          letterSpacing: '-0.01em',
          color: '#1a1a1a',
          padding: '10px 24px',
          borderRadius: '980px',
          border: '1px solid rgba(0,0,0,0.18)',
          background: 'transparent',
          cursor: loading ? 'default' : 'pointer',
          opacity: loading ? 0.5 : 1,
          transition: 'background-color 0.15s ease',
        }}
      >
        {loading ? 'Loading…' : 'Manage billing →'}
      </button>
      {error && (
        <p style={{
          fontFamily: GEIST,
          fontSize: '0.8125rem',
          color: '#DE3E7B',
          marginTop: 12,
        }}>
          {error}
        </p>
      )}
    </div>
  )
}
