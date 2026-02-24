'use client'

import { useState, Suspense } from 'react'
import Image from 'next/image'
import { createClient } from '@/lib/supabase/client'

function LoginForm() {
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    console.log('[login] supabase url:', supabaseUrl)
    console.log('[login] anon key present:', !!supabaseKey)

    if (!supabaseUrl || !supabaseKey) {
      setError('Missing Supabase configuration. Check environment variables.')
      setLoading(false)
      return
    }

    const supabase = createClient()

    const timeout = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('Request timed out after 15s')), 15000)
    )

    try {
      const { error: otpError } = await Promise.race([
        supabase.auth.signInWithOtp({
          email,
          options: {
            emailRedirectTo: `${window.location.origin}/auth/callback`,
          },
        }),
        timeout,
      ])

      if (otpError) {
        console.error('[login] OTP error:', otpError)
        setError(otpError.message)
      } else {
        setSent(true)
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error'
      console.error('[login] caught error:', msg)
      setError(msg)
    }

    setLoading(false)
  }

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center px-6"
      style={{ backgroundColor: '#F5F0E8' }}
    >
      {/* Brass accent lines */}
      <div className="fixed top-0 left-0 right-0 h-[2px]" style={{ backgroundColor: '#8B7355', opacity: 0.5 }} />
      <div className="fixed bottom-0 left-0 right-0 h-[2px]" style={{ backgroundColor: '#8B7355', opacity: 0.5 }} />

      <div className="w-full max-w-xs">
        {/* Logo */}
        <div className="flex justify-center mb-12">
          <Image
            src="/brand_assets/logo.svg"
            alt="Neural Heirloom"
            width={210}
            height={63}
            priority
          />
        </div>

        {/* Divider with icon */}
        <div className="flex items-center gap-3 mb-10">
          <div className="flex-1 h-px" style={{ backgroundColor: '#8B7355', opacity: 0.3 }} />
          <Image src="/brand_assets/icon.svg" alt="" width={14} height={14} className="opacity-30" />
          <div className="flex-1 h-px" style={{ backgroundColor: '#8B7355', opacity: 0.3 }} />
        </div>

        {sent ? (
          <div className="text-center space-y-2">
            <p className="font-display text-2xl" style={{ color: '#2C2416' }}>Check your email</p>
            <p className="text-sm" style={{ color: '#9B9086' }}>
              A sign-in link has been sent to {email}
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-7">
            <div>
              <label
                className="block text-xs tracking-widest uppercase mb-2"
                style={{ color: '#9B9086' }}
              >
                Email address
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                required
                className="w-full bg-transparent py-2 text-sm focus:outline-none transition-colors"
                style={{
                  borderBottom: '1px solid rgba(139, 115, 85, 0.4)',
                  color: '#2C2416',
                }}
              />
            </div>

            {error && <p className="text-red-700 text-sm">{error}</p>}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 text-xs tracking-widest uppercase transition-colors disabled:opacity-50"
              style={{
                backgroundColor: '#2C2416',
                color: '#F5F0E8',
                border: '1px solid #2C2416',
              }}
            >
              {loading ? 'Sending…' : 'Continue'}
            </button>
          </form>
        )}
      </div>
    </div>
  )
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  )
}
