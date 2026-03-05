'use client'

import { useEffect } from 'react'
import Image from 'next/image'

const GEIST = 'var(--font-geist-sans)'
const CORMORANT = 'var(--font-cormorant)'

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error(error)
  }, [error])

  return (
    <main style={{
      minHeight: '100vh',
      backgroundColor: '#fff',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '0 24px',
      textAlign: 'center',
    }}>
      <div style={{ marginBottom: 40 }}>
        <Image
          src="/brand_assets/sona/Sona brand on white bg 1.svg"
          alt="Sona"
          width={80}
          height={30}
          priority
        />
      </div>

      <p style={{
        fontFamily: GEIST,
        fontSize: '0.6875rem',
        fontWeight: 500,
        letterSpacing: '0.12em',
        textTransform: 'uppercase',
        color: '#DE3E7B',
        margin: '0 0 16px',
      }}>
        Something went wrong
      </p>

      <h1 style={{
        fontFamily: CORMORANT,
        fontSize: 'clamp(1.75rem, 4vw, 2.5rem)',
        fontWeight: 400,
        fontStyle: 'italic',
        color: '#1a1a1a',
        lineHeight: 1.1,
        letterSpacing: '-0.02em',
        margin: '0 0 14px',
      }}>
        An unexpected error occurred.
      </h1>

      <p style={{
        fontFamily: GEIST,
        fontSize: '0.9375rem',
        fontWeight: 300,
        color: '#6b6b6b',
        margin: '0 0 36px',
        maxWidth: 360,
        lineHeight: 1.6,
      }}>
        We're sorry for the disruption. Please try again.
      </p>

      <button
        onClick={reset}
        style={{
          fontFamily: GEIST,
          fontSize: '0.9375rem',
          fontWeight: 500,
          letterSpacing: '-0.01em',
          color: '#fff',
          backgroundColor: '#1a1a1a',
          border: 'none',
          borderRadius: '980px',
          padding: '12px 32px',
          cursor: 'pointer',
        }}
      >
        Try again
      </button>
    </main>
  )
}
