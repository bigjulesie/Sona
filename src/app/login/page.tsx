'use client'

import { useState } from 'react'
import Image from 'next/image'
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
    <div className="min-h-screen bg-parchment flex flex-col items-center justify-center px-6">
      {/* Brass accent lines */}
      <div className="fixed top-0 left-0 right-0 h-[2px] bg-brass opacity-50" />
      <div className="fixed bottom-0 left-0 right-0 h-[2px] bg-brass opacity-50" />

      <div className="w-full max-w-xs">
        {/* Logo */}
        <div className="flex justify-center mb-10">
          <Image
            src="/brand_assets/logo.svg"
            alt="Neural Heirloom"
            width={180}
            height={54}
            priority
          />
        </div>

        {/* Divider with icon */}
        <div className="flex items-center gap-3 mb-8">
          <div className="flex-1 h-px bg-brass/30" />
          <Image src="/brand_assets/icon.svg" alt="" width={16} height={16} className="opacity-40" />
          <div className="flex-1 h-px bg-brass/30" />
        </div>

        {sent ? (
          <div className="text-center space-y-2">
            <p className="font-display text-2xl text-ink">Check your email</p>
            <p className="text-mist text-sm">
              A sign-in link has been sent to {email}
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-7">
            <div>
              <label className="block text-xs tracking-widest uppercase text-mist mb-2">
                Email address
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                required
                className="w-full bg-transparent border-b border-brass/40 py-2 text-ink text-sm
                           focus:outline-none focus:border-brass placeholder:text-mist/50
                           transition-colors"
              />
            </div>

            {error && <p className="text-red-700 text-sm">{error}</p>}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 bg-ink text-parchment text-xs tracking-widest uppercase
                         hover:bg-ink/90 disabled:opacity-50 transition-colors"
            >
              {loading ? 'Sending…' : 'Continue'}
            </button>
          </form>
        )}
      </div>
    </div>
  )
}
