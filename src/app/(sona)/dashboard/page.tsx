import { createServerSupabaseClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'

const GEIST = 'var(--font-geist-sans)'
const CORMORANT = 'var(--font-cormorant)'

const UNLOCKS = [
  { count: 25,  label: 'Inner circle interviews' },
  { count: 100, label: 'Analytics dashboard' },
  { count: 250, label: 'Custom domain' },
]

const INTERVIEW_STATUS_LABEL: Record<string, string> = {
  pending:   'Pending — we\'ll be in touch via WhatsApp',
  scheduled: 'Scheduled',
  completed: 'Completed',
}

export default async function DashboardPage() {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: portrait } = await (supabase as any)
    .from('portraits')
    .select('id, display_name, slug, is_public, monthly_price_cents, synthesis_status, last_synthesised_at')
    .eq('creator_id', user.id)
    .maybeSingle() as { data: {
      id: string
      display_name: string
      slug: string
      is_public: boolean
      monthly_price_cents: number | null
      synthesis_status: string
      last_synthesised_at: string | null
    } | null }

  if (!portrait) redirect('/dashboard/create')

  const { data: stats } = await supabase
    .from('portrait_discovery')
    .select('subscriber_count')
    .eq('id', portrait.id)
    .maybeSingle()

  const subscriberCount = Number(stats?.subscriber_count ?? 0)
  const mrr = portrait.monthly_price_cents
    ? (subscriberCount * portrait.monthly_price_cents) / 100
    : 0

  const { data: interviewRequest } = await supabase
    .from('interview_requests')
    .select('status')
    .eq('portrait_id', portrait.id)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  const { count: chunkCount } = await supabase
    .from('knowledge_chunks')
    .select('id', { count: 'exact', head: true })
    .eq('portrait_id', portrait.id)

  const hasContent = (chunkCount ?? 0) > 0

  const nextAction = !portrait.is_public
    ? !interviewRequest
      ? { label: 'Schedule your interview', description: 'Book your WhatsApp interview to get your Sona live.', href: '/dashboard/interview', cta: 'Schedule now' }
      : !hasContent
        ? { label: 'Add content while you wait', description: 'Upload writings, talks, or documents to enrich your Sona before launch.', href: '/dashboard/content', cta: 'Add content' }
        : null
    : null

  const setupSteps = [
    {
      label: 'Create your Sona',
      description: 'Name, bio, and category',
      done: true,
      href: '/dashboard/settings',
    },
    {
      label: 'WhatsApp interview',
      description: interviewRequest
        ? (INTERVIEW_STATUS_LABEL[interviewRequest.status] ?? interviewRequest.status)
        : 'We\'ll capture your voice and values',
      done: !!interviewRequest,
      href: '/dashboard/interview',
    },
    {
      label: 'Add content',
      description: hasContent ? 'Content uploaded' : 'Optional — upload writings, talks, or documents',
      done: hasContent,
      href: '/dashboard/content',
      optional: true,
    },
    {
      label: 'Set your pricing',
      description: portrait.monthly_price_cents
        ? `$${(portrait.monthly_price_cents / 100).toFixed(0)}/month`
        : 'Free',
      done: true,
      href: '/dashboard/settings',
    },
  ]

  const allRequiredDone = !!interviewRequest

  return (
    <div style={{ maxWidth: 680 }}>

      {/* ── Synthesis nudge ──────────────────────────────────────── */}
      {portrait.synthesis_status === 'never' && (
        <div style={{
          border: '1px solid rgba(0,0,0,0.07)',
          borderRadius: 12,
          padding: '1rem 1.5rem',
          marginBottom: '1.5rem',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}>
          <p style={{ fontFamily: GEIST, fontSize: '0.875rem', color: '#6b6b6b', margin: 0 }}>
            Your Sona&rsquo;s depth hasn&rsquo;t been built yet. Add content and deepen it.
          </p>
          <a href="/dashboard/mind" style={{
            fontFamily: GEIST,
            fontSize: '0.875rem',
            color: '#1a1a1a',
            textDecoration: 'none',
          }}>
            Go to Mind →
          </a>
        </div>
      )}

      {/* ── Page header ─────────────────────────────────────────── */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 40, gap: 16 }}>
        <div>
          <h1 style={{
            fontFamily: CORMORANT,
            fontSize: 'clamp(1.75rem, 3vw, 2.5rem)',
            fontWeight: 400,
            fontStyle: 'italic',
            lineHeight: 1.1,
            letterSpacing: '-0.02em',
            color: '#1a1a1a',
            margin: '0 0 6px',
          }}>
            {portrait.display_name}
          </h1>
          <p style={{
            fontFamily: GEIST,
            fontSize: '0.8125rem',
            fontWeight: 300,
            color: portrait.is_public ? '#9b9b9b' : '#b0b0b0',
            margin: 0,
          }}>
            {portrait.is_public ? 'Live' : allRequiredDone ? 'In review' : 'Not yet live'}
          </p>
        </div>
        {portrait.is_public && (
          <Link
            href={`/sona/${portrait.slug}`}
            target="_blank"
            className="sona-link"
            style={{
              fontFamily: GEIST,
              fontSize: '0.8125rem',
              color: '#6b6b6b',
              textDecoration: 'none',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 4,
              paddingTop: 6,
              flexShrink: 0,
            }}
          >
            View public page <span aria-hidden>↗</span>
          </Link>
        )}
      </div>

      {/* ── Next action banner ───────────────────────────────────── */}
      {nextAction && (
        <Link
          href={nextAction.href}
          className="sona-btn-dark"
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 16,
            padding: '24px 28px',
            borderRadius: 18,
            background: '#1a1a1a',
            textDecoration: 'none',
            marginBottom: 32,
          }}
        >
          <div>
            <p style={{
              fontFamily: GEIST,
              fontSize: '0.6875rem',
              fontWeight: 500,
              letterSpacing: '0.09em',
              textTransform: 'uppercase',
              color: 'rgba(255,255,255,0.4)',
              margin: '0 0 6px',
            }}>
              Recommended next step
            </p>
            <p style={{
              fontFamily: CORMORANT,
              fontSize: '1.375rem',
              fontWeight: 400,
              fontStyle: 'italic',
              color: '#fff',
              margin: '0 0 4px',
              lineHeight: 1.2,
            }}>
              {nextAction.label}
            </p>
            <p style={{
              fontFamily: GEIST,
              fontSize: '0.8125rem',
              fontWeight: 300,
              color: 'rgba(255,255,255,0.5)',
              margin: 0,
            }}>
              {nextAction.description}
            </p>
          </div>
          <span style={{
            color: 'rgba(255,255,255,0.4)',
            fontSize: '1.25rem',
            flexShrink: 0,
          }}>
            →
          </span>
        </Link>
      )}

      {/* ── Setup checklist ─────────────────────────────────────── */}
      {!portrait.is_public && (
        <div style={{
          border: '1px solid rgba(0,0,0,0.07)',
          borderRadius: 18,
          padding: '28px 24px',
          marginBottom: 32,
          backgroundColor: '#fff',
        }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 24, gap: 12 }}>
            <div>
              <p style={{
                fontFamily: GEIST,
                fontSize: '0.875rem',
                fontWeight: 500,
                color: '#1a1a1a',
                margin: '0 0 4px',
              }}>
                Getting your Sona live
              </p>
              <p style={{
                fontFamily: GEIST,
                fontSize: '0.8125rem',
                fontWeight: 300,
                color: '#b0b0b0',
                margin: 0,
              }}>
                {allRequiredDone
                  ? 'Interview requested — we\'ll notify you when you\'re live.'
                  : 'Complete the steps below to launch.'}
              </p>
            </div>
            {allRequiredDone && (
              <span style={{
                fontFamily: GEIST,
                fontSize: '0.6875rem',
                fontWeight: 500,
                letterSpacing: '0.05em',
                color: '#b08850',
                backgroundColor: '#fef9ef',
                padding: '4px 10px',
                borderRadius: '980px',
                flexShrink: 0,
              }}>
                In review
              </span>
            )}
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {setupSteps.map((step) => (
              <Link
                key={step.label}
                href={step.href}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 14,
                  padding: '10px 12px',
                  borderRadius: 10,
                  textDecoration: 'none',
                  transition: 'background-color 0.15s ease',
                }}
                className="sona-row-hover"
              >
                {/* Step indicator */}
                <div style={{
                  width: 20,
                  height: 20,
                  borderRadius: '50%',
                  flexShrink: 0,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: step.done ? '#DE3E7B' : 'transparent',
                  border: step.done ? 'none' : '1.5px solid rgba(0,0,0,0.15)',
                }}>
                  {step.done && (
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round">
                      <path d="M5 13l4 4L19 7" />
                    </svg>
                  )}
                </div>

                {/* Text */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{
                      fontFamily: GEIST,
                      fontSize: '0.875rem',
                      fontWeight: step.done ? 300 : 400,
                      color: step.done ? '#b0b0b0' : '#1a1a1a',
                      textDecoration: step.done ? 'line-through' : 'none',
                      textDecorationColor: 'rgba(0,0,0,0.2)',
                    }}>
                      {step.label}
                    </span>
                    {step.optional && (
                      <span style={{
                        fontFamily: GEIST,
                        fontSize: '0.6875rem',
                        color: '#c0c0c0',
                      }}>
                        optional
                      </span>
                    )}
                  </div>
                  <p style={{
                    fontFamily: GEIST,
                    fontSize: '0.75rem',
                    fontWeight: 300,
                    color: '#c0c0c0',
                    margin: '1px 0 0',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}>
                    {step.description}
                  </p>
                </div>

                <span style={{ color: 'rgba(0,0,0,0.18)', fontSize: '0.875rem', flexShrink: 0 }}>→</span>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* ── Stats ────────────────────────────────────────────────── */}
      {portrait.is_public && (
        <div style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: 12,
          marginBottom: 32,
        }}>
          {[
            { label: 'Subscribers', value: subscriberCount.toLocaleString() },
            { label: 'Monthly revenue', value: mrr > 0 ? `$${mrr.toFixed(0)}` : '—' },
          ].map(({ label, value }) => (
            <div key={label} style={{
              backgroundColor: '#fff',
              border: '1px solid rgba(0,0,0,0.07)',
              borderRadius: 16,
              padding: '24px',
            }}>
              <p style={{
                fontFamily: GEIST,
                fontSize: '0.75rem',
                fontWeight: 400,
                color: '#b0b0b0',
                margin: '0 0 8px',
                letterSpacing: '0.02em',
              }}>
                {label}
              </p>
              <p style={{
                fontFamily: CORMORANT,
                fontSize: '2.5rem',
                fontWeight: 400,
                fontStyle: 'italic',
                color: '#1a1a1a',
                margin: 0,
                lineHeight: 1,
                letterSpacing: '-0.02em',
              }}>
                {value}
              </p>
            </div>
          ))}
        </div>
      )}

      {/* ── Unlocks ──────────────────────────────────────────────── */}
      {portrait.is_public && (
        <div style={{
          backgroundColor: '#fff',
          border: '1px solid rgba(0,0,0,0.07)',
          borderRadius: 16,
          padding: '24px',
        }}>
          <p style={{
            fontFamily: GEIST,
            fontSize: '0.6875rem',
            fontWeight: 500,
            letterSpacing: '0.09em',
            textTransform: 'uppercase',
            color: '#b0b0b0',
            margin: '0 0 16px',
          }}>
            Unlock more
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
            {UNLOCKS.map(({ count, label }, i) => {
              const unlocked = subscriberCount >= count
              return (
                <div
                  key={count}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '12px 0',
                    borderTop: i > 0 ? '1px solid rgba(0,0,0,0.05)' : 'none',
                    opacity: unlocked ? 1 : 0.4,
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span style={{
                      width: 6,
                      height: 6,
                      borderRadius: '50%',
                      backgroundColor: unlocked ? '#DE3E7B' : 'rgba(0,0,0,0.2)',
                      flexShrink: 0,
                      display: 'inline-block',
                    }} />
                    <span style={{
                      fontFamily: GEIST,
                      fontSize: '0.875rem',
                      fontWeight: 300,
                      color: '#1a1a1a',
                    }}>
                      {label}
                    </span>
                  </div>
                  <span style={{
                    fontFamily: GEIST,
                    fontSize: '0.6875rem',
                    fontWeight: 500,
                    color: unlocked ? '#DE3E7B' : '#c0c0c0',
                    letterSpacing: '0.03em',
                  }}>
                    {unlocked ? 'Unlocked' : `${count} subscribers`}
                  </span>
                </div>
              )
            })}
          </div>
        </div>
      )}

    </div>
  )
}
