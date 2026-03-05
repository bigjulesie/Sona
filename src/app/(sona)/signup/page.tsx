'use client'

import { useState } from 'react'
import Image from 'next/image'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'

const GEIST = 'var(--font-geist-sans)'
const CORMORANT = 'var(--font-cormorant)'

export default function SignUpPage() {
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')

    const supabase = createSupabaseClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { auth: { flowType: 'implicit' } }
    )
    const { error: otpError } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/confirm?next=/onboarding`,
      },
    })

    if (otpError) {
      setError(otpError.message)
    } else {
      setSent(true)
    }
    setLoading(false)
  }

  return (
    <main style={{
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
              We sent a magic link to {email}. Click it to continue.
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
              Get started
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
                  onChange={e => setEmail(e.target.value)}
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
                {loading ? 'Sending…' : 'Continue with email'}
              </button>
            </form>

            {/* Sign in link */}
            <p style={{
              fontFamily: GEIST,
              fontSize: '0.8125rem',
              fontWeight: 300,
              color: '#b0b0b0',
              textAlign: 'center',
              margin: '24px 0 0',
            }}>
              Already have an account?{' '}
              <a
                href="/login"
                className="sona-link"
                style={{
                  color: '#6b6b6b',
                  textDecoration: 'none',
                  fontWeight: 400,
                }}
              >
                Sign in
              </a>
            </p>
          </>
        )}

      </div>
    </main>
  )
}
