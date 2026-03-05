'use client'

import { useState } from 'react'

const GEIST = 'var(--font-geist-sans)'

interface Props {
  portraitId: string
  messageCount: number
  existingRating?: number | null
}

export function RatingPrompt({ portraitId, messageCount, existingRating }: Props) {
  const [selected, setSelected] = useState<number | null>(existingRating ?? null)
  const [submitted, setSubmitted] = useState(existingRating != null)
  const [error, setError] = useState<string | null>(null)

  // Only show after 5th message
  if (messageCount < 5) return null

  async function handleRate(score: number) {
    const previous = selected
    setSelected(score)
    setError(null)
    try {
      const res = await fetch('/api/ratings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ portrait_id: portraitId, score }),
      })
      if (!res.ok) {
        setSelected(previous)
        setError('Failed to save rating.')
        return
      }
      setSubmitted(true)
    } catch {
      setSelected(previous)
      setError('Failed to save rating.')
    }
  }

  if (submitted && selected) {
    return (
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        paddingTop: 8,
        paddingBottom: 8,
      }}>
        <span style={{
          fontFamily: GEIST,
          fontSize: '0.8125rem',
          fontWeight: 300,
          color: '#9b9b9b',
        }}>
          Your rating:
        </span>
        {[1, 2, 3, 4, 5].map(n => (
          <button
            key={n}
            onClick={() => setSubmitted(false)}
            style={{
              fontSize: '1.125rem',
              background: 'none',
              border: 'none',
              padding: 0,
              cursor: 'pointer',
              color: n <= selected ? '#DE3E7B' : 'rgba(0,0,0,0.12)',
              lineHeight: 1,
            }}
          >
            &#9733;
          </button>
        ))}
        <span style={{
          fontFamily: GEIST,
          fontSize: '0.75rem',
          fontWeight: 300,
          color: '#b0b0b0',
        }}>
          (tap to change)
        </span>
      </div>
    )
  }

  return (
    <div style={{
      paddingTop: 16,
      borderTop: '1px solid rgba(0,0,0,0.06)',
    }}>
      <p style={{
        fontFamily: GEIST,
        fontSize: '0.8125rem',
        fontWeight: 300,
        color: '#9b9b9b',
        margin: '0 0 10px',
      }}>
        How would you rate this Sona?
      </p>
      <div style={{ display: 'flex', gap: 4 }}>
        {[1, 2, 3, 4, 5].map(n => (
          <button
            key={n}
            onClick={() => handleRate(n)}
            style={{
              fontSize: '1.5rem',
              background: 'none',
              border: 'none',
              padding: '0 2px',
              cursor: 'pointer',
              color: selected && n <= selected ? '#DE3E7B' : 'rgba(0,0,0,0.12)',
              lineHeight: 1,
              transition: 'color 0.1s ease',
            }}
          >
            &#9733;
          </button>
        ))}
      </div>
      {error && (
        <p style={{
          fontFamily: GEIST,
          fontSize: '0.75rem',
          color: '#DE3E7B',
          margin: '8px 0 0',
        }}>
          {error}
        </p>
      )}
    </div>
  )
}
