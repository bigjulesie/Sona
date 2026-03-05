'use client'

import { useState } from 'react'
import Image from 'next/image'
import { createClient } from '@supabase/supabase-js'

const GEIST = 'var(--font-geist-sans)'
const CORMORANT = 'var(--font-cormorant)'

interface Props {
  brand: string
}

export function LoginForm({ brand }: Props) {
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { auth: { flowType: 'implicit' } }
    )
    const { error: otpError } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/confirm`,
      },
    })

    if (otpError) {
      setError(otpError.message)
    } else {
      setSent(true)
    }
    setLoading(false)
  }

  const isSona = brand === 'sona'

  if (isSona) {
    return (
      <div style={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#fff',
        padding: '0 24px',
      }}>
        <div style={{ width: '100%', maxWidth: 320 }}>

          {/* Logo */}
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 40 }}>
            <Image
              src="/brand_assets/sona/Sona brand on white bg 1.svg"
              alt="Sona"
              width={100}
              height={38}
              priority
            />
          </div>

          {sent ? (
            <div style={{ textAlign: 'center' }}>
              {/* Coral check */}
              <div style={{
                width: 48,
                height: 48,
                borderRadius: '50%',
                backgroundColor: '#DE3E7B',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 20px',
              }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
                  <path d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <p style={{
                fontFamily: CORMORANT,
                fontSize: '1.75rem',
                fontWeight: 400,
                fontStyle: 'italic',
                color: '#1a1a1a',
                margin: '0 0 8px',
                lineHeight: 1.2,
              }}>
                Check your email
              </p>
              <p style={{
                fontFamily: GEIST,
                fontSize: '0.875rem',
                fontWeight: 300,
                color: '#6b6b6b',
                margin: 0,
                lineHeight: 1.6,
              }}>
                A sign-in link has been sent to {email}
              </p>
            </div>
          ) : (
            <>
              {/* Heading */}
              <p style={{
                fontFamily: CORMORANT,
                fontSize: '1.625rem',
                fontWeight: 400,
                fontStyle: 'italic',
                color: '#1a1a1a',
                textAlign: 'center',
                margin: '0 0 32px',
                lineHeight: 1.2,
              }}>
                Sign in
              </p>

              <form onSubmit={handleSubmit}>
                <div style={{ marginBottom: 24 }}>
                  <label style={{
                    display: 'block',
                    fontFamily: GEIST,
                    fontSize: '0.6875rem',
                    fontWeight: 500,
                    letterSpacing: '0.09em',
                    textTransform: 'uppercase',
                    color: '#b0b0b0',
                    marginBottom: 10,
                  }}>
                    Email address
                  </label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    required
                    className="sona-input"
                    style={{
                      width: '100%',
                      fontFamily: GEIST,
                      fontSize: '0.9375rem',
                      fontWeight: 300,
                      color: '#1a1a1a',
                      background: 'transparent',
                      border: 'none',
                      borderBottom: '1px solid rgba(0,0,0,0.15)',
                      padding: '8px 0',
                      outline: 'none',
                      boxSizing: 'border-box' as const,
                    }}
                  />
                </div>

                {error && (
                  <p style={{
                    fontFamily: GEIST,
                    fontSize: '0.8125rem',
                    color: '#DE3E7B',
                    margin: '-8px 0 16px',
                  }}>
                    {error}
                  </p>
                )}

                <button
                  type="submit"
                  disabled={loading}
                  className="sona-btn-dark"
                  style={{
                    width: '100%',
                    fontFamily: GEIST,
                    fontSize: '0.9375rem',
                    fontWeight: 500,
                    letterSpacing: '-0.01em',
                    color: '#fff',
                    backgroundColor: '#1a1a1a',
                    border: 'none',
                    borderRadius: '980px',
                    padding: '14px 0',
                    cursor: loading ? 'default' : 'pointer',
                    opacity: loading ? 0.5 : 1,
                    marginTop: 8,
                  }}
                >
                  {loading ? 'Sending…' : 'Continue'}
                </button>
              </form>

              {/* Sign up link */}
              <p style={{
                fontFamily: GEIST,
                fontSize: '0.8125rem',
                fontWeight: 300,
                color: '#b0b0b0',
                textAlign: 'center',
                margin: '24px 0 0',
              }}>
                New to Sona?{' '}
                <a
                  href="/signup"
                  className="sona-link"
                  style={{
                    color: '#6b6b6b',
                    textDecoration: 'none',
                    fontWeight: 400,
                  }}
                >
                  Get started
                </a>
              </p>
            </>
          )}

        </div>
      </div>
    )
  }

  // ── Neural Heirloom ──────────────────────────────────────────────────────
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
            src="/brand_assets/nh/logo.svg"
            alt="Neural Heirloom"
            width={210}
            height={63}
            priority
          />
        </div>

        {/* Divider with icon */}
        <div className="flex items-center gap-3 mb-10">
          <div className="flex-1 h-px" style={{ backgroundColor: '#8B7355', opacity: 0.3 }} />
          <Image src="/brand_assets/nh/icon.svg" alt="" width={14} height={14} className="opacity-30" />
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
