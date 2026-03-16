import { redirect } from 'next/navigation'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { createSonaIdentity } from './actions'
import { InterviewStep } from './InterviewStep'
import { PricingStep } from './PricingStep'
import { VerifyStep } from './VerifyStep'

const GEIST = 'var(--font-geist-sans)'
const CORMORANT = 'var(--font-cormorant)'

const CATEGORIES = [
  'Technology', 'Business', 'Science', 'Arts',
  'Sport', 'Politics', 'Education', 'Health', 'Other',
]

const STEPS = ['Identity', 'Verify', 'Interview', 'Content', 'Pricing']

interface PageProps {
  searchParams: Promise<{ step?: string; portrait_id?: string }>
}

export default async function CreateSonaPage({ searchParams }: PageProps) {
  const { step = '1', portrait_id } = await searchParams
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: existing } = await supabase
    .from('portraits')
    .select('id')
    .eq('creator_id', user.id)
    .maybeSingle()

  if (existing && step === '1') redirect('/dashboard')

  let verifiedPortraitId: string | undefined
  if (portrait_id && step !== '1') {
    const { data: ownedPortrait } = await supabase
      .from('portraits')
      .select('id')
      .eq('id', portrait_id)
      .eq('creator_id', user.id)
      .maybeSingle()
    verifiedPortraitId = ownedPortrait?.id
  } else {
    verifiedPortraitId = portrait_id
  }

  let webResearchStatus: string | null = null
  if (verifiedPortraitId && ['3', '4', '5'].includes(step)) {
    const { data: portrait } = await supabase
      .from('portraits')
      .select('web_research_status')
      .eq('id', verifiedPortraitId)
      .maybeSingle()
    webResearchStatus = (portrait as any)?.web_research_status ?? null
  }

  const currentStep = parseInt(step)

  return (
    <div style={{ maxWidth: 520, margin: '0 auto' }}>

      {/* ── Step indicator ──────────────────────────────────────── */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: 0,
        marginBottom: 48,
      }}>
        {STEPS.map((label, i) => {
          const n = i + 1
          const done = n < currentStep
          const active = n === currentStep
          return (
            <div key={label} style={{ display: 'flex', alignItems: 'center', flex: i < STEPS.length - 1 ? 1 : 'none' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                {/* Circle */}
                <div style={{
                  width: 24,
                  height: 24,
                  borderRadius: '50%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                  backgroundColor: done ? '#DE3E7B' : active ? '#1a1a1a' : 'transparent',
                  border: done || active ? 'none' : '1.5px solid rgba(0,0,0,0.15)',
                }}>
                  {done ? (
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round">
                      <path d="M5 13l4 4L19 7" />
                    </svg>
                  ) : (
                    <span style={{
                      fontFamily: GEIST,
                      fontSize: '0.6875rem',
                      fontWeight: 500,
                      color: active ? '#fff' : 'rgba(0,0,0,0.25)',
                      lineHeight: 1,
                    }}>
                      {n}
                    </span>
                  )}
                </div>
                {/* Label */}
                <span style={{
                  fontFamily: GEIST,
                  fontSize: '0.8125rem',
                  fontWeight: active ? 500 : 300,
                  color: active ? '#1a1a1a' : done ? '#DE3E7B' : '#c0c0c0',
                }}>
                  {label}
                </span>
              </div>
              {/* Connector */}
              {i < STEPS.length - 1 && (
                <div style={{
                  flex: 1,
                  height: 1,
                  backgroundColor: done ? '#DE3E7B' : 'rgba(0,0,0,0.08)',
                  margin: '0 12px',
                  opacity: done ? 0.4 : 1,
                }} />
              )}
            </div>
          )
        })}
      </div>

      {/* ── Web research status banner ──────────────────────────── */}
      {webResearchStatus === 'running' && (
        <div style={{
          fontFamily: GEIST,
          fontSize: '0.8125rem',
          fontWeight: 300,
          color: '#6b6b6b',
          background: 'rgba(0,0,0,0.03)',
          border: '1px solid rgba(0,0,0,0.07)',
          borderRadius: 10,
          padding: '10px 16px',
          marginBottom: 32,
          lineHeight: 1.5,
        }}>
          We&apos;re researching you on the web — sources will appear in your content library as they&apos;re found.
        </div>
      )}
      {webResearchStatus === 'error' && (
        <div style={{
          fontFamily: GEIST,
          fontSize: '0.8125rem',
          fontWeight: 300,
          color: '#6b6b6b',
          background: 'rgba(0,0,0,0.03)',
          border: '1px solid rgba(0,0,0,0.07)',
          borderRadius: 10,
          padding: '10px 16px',
          marginBottom: 32,
          lineHeight: 1.5,
        }}>
          Web research couldn&apos;t complete. You can add sources manually.
        </div>
      )}

      {/* ── Step 1: Identity ────────────────────────────────────── */}
      {step === '1' && (
        <>
          <h1 style={{
            fontFamily: CORMORANT,
            fontSize: 'clamp(1.75rem, 3vw, 2.25rem)',
            fontWeight: 400,
            fontStyle: 'italic',
            lineHeight: 1.1,
            letterSpacing: '-0.02em',
            color: '#1a1a1a',
            margin: '0 0 8px',
          }}>
            Create your Sona
          </h1>
          <p style={{
            fontFamily: GEIST,
            fontSize: '0.875rem',
            fontWeight: 300,
            color: '#6b6b6b',
            margin: '0 0 40px',
            lineHeight: 1.6,
          }}>
            Tell us who you are. You can refine everything later.
          </p>

          <form action={createSonaIdentity} style={{ display: 'flex', flexDirection: 'column', gap: 32 }}>

            {/* Full name */}
            <div>
              <label style={{
                fontFamily: GEIST,
                fontSize: '0.6875rem',
                fontWeight: 500,
                letterSpacing: '0.09em',
                textTransform: 'uppercase' as const,
                color: '#b0b0b0',
                display: 'block',
                marginBottom: 10,
              }}>
                Full name
              </label>
              <input
                name="display_name"
                required
                placeholder="Your name as you'd like it to appear"
                className="sona-input"
                style={{
                  fontFamily: GEIST,
                  fontSize: '0.9375rem',
                  fontWeight: 300,
                  color: '#1a1a1a',
                  width: '100%',
                  background: 'transparent',
                  border: 'none',
                  borderBottom: '1px solid rgba(0,0,0,0.15)',
                  padding: '8px 0',
                  outline: 'none',
                  boxSizing: 'border-box' as const,
                }}
              />
            </div>

            {/* Tagline */}
            <div>
              <label style={{
                fontFamily: GEIST,
                fontSize: '0.6875rem',
                fontWeight: 500,
                letterSpacing: '0.09em',
                textTransform: 'uppercase' as const,
                color: '#b0b0b0',
                display: 'block',
                marginBottom: 10,
              }}>
                Tagline
              </label>
              <input
                name="tagline"
                placeholder="What you're known for, in one line"
                className="sona-input"
                style={{
                  fontFamily: GEIST,
                  fontSize: '0.9375rem',
                  fontWeight: 300,
                  color: '#1a1a1a',
                  width: '100%',
                  background: 'transparent',
                  border: 'none',
                  borderBottom: '1px solid rgba(0,0,0,0.15)',
                  padding: '8px 0',
                  outline: 'none',
                  boxSizing: 'border-box' as const,
                }}
              />
            </div>

            {/* Bio */}
            <div>
              <label style={{
                fontFamily: GEIST,
                fontSize: '0.6875rem',
                fontWeight: 500,
                letterSpacing: '0.09em',
                textTransform: 'uppercase' as const,
                color: '#b0b0b0',
                display: 'block',
                marginBottom: 10,
              }}>
                Bio
              </label>
              <textarea
                name="bio"
                rows={4}
                placeholder="Tell people about yourself…"
                style={{
                  fontFamily: GEIST,
                  fontSize: '0.9375rem',
                  fontWeight: 300,
                  color: '#1a1a1a',
                  lineHeight: 1.7,
                  width: '100%',
                  background: '#fafafa',
                  border: '1px solid rgba(0,0,0,0.08)',
                  borderRadius: 12,
                  padding: '14px 16px',
                  outline: 'none',
                  resize: 'none' as const,
                  boxSizing: 'border-box' as const,
                }}
              />
            </div>

            {/* Category */}
            <div>
              <label style={{
                fontFamily: GEIST,
                fontSize: '0.6875rem',
                fontWeight: 500,
                letterSpacing: '0.09em',
                textTransform: 'uppercase' as const,
                color: '#b0b0b0',
                display: 'block',
                marginBottom: 10,
              }}>
                Category
              </label>
              <select
                name="category"
                className="sona-input"
                style={{
                  fontFamily: GEIST,
                  fontSize: '0.9375rem',
                  fontWeight: 300,
                  color: '#1a1a1a',
                  width: '100%',
                  background: 'transparent',
                  border: 'none',
                  borderBottom: '1px solid rgba(0,0,0,0.15)',
                  padding: '8px 0',
                  outline: 'none',
                  cursor: 'pointer',
                  appearance: 'none' as const,
                  WebkitAppearance: 'none' as const,
                  backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='8' viewBox='0 0 12 8'%3E%3Cpath d='M1 1l5 5 5-5' stroke='%23b0b0b0' stroke-width='1.5' fill='none' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E")`,
                  backgroundRepeat: 'no-repeat',
                  backgroundPosition: 'right 4px center',
                  paddingRight: 24,
                  boxSizing: 'border-box' as const,
                }}
              >
                {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>

            {/* Tags */}
            <div>
              <label style={{
                fontFamily: GEIST,
                fontSize: '0.6875rem',
                fontWeight: 500,
                letterSpacing: '0.09em',
                textTransform: 'uppercase' as const,
                color: '#b0b0b0',
                display: 'block',
                marginBottom: 10,
              }}>
                Tags <span style={{ fontWeight: 300, textTransform: 'none' as const, letterSpacing: 0 }}>— optional</span>
              </label>
              <input
                name="tags"
                placeholder="e.g. startups, investing, leadership"
                className="sona-input"
                style={{
                  fontFamily: GEIST,
                  fontSize: '0.9375rem',
                  fontWeight: 300,
                  color: '#1a1a1a',
                  width: '100%',
                  background: 'transparent',
                  border: 'none',
                  borderBottom: '1px solid rgba(0,0,0,0.15)',
                  padding: '8px 0',
                  outline: 'none',
                  boxSizing: 'border-box' as const,
                }}
              />
            </div>

            <div style={{ display: 'flex' }}>
              <button
                type="submit"
                className="sona-btn-dark"
                style={{
                  fontFamily: GEIST,
                  fontSize: '0.9375rem',
                  fontWeight: 500,
                  letterSpacing: '-0.01em',
                  padding: '12px 36px',
                  borderRadius: '980px',
                  background: '#1a1a1a',
                  color: '#fff',
                  border: 'none',
                  cursor: 'pointer',
                }}
              >
                Continue
              </button>
            </div>

          </form>
        </>
      )}

      {/* ── Step 2: Verify ──────────────────────────────────────── */}
      {step === '2' && verifiedPortraitId && (
        <>
          <h1 style={{
            fontFamily: CORMORANT,
            fontSize: 'clamp(1.75rem, 3vw, 2.25rem)',
            fontWeight: 400,
            fontStyle: 'italic',
            lineHeight: 1.1,
            letterSpacing: '-0.02em',
            color: '#1a1a1a',
            margin: '0 0 8px',
          }}>
            Help us find you online
          </h1>
          <p style={{
            fontFamily: GEIST,
            fontSize: '0.875rem',
            fontWeight: 300,
            color: '#6b6b6b',
            margin: '0 0 40px',
            lineHeight: 1.6,
          }}>
            We&apos;ll research you on the web to enrich your Sona. All fields are optional.
          </p>
          <VerifyStep portraitId={verifiedPortraitId} />
        </>
      )}

      {/* ── Step 3: Interview ───────────────────────────────────── */}
      {step === '3' && verifiedPortraitId && (
        <>
          <h1 style={{
            fontFamily: CORMORANT,
            fontSize: 'clamp(1.75rem, 3vw, 2.25rem)',
            fontWeight: 400,
            fontStyle: 'italic',
            lineHeight: 1.1,
            letterSpacing: '-0.02em',
            color: '#1a1a1a',
            margin: '0 0 8px',
          }}>
            Schedule your interview
          </h1>
          <p style={{
            fontFamily: GEIST,
            fontSize: '0.875rem',
            fontWeight: 300,
            color: '#6b6b6b',
            margin: '0 0 40px',
            lineHeight: 1.6,
          }}>
            We'll conduct a WhatsApp conversation to capture your voice, beliefs, and values.
          </p>
          <InterviewStep portraitId={verifiedPortraitId} />
        </>
      )}

      {/* ── Step 4: Content ─────────────────────────────────────── */}
      {step === '4' && verifiedPortraitId && (
        <div style={{ textAlign: 'center' }}>
          <h1 style={{
            fontFamily: CORMORANT,
            fontSize: 'clamp(1.75rem, 3vw, 2.25rem)',
            fontWeight: 400,
            fontStyle: 'italic',
            lineHeight: 1.2,
            letterSpacing: '-0.02em',
            color: '#1a1a1a',
            margin: '0 0 10px',
          }}>
            Add content to enrich your Sona
          </h1>
          <p style={{
            fontFamily: GEIST,
            fontSize: '0.9375rem',
            fontWeight: 300,
            color: '#6b6b6b',
            margin: '0 auto 36px',
            lineHeight: 1.7,
            maxWidth: 380,
          }}>
            Upload writings, interviews, or talks. This is optional — you can always add content from your dashboard later.
          </p>
          <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
            <a
              href={`/dashboard/content?portrait_id=${verifiedPortraitId}`}
              className="sona-btn-outline"
              style={{
                fontFamily: GEIST,
                display: 'inline-block',
                fontSize: '0.9375rem',
                fontWeight: 400,
                letterSpacing: '-0.01em',
                padding: '12px 28px',
                borderRadius: '980px',
                border: '1px solid rgba(0,0,0,0.18)',
                color: '#1a1a1a',
                textDecoration: 'none',
              }}
            >
              Add context
            </a>
            <a
              href={`/dashboard/create?step=5&portrait_id=${encodeURIComponent(verifiedPortraitId)}`}
              className="sona-btn-dark"
              style={{
                fontFamily: GEIST,
                display: 'inline-block',
                fontSize: '0.9375rem',
                fontWeight: 500,
                letterSpacing: '-0.01em',
                padding: '12px 28px',
                borderRadius: '980px',
                background: '#1a1a1a',
                color: '#fff',
                textDecoration: 'none',
              }}
            >
              Skip for now
            </a>
          </div>
        </div>
      )}

      {/* ── Step 5: Pricing ─────────────────────────────────────── */}
      {step === '5' && verifiedPortraitId && (
        <>
          <h1 style={{
            fontFamily: CORMORANT,
            fontSize: 'clamp(1.75rem, 3vw, 2.25rem)',
            fontWeight: 400,
            fontStyle: 'italic',
            lineHeight: 1.1,
            letterSpacing: '-0.02em',
            color: '#1a1a1a',
            margin: '0 0 8px',
          }}>
            Set your price
          </h1>
          <p style={{
            fontFamily: GEIST,
            fontSize: '0.875rem',
            fontWeight: 300,
            color: '#6b6b6b',
            margin: '0 0 40px',
            lineHeight: 1.6,
          }}>
            Subscribers pay this monthly to access your full Sona. You can always offer it free.
          </p>
          <PricingStep portraitId={verifiedPortraitId} />
        </>
      )}

    </div>
  )
}
