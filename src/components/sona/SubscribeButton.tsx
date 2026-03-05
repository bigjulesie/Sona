'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

const GEIST = 'var(--font-geist-sans)'

interface Props {
  portraitId: string
  isFree: boolean
  isLoggedIn: boolean
  slug: string
}

export function SubscribeButton({ portraitId, isFree, isLoggedIn, slug }: Props) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()

  async function handleClick() {
    if (!isLoggedIn) {
      router.push(`/login?next=/sona/${slug}`)
      return
    }
    setLoading(true)
    setError(null)
    try {
      if (isFree) {
        const res = await fetch('/api/subscriptions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ portrait_id: portraitId }),
        })
        if (!res.ok) {
          setError('Something went wrong. Please try again.')
          return
        }
        router.refresh()
      } else {
        const res = await fetch('/api/stripe/checkout', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ portrait_id: portraitId }),
        })
        if (!res.ok) {
          setError('Something went wrong. Please try again.')
          return
        }
        const { url } = await res.json()
        if (url) window.location.href = url
      }
    } catch {
      setError('Something went wrong. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div>
      <button
        onClick={handleClick}
        disabled={loading}
        className="sona-btn-dark"
        style={{
          fontFamily: GEIST,
          fontSize: '0.9375rem',
          fontWeight: 500,
          letterSpacing: '-0.01em',
          padding: '14px 40px',
          borderRadius: '980px',
          background: '#1a1a1a',
          color: '#fff',
          border: 'none',
          cursor: loading ? 'default' : 'pointer',
          opacity: loading ? 0.5 : 1,
          transition: 'opacity 0.15s ease',
        }}
      >
        {loading ? 'Loading…' : isFree ? 'Follow for free' : 'Subscribe'}
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
