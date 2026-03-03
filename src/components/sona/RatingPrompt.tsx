'use client'

import { useState } from 'react'

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
    setSelected(score)
    setError(null)
    try {
      const res = await fetch('/api/ratings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ portrait_id: portraitId, score }),
      })
      if (!res.ok) {
        setError('Failed to save rating.')
        return
      }
      setSubmitted(true)
    } catch {
      setError('Failed to save rating.')
    }
  }

  if (submitted && selected) {
    return (
      <div className="flex items-center gap-2 py-2 text-sm text-gray-500">
        <span>Your rating:</span>
        {[1, 2, 3, 4, 5].map(n => (
          <button key={n} onClick={() => { setSubmitted(false) }}
            className={`text-lg ${n <= selected ? 'text-yellow-400' : 'text-gray-200'}`}>
            &#9733;
          </button>
        ))}
        <span className="text-xs text-gray-400">(tap to change)</span>
      </div>
    )
  }

  return (
    <div className="py-3 border-t border-gray-100">
      <p className="text-sm text-gray-500 mb-2">How would you rate this Sona?</p>
      <div className="flex gap-1">
        {[1, 2, 3, 4, 5].map(n => (
          <button key={n} onClick={() => handleRate(n)}
            className={`text-2xl transition-colors hover:text-yellow-400 ${
              selected && n <= selected ? 'text-yellow-400' : 'text-gray-200'
            }`}>
            &#9733;
          </button>
        ))}
      </div>
      {error && <p className="mt-1 text-xs text-red-500">{error}</p>}
    </div>
  )
}
