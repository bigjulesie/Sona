'use client'

import { useState } from 'react'
import { saveVoiceGender, completeOnboarding } from './actions'

const GEIST = 'var(--font-geist-sans)'
const CORMORANT = 'var(--font-cormorant)'

interface Props {
  voiceGender: string | null
}

export function OnboardingFlow({ voiceGender }: Props) {
  const [step, setStep] = useState<'voice' | 'destination'>(
    voiceGender ? 'destination' : 'voice'
  )
  const [saving, setSaving] = useState(false)

  async function handleVoiceSelect(gender: 'male' | 'female') {
    setSaving(true)
    await saveVoiceGender(gender)
    setSaving(false)
    setStep('destination')
  }

  if (step === 'voice') {
    return (
      <>
        <div style={{ textAlign: 'center', marginBottom: 48, maxWidth: 480 }}>
          <h1 style={{
            fontFamily: CORMORANT,
            fontSize: 'clamp(2rem, 4vw, 2.75rem)',
            fontWeight: 400,
            fontStyle: 'italic',
            lineHeight: 1.1,
            letterSpacing: '-0.02em',
            color: '#1a1a1a',
            margin: '0 0 12px',
          }}>
            Choose your voice.
          </h1>
          <p style={{
            fontFamily: GEIST,
            fontSize: '1rem',
            fontWeight: 300,
            color: '#6b6b6b',
            margin: 0,
            lineHeight: 1.6,
          }}>
            When subscribers talk with your Sona, which voice should they hear?
          </p>
        </div>

        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
          gap: 12,
          width: '100%',
          maxWidth: 400,
        }}>
          {(['male', 'female'] as const).map(gender => (
            <button
              key={gender}
              onClick={() => handleVoiceSelect(gender)}
              disabled={saving}
              className="sona-card"
              style={{
                padding: '28px 24px',
                borderRadius: 18,
                border: '1px solid rgba(0,0,0,0.08)',
                backgroundColor: '#fff',
                textAlign: 'left',
                cursor: saving ? 'default' : 'pointer',
                opacity: saving ? 0.6 : 1,
                display: 'flex',
                flexDirection: 'column',
                gap: 10,
              }}
            >
              <div>
                {gender === 'male' ? (
                  <svg width="28" height="28" viewBox="0 0 28 28" fill="none" aria-hidden>
                    <circle cx="14" cy="10" r="5.5" stroke="#DE3E7B" strokeWidth="1.5" opacity="0.7" />
                    <path d="M5 26c0-4.418 4.03-8 9-8s9 3.582 9 8" stroke="#DE3E7B" strokeWidth="1.5" strokeLinecap="round" opacity="0.7" />
                  </svg>
                ) : (
                  <svg width="28" height="28" viewBox="0 0 28 28" fill="none" aria-hidden>
                    <circle cx="14" cy="10" r="5.5" stroke="#DE3E7B" strokeWidth="1.5" opacity="0.7" />
                    <path d="M5 26c0-4.418 4.03-8 9-8s9 3.582 9 8" stroke="#DE3E7B" strokeWidth="1.5" strokeLinecap="round" opacity="0.7" />
                    <path d="M10 23.5c0 1.5.5 3 2 3.5" stroke="#DE3E7B" strokeWidth="1.25" strokeLinecap="round" opacity="0.5" />
                    <path d="M18 23.5c0 1.5-.5 3-2 3.5" stroke="#DE3E7B" strokeWidth="1.25" strokeLinecap="round" opacity="0.5" />
                  </svg>
                )}
              </div>
              <span style={{
                fontFamily: GEIST,
                fontSize: '0.9375rem',
                fontWeight: 500,
                color: '#1a1a1a',
                textTransform: 'capitalize',
              }}>
                {gender}
              </span>
            </button>
          ))}
        </div>
      </>
    )
  }

  // Destination step
  return (
    <>
      <div style={{ textAlign: 'center', marginBottom: 48, maxWidth: 480 }}>
        <h1 style={{
          fontFamily: CORMORANT,
          fontSize: 'clamp(2rem, 4vw, 2.75rem)',
          fontWeight: 400,
          fontStyle: 'italic',
          lineHeight: 1.1,
          letterSpacing: '-0.02em',
          color: '#1a1a1a',
          margin: '0 0 12px',
        }}>
          Welcome to Sona.
        </h1>
        <p style={{
          fontFamily: GEIST,
          fontSize: '1rem',
          fontWeight: 300,
          color: '#6b6b6b',
          margin: 0,
          lineHeight: 1.6,
        }}>
          What would you like to do first?
        </p>
      </div>

      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
        gap: 12,
        width: '100%',
        maxWidth: 480,
        alignItems: 'stretch',
      }}>
        {/* Create */}
        <form action={completeOnboarding.bind(null, 'create')} style={{ display: 'flex' }}>
          <button
            type="submit"
            className="sona-card"
            style={{
              width: '100%',
              padding: '28px 24px',
              borderRadius: 18,
              border: '1px solid rgba(0,0,0,0.08)',
              backgroundColor: '#fff',
              textAlign: 'left',
              cursor: 'pointer',
              display: 'flex',
              flexDirection: 'column',
            }}
          >
            <div style={{ marginBottom: 20 }}>
              <svg width="28" height="28" viewBox="0 0 72 72" fill="none" aria-hidden>
                <circle cx="36" cy="36" r="36" fill="url(#onbGrad1)" />
                <defs>
                  <radialGradient id="onbGrad1" cx="0" cy="0" r="1"
                    gradientUnits="userSpaceOnUse"
                    gradientTransform="translate(36 36) rotate(90) scale(36)">
                    <stop stopColor="#DE3E7B" />
                    <stop offset="0.495" stopColor="#DE3E7B" />
                    <stop offset="1" stopColor="#DE3E7B" stopOpacity="0" />
                  </radialGradient>
                </defs>
              </svg>
            </div>
            <h2 style={{
              fontFamily: GEIST,
              fontSize: '0.9375rem',
              fontWeight: 500,
              color: '#1a1a1a',
              margin: '0 0 6px',
              lineHeight: 1.2,
            }}>
              Create my Sona
            </h2>
            <p style={{
              fontFamily: GEIST,
              fontSize: '0.8125rem',
              fontWeight: 300,
              color: '#6b6b6b',
              margin: 0,
              lineHeight: 1.55,
            }}>
              Build your digital presence and share your knowledge with the world.
            </p>
          </button>
        </form>

        {/* Explore */}
        <form action={completeOnboarding.bind(null, 'explore')} style={{ display: 'flex' }}>
          <button
            type="submit"
            className="sona-card"
            style={{
              width: '100%',
              padding: '28px 24px',
              borderRadius: 18,
              border: '1px solid rgba(0,0,0,0.08)',
              backgroundColor: '#fff',
              textAlign: 'left',
              cursor: 'pointer',
              display: 'flex',
              flexDirection: 'column',
            }}
          >
            <div style={{ marginBottom: 20 }}>
              <svg width="28" height="28" viewBox="0 0 28 28" fill="none" aria-hidden>
                <circle cx="14" cy="14" r="13" stroke="#DE3E7B" strokeWidth="1.5" opacity="0.35" />
                <circle cx="14" cy="14" r="7" stroke="#DE3E7B" strokeWidth="1.5" opacity="0.6" />
                <circle cx="14" cy="14" r="2.5" fill="#DE3E7B" opacity="1" />
              </svg>
            </div>
            <h2 style={{
              fontFamily: GEIST,
              fontSize: '0.9375rem',
              fontWeight: 500,
              color: '#1a1a1a',
              margin: '0 0 6px',
              lineHeight: 1.2,
            }}>
              Build your circle
            </h2>
            <p style={{
              fontFamily: GEIST,
              fontSize: '0.8125rem',
              fontWeight: 300,
              color: '#6b6b6b',
              margin: 0,
              lineHeight: 1.55,
            }}>
              Add remarkable people to your circle — available whenever you need them.
            </p>
          </button>
        </form>
      </div>
    </>
  )
}
