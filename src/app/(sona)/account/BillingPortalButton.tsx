'use client'

import { useState } from 'react'

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
      <button onClick={openPortal} disabled={loading}
        className="px-5 py-2.5 border border-gray-200 rounded-xl text-sm hover:border-gray-400 disabled:opacity-50 transition-colors">
        {loading ? 'Loading\u2026' : 'Manage billing \u2192'}
      </button>
      {error && <p className="mt-2 text-sm text-red-500">{error}</p>}
    </div>
  )
}
