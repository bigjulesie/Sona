'use client'

import { useState } from 'react'
import { TIER_LABELS } from '@/lib/tiers'

const GEIST = 'var(--font-geist-sans)'
const CORMORANT = 'var(--font-cormorant)'

interface Props {
  portraitId: string
  currentPriceCents: number | null
}

export function PricingManager({ portraitId, currentPriceCents }: Props) {
  const isPaid = currentPriceCents != null && currentPriceCents > 0
  const [editing, setEditing] = useState(false)
  const [type, setType] = useState<'free' | 'paid'>(isPaid ? 'paid' : 'free')
  const [price, setPrice] = useState(isPaid ? (currentPriceCents! / 100).toFixed(0) : '')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)

  async function handleSave() {
    setLoading(true)
    setError(null)
    setSaved(false)

    const monthly_price_cents = type === 'paid' ? Math.round(parseFloat(price) * 100) : null
    if (type === 'paid' && (isNaN(monthly_price_cents!) || !monthly_price_cents || monthly_price_cents < 100)) {
      setError('Minimum price is $1.00')
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
      setSaved(true)
      setEditing(false)
    } catch {
      setError('Something went wrong. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div>
      <p style={{ fontFamily: GEIST, fontSize: '0.6875rem', fontWeight: 500, letterSpacing: '0.09em', textTransform: 'uppercase', color: '#b0b0b0', margin: '0 0 16px' }}>
        Subscription price
      </p>

      {!editing ? (
        <>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}>
            <div>
              <p style={{ fontFamily: CORMORANT, fontSize: '1.75rem', fontWeight: 400, fontStyle: 'italic', color: '#1a1a1a', margin: '0 0 4px', lineHeight: 1 }}>
                {isPaid ? `$${(currentPriceCents! / 100).toFixed(0)}/month` : 'Free'}
              </p>
              <p style={{ fontFamily: GEIST, fontSize: '0.8125rem', fontWeight: 300, color: '#9b9b9b', margin: 0 }}>
                Subscribers receive <strong style={{ fontWeight: 500 }}>{TIER_LABELS['acquaintance']}</strong> tier access
              </p>
            </div>
            <button
              onClick={() => { setEditing(true); setSaved(false) }}
              style={{
                fontFamily: GEIST,
                fontSize: '0.8125rem',
                fontWeight: 400,
                padding: '8px 20px',
                borderRadius: '980px',
                border: '1px solid rgba(0,0,0,0.15)',
                background: '#fff',
                color: '#1a1a1a',
                cursor: 'pointer',
                flexShrink: 0,
              }}
            >
              Change
            </button>
          </div>
          {saved && (
            <p style={{ fontFamily: GEIST, fontSize: '0.8125rem', color: '#1a7a5a', margin: '8px 0 0' }}>
              Price updated.
            </p>
          )}
        </>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Free / Paid toggle */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            {(['free', 'paid'] as const).map(t => (
              <button
                key={t}
                type="button"
                onClick={() => setType(t)}
                style={{
                  padding: '14px 16px',
                  borderRadius: 12,
                  border: type === t ? '2px solid #1a1a1a' : '1.5px solid rgba(0,0,0,0.1)',
                  background: type === t ? '#1a1a1a' : '#fff',
                  textAlign: 'left' as const,
                  cursor: 'pointer',
                }}
              >
                <p style={{ fontFamily: GEIST, fontSize: '0.875rem', fontWeight: 500, color: type === t ? '#fff' : '#1a1a1a', margin: '0 0 2px', textTransform: 'capitalize' as const }}>
                  {t}
                </p>
                <p style={{ fontFamily: GEIST, fontSize: '0.75rem', fontWeight: 300, color: type === t ? 'rgba(255,255,255,0.55)' : '#b0b0b0', margin: 0 }}>
                  {t === 'free' ? 'Anyone can access' : 'Subscribers only'}
                </p>
              </button>
            ))}
          </div>

          {type === 'paid' && (
            <div style={{ position: 'relative' }}>
              <span style={{ position: 'absolute', left: 0, top: '50%', transform: 'translateY(-50%)', fontFamily: GEIST, fontSize: '0.9375rem', fontWeight: 300, color: '#b0b0b0' }}>
                $
              </span>
              <input
                type="number"
                min="1"
                step="1"
                value={price}
                onChange={e => setPrice(e.target.value)}
                placeholder="10"
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
          )}

          {error && <p style={{ fontFamily: GEIST, fontSize: '0.8125rem', color: '#DE3E7B', margin: 0 }}>{error}</p>}

          <div style={{ display: 'flex', gap: 10 }}>
            <button
              onClick={handleSave}
              disabled={loading}
              className="sona-btn-dark"
              style={{
                fontFamily: GEIST,
                fontSize: '0.875rem',
                fontWeight: 500,
                padding: '10px 24px',
                borderRadius: '980px',
                background: '#1a1a1a',
                color: '#fff',
                border: 'none',
                cursor: loading ? 'default' : 'pointer',
                opacity: loading ? 0.5 : 1,
              }}
            >
              {loading ? 'Saving\u2026' : 'Save'}
            </button>
            <button
              onClick={() => setEditing(false)}
              style={{
                fontFamily: GEIST,
                fontSize: '0.875rem',
                fontWeight: 400,
                padding: '10px 20px',
                borderRadius: '980px',
                border: '1px solid rgba(0,0,0,0.15)',
                background: '#fff',
                color: '#6b6b6b',
                cursor: 'pointer',
              }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
