'use client'

import { useState } from 'react'

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

  const continueHref = returnHref ?? `/dashboard/create?step=3&portrait_id=${portraitId}`

  if (done) {
    return (
      <div className="text-center">
        <div className="text-4xl mb-4">&#10003;</div>
        <h2 className="text-lg font-semibold text-gray-900 mb-2">Interview requested</h2>
        <p className="text-gray-500 text-sm mb-6">We&apos;ll be in touch via WhatsApp to schedule.</p>
        <a href={continueHref}
          className="px-5 py-2.5 bg-gray-900 text-white rounded-xl text-sm hover:bg-gray-700 transition-colors">
          {returnHref ? 'Back to dashboard' : 'Continue'}
        </a>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div className="p-4 bg-blue-50 rounded-xl text-sm text-blue-700">
        We&apos;ll conduct a WhatsApp interview to capture your voice and values &mdash; the foundation of your Sona.
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">WhatsApp number</label>
        <input name="whatsapp_number" type="tel" required placeholder="+44 7700 900000"
          className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900" />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Preferred times (optional)</label>
        <textarea name="notes" rows={3} placeholder="e.g. weekday mornings, weekends"
          className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 resize-none" />
      </div>
      {error && <p className="text-sm text-red-500">{error}</p>}
      <button type="submit" disabled={loading}
        className="w-full py-3 bg-gray-900 text-white rounded-xl font-medium hover:bg-gray-700 disabled:opacity-50 transition-colors">
        {loading ? 'Submitting\u2026' : 'Request interview'}
      </button>
      {!returnHref && (
        <a href={`/dashboard/create?step=3&portrait_id=${portraitId}`}
          className="block text-center text-sm text-gray-400 hover:text-gray-600">Skip for now</a>
      )}
    </form>
  )
}
