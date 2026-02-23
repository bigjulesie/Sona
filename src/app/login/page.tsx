'use client'

import { useState } from 'react'
import { loginWithMagicLink } from './actions'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')

    const formData = new FormData()
    formData.set('email', email)
    const result = await loginWithMagicLink(formData)

    if (result.error) {
      setError(result.error)
    } else {
      setSent(true)
    }
    setLoading(false)
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-stone-50">
      <div className="w-full max-w-md p-8">
        <h1 className="text-2xl font-light tracking-tight text-stone-900 mb-2">
          Neural Heirloom
        </h1>
        <p className="text-stone-500 mb-8 text-sm">
          Enter your email to sign in
        </p>

        {sent ? (
          <div className="text-stone-700 bg-stone-100 rounded-lg p-4 text-sm">
            Check your email for a sign-in link.
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              required
              className="w-full px-4 py-3 border border-stone-200 rounded-lg text-sm
                         focus:outline-none focus:ring-2 focus:ring-stone-900 focus:border-transparent
                         bg-white text-stone-900 placeholder:text-stone-400"
            />
            {error && <p className="text-red-600 text-sm">{error}</p>}
            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 bg-stone-900 text-white rounded-lg text-sm font-medium
                         hover:bg-stone-800 disabled:opacity-50 transition-colors"
            >
              {loading ? 'Sending...' : 'Continue with Email'}
            </button>
          </form>
        )}
      </div>
    </div>
  )
}
