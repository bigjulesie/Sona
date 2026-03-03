'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

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

    // Validate: paid price must be >= $0.50 (50 cents)
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
    <form onSubmit={handleSubmit} className="space-y-5">
      <h2 className="text-lg font-semibold text-gray-900">Set your price</h2>
      <p className="text-sm text-gray-500">Subscribers pay this monthly to access your full Sona. You can always offer it free.</p>
      <div className="grid grid-cols-2 gap-3">
        {(['free', 'paid'] as const).map(t => (
          <button key={t} type="button" onClick={() => setType(t)}
            className={`p-4 rounded-xl border-2 text-left transition-colors ${
              type === t ? 'border-gray-900' : 'border-gray-100'
            }`}>
            <p className="font-medium text-gray-900 capitalize">{t}</p>
            <p className="text-xs text-gray-500 mt-0.5">
              {t === 'free' ? 'Anyone can access' : 'Subscribers only'}
            </p>
          </button>
        ))}
      </div>
      {type === 'paid' && (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Monthly price (USD)</label>
          <div className="relative">
            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400">$</span>
            <input type="number" min="0.50" step="0.01" value={price} onChange={e => setPrice(e.target.value)}
              required placeholder="9.00"
              className="w-full pl-8 pr-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900" />
          </div>
        </div>
      )}
      {error && <p className="text-sm text-red-500">{error}</p>}
      <button type="submit" disabled={loading}
        className="w-full py-3 bg-gray-900 text-white rounded-xl font-medium hover:bg-gray-700 disabled:opacity-50 transition-colors">
        {loading ? 'Setting up\u2026' : 'Finish'}
      </button>
    </form>
  )
}
