import { createServerSupabaseClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { InterviewStep } from '../create/InterviewStep'

const GEIST = 'var(--font-geist-sans)'
const CORMORANT = 'var(--font-cormorant)'

const WHILE_YOU_WAIT = [
  {
    href: '/dashboard/content',
    label: 'Add content',
    description: 'Upload writings, talks, or documents to enrich your Sona',
  },
  {
    href: '/dashboard/settings',
    label: 'Review your profile',
    description: 'Polish your bio, tagline, and pricing before you go live',
  },
  {
    href: '/explore',
    label: 'Explore other Sonas',
    description: 'See how others have built their presence',
  },
]

export default async function DashboardInterviewPage() {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: portrait } = await supabase
    .from('portraits')
    .select('id, display_name')
    .eq('creator_id', user.id)
    .maybeSingle()

  if (!portrait) redirect('/dashboard/create')

  const { data: existing } = await supabase
    .from('interview_requests')
    .select('status, scheduled_at')
    .eq('portrait_id', portrait.id)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  return (
    <div style={{ maxWidth: 520 }}>

      {/* ── Page header ─────────────────────────────────────────── */}
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
        Interview
      </h1>
      <p style={{
        fontFamily: GEIST,
        fontSize: '0.875rem',
        fontWeight: 300,
        color: '#6b6b6b',
        margin: '0 0 40px',
        lineHeight: 1.6,
      }}>
        We conduct a WhatsApp conversation to capture your voice, beliefs, and values — the foundation of your Sona.
      </p>

      {existing ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 32 }}>

          {/* Status card */}
          <div style={{
            border: '1px solid rgba(0,0,0,0.08)',
            borderRadius: 16,
            padding: '24px',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
              <span style={{
                width: 7,
                height: 7,
                borderRadius: '50%',
                backgroundColor: '#DE3E7B',
                flexShrink: 0,
                display: 'inline-block',
              }} />
              <p style={{
                fontFamily: GEIST,
                fontSize: '0.6875rem',
                fontWeight: 500,
                letterSpacing: '0.09em',
                textTransform: 'uppercase',
                color: '#b0b0b0',
                margin: 0,
              }}>
                Interview request received
              </p>
            </div>
            <p style={{
              fontFamily: CORMORANT,
              fontSize: '1.375rem',
              fontWeight: 400,
              fontStyle: 'italic',
              color: '#1a1a1a',
              margin: '0 0 6px',
              lineHeight: 1.3,
              textTransform: 'capitalize',
            }}>
              {existing.status}
              {existing.scheduled_at && (
                <span style={{ fontStyle: 'normal', fontWeight: 300, color: '#6b6b6b' }}>
                  {' '}· {new Date(existing.scheduled_at).toLocaleDateString('en-US', { dateStyle: 'long' })}
                </span>
              )}
            </p>
            <p style={{
              fontFamily: GEIST,
              fontSize: '0.8125rem',
              fontWeight: 300,
              color: '#b0b0b0',
              margin: 0,
            }}>
              We'll be in touch via WhatsApp to confirm a time.
            </p>
          </div>

          {/* While you wait */}
          <div>
            <p style={{
              fontFamily: GEIST,
              fontSize: '0.6875rem',
              fontWeight: 500,
              letterSpacing: '0.09em',
              textTransform: 'uppercase',
              color: '#b0b0b0',
              margin: '0 0 12px',
            }}>
              While you wait
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {WHILE_YOU_WAIT.map(item => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="sona-card"
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: 16,
                    padding: '16px 20px',
                    backgroundColor: '#fff',
                    border: '1px solid rgba(0,0,0,0.07)',
                    borderRadius: 14,
                    textDecoration: 'none',
                  }}
                >
                  <div>
                    <p style={{
                      fontFamily: GEIST,
                      fontSize: '0.875rem',
                      fontWeight: 400,
                      color: '#1a1a1a',
                      margin: '0 0 2px',
                    }}>
                      {item.label}
                    </p>
                    <p style={{
                      fontFamily: GEIST,
                      fontSize: '0.75rem',
                      fontWeight: 300,
                      color: '#b0b0b0',
                      margin: 0,
                    }}>
                      {item.description}
                    </p>
                  </div>
                  <span style={{ color: 'rgba(0,0,0,0.2)', flexShrink: 0 }}>→</span>
                </Link>
              ))}
            </div>
          </div>

        </div>
      ) : (
        <InterviewStep portraitId={portrait.id} returnHref="/dashboard" />
      )}

    </div>
  )
}
