'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

const GEIST = 'var(--font-geist-sans)'

export function PricingStep({ portraitId }: { portraitId: string }) {
  const [type, setType] = useState<'free' | 'paid'>('free')
  const [price, setPrice] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const monthly_price_cents = type === 'paid'
      ? Math.round(parseFloat(price) * 100)
      : null

    if (type === 'paid' && (isNaN(monthly_price_cents!) || monthly_price_cents! < 50)) {
      setError('Minimum price is $0.50')
      setLoading(false)
      return
    }

    try {
      const res = await fetch('/api/portraits/pricing', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ portrait_id: portraitId, monthly_price_cents }),
      })
      if (!res.ok) {
        setError('Something went wrong. Please try again.')
        return
      }
      router.push('/dashboard')
    } catch {
      setError('Something went wrong. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 32 }}>

      {/* Free / Paid toggle */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        {(['free', 'paid'] as const).map(t => (
          <button
            key={t}
            type="button"
            onClick={() => setType(t)}
            style={{
              padding: '18px 20px',
              borderRadius: 14,
              border: type === t ? '2px solid #1a1a1a' : '1.5px solid rgba(0,0,0,0.1)',
              background: type === t ? '#1a1a1a' : '#fff',
              textAlign: 'left' as const,
              cursor: 'pointer',
              transition: 'border-color 0.15s ease, background 0.15s ease',
            }}
          >
            <p style={{
              fontFamily: GEIST,
              fontSize: '0.9375rem',
              fontWeight: 500,
              color: type === t ? '#fff' : '#1a1a1a',
              margin: '0 0 3px',
              textTransform: 'capitalize' as const,
            }}>
              {t}
            </p>
            <p style={{
              fontFamily: GEIST,
              fontSize: '0.75rem',
              fontWeight: 300,
              color: type === t ? 'rgba(255,255,255,0.55)' : '#b0b0b0',
              margin: 0,
            }}>
              {t === 'free' ? 'Anyone can access' : 'Subscribers only'}
            </p>
          </button>
        ))}
      </div>

      {/* Price input */}
      {type === 'paid' && (
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
            Monthly price (USD)
          </label>
          <div style={{ position: 'relative' }}>
            <span style={{
              position: 'absolute',
              left: 0,
              top: '50%',
              transform: 'translateY(-50%)',
              fontFamily: GEIST,
              fontSize: '0.9375rem',
              fontWeight: 300,
              color: '#b0b0b0',
              userSelect: 'none',
            }}>
              $
            </span>
            <input
              type="number"
              min="0.50"
              step="0.01"
              value={price}
              onChange={e => setPrice(e.target.value)}
              required
              placeholder="9.00"
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
                padding: '8px 0 8px 18px',
                outline: 'none',
                boxSizing: 'border-box' as const,
              }}
            />
          </div>
        </div>
      )}

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
            padding: '12px 40px',
            borderRadius: '980px',
            background: '#1a1a1a',
            color: '#fff',
            border: 'none',
            cursor: loading ? 'default' : 'pointer',
            opacity: loading ? 0.5 : 1,
          }}
        >
          {loading ? 'Setting up…' : 'Finish'}
        </button>
      </div>

    </form>
  )
}
