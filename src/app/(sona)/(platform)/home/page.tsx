import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { formatDistanceToNow } from 'date-fns'

const GEIST = 'var(--font-geist-sans)'
const CORMORANT = 'var(--font-cormorant)'

export const metadata = { title: 'My Circle — Sona' }

export default async function HomePage() {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // Own portrait (if creator)
  const { data: ownPortrait } = await supabase
    .from('portraits')
    .select('id, slug, display_name, avatar_url')
    .eq('creator_id', user.id)
    .maybeSingle()

  // Subscribed Sonas
  const { data: subscriptions } = await supabase
    .from('subscriptions')
    .select('id, portrait_id, portraits(id, slug, display_name, avatar_url)')
    .eq('subscriber_id', user.id)
    .eq('status', 'active')
    .order('created_at', { ascending: false })

  // Last conversation per portrait — scoped to subscribed portrait IDs only
  const portraitIds = (subscriptions ?? []).map((s) => s.portrait_id).filter(Boolean)
  const { data: conversations } = portraitIds.length > 0
    ? await supabase
        .from('conversations')
        .select('portrait_id, updated_at')
        .eq('user_id', user.id)
        .in('portrait_id', portraitIds)
        .order('updated_at', { ascending: false })
    : { data: [] }

  // Build a map: portrait_id → most recent updated_at
  const lastActive: Record<string, string> = {}
  for (const c of conversations ?? []) {
    if (c.portrait_id && c.updated_at && !lastActive[c.portrait_id]) {
      lastActive[c.portrait_id] = c.updated_at
    }
  }

  return (
    <main style={{ minHeight: '100vh', backgroundColor: '#fff' }}>
      <div style={{
        maxWidth: 720,
        margin: '0 auto',
        padding: '56px clamp(24px, 4vw, 48px) 96px',
      }}>

        {/* ── Page header ─────────────────────────────────────────── */}
        <h1 style={{
          fontFamily: CORMORANT,
          fontSize: 'clamp(2rem, 4vw, 2.75rem)',
          fontWeight: 400,
          fontStyle: 'italic',
          letterSpacing: '-0.02em',
          color: '#1a1a1a',
          margin: '0 0 48px',
        }}>
          My Circle
        </h1>

        {/* ── Own Sona (creator only) ──────────────────────────────── */}
        {ownPortrait && (
          <section style={{ marginBottom: 48 }}>
            <p style={{
              fontFamily: GEIST, fontSize: '0.6875rem', fontWeight: 500,
              letterSpacing: '0.09em', textTransform: 'uppercase',
              color: '#b0b0b0', margin: '0 0 16px',
            }}>
              Your Sona
            </p>
            <div style={{
              display: 'flex', alignItems: 'center', gap: 16,
              padding: '16px 20px',
              border: '1px solid rgba(0,0,0,0.07)', borderRadius: 14,
            }}>
              {ownPortrait.avatar_url ? (
                <img src={ownPortrait.avatar_url} alt={ownPortrait.display_name}
                  style={{ width: 44, height: 44, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} />
              ) : (
                <div style={{
                  width: 44, height: 44, borderRadius: '50%',
                  backgroundColor: 'rgba(0,0,0,0.04)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                }}>
                  <span style={{ fontFamily: CORMORANT, fontSize: '1.25rem', fontStyle: 'italic', color: '#1a1a1a' }}>
                    {ownPortrait.display_name?.[0] ?? '?'}
                  </span>
                </div>
              )}
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{
                  fontFamily: CORMORANT, fontSize: '1.125rem', fontWeight: 400,
                  fontStyle: 'italic', color: '#1a1a1a', margin: 0, lineHeight: 1.2,
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                }}>
                  {ownPortrait.display_name}
                </p>
              </div>
              <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
                <Link href={`/sona/${ownPortrait.slug}`} style={{
                  fontFamily: GEIST, fontSize: '0.8125rem', fontWeight: 400,
                  color: '#6b6b6b', textDecoration: 'none',
                  padding: '7px 16px', borderRadius: '980px',
                  border: '1px solid rgba(0,0,0,0.08)',
                }}>View</Link>
                <Link href="/dashboard" style={{
                  fontFamily: GEIST, fontSize: '0.8125rem', fontWeight: 500,
                  color: '#fff', textDecoration: 'none',
                  padding: '7px 16px', borderRadius: '980px',
                  backgroundColor: '#1a1a1a',
                }}>Manage</Link>
              </div>
            </div>
          </section>
        )}

        {/* ── Circle ──────────────────────────────────────────────── */}
        <section>
          <p style={{
            fontFamily: GEIST, fontSize: '0.6875rem', fontWeight: 500,
            letterSpacing: '0.09em', textTransform: 'uppercase',
            color: '#b0b0b0', margin: '0 0 16px',
          }}>
            Your circle
          </p>

          {subscriptions && subscriptions.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {subscriptions.map((sub) => {
                const portrait = sub.portraits as any
                const ts = lastActive[sub.portrait_id]
                const lastSeen = ts
                  ? formatDistanceToNow(new Date(ts), { addSuffix: true })
                  : null

                return (
                  <Link
                    key={sub.id}
                    href={`/sona/${portrait.slug}`}
                    className="sona-card"
                    style={{
                      display: 'flex', alignItems: 'center', gap: 16,
                      padding: '16px 20px', backgroundColor: '#fff',
                      border: '1px solid rgba(0,0,0,0.07)', borderRadius: 14,
                      textDecoration: 'none',
                    }}
                  >
                    {portrait.avatar_url ? (
                      <img src={portrait.avatar_url} alt={portrait.display_name}
                        style={{ width: 44, height: 44, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} />
                    ) : (
                      <div style={{
                        width: 44, height: 44, borderRadius: '50%',
                        backgroundColor: 'rgba(0,0,0,0.04)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                      }}>
                        <span style={{ fontFamily: CORMORANT, fontSize: '1.25rem', fontStyle: 'italic', color: '#1a1a1a' }}>
                          {portrait.display_name?.[0] ?? '?'}
                        </span>
                      </div>
                    )}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{
                        fontFamily: CORMORANT, fontSize: '1.125rem', fontWeight: 400,
                        fontStyle: 'italic', color: '#1a1a1a', margin: 0, lineHeight: 1.2,
                        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                      }}>
                        {portrait.display_name}
                      </p>
                      {lastSeen && (
                        <p style={{
                          fontFamily: GEIST, fontSize: '0.75rem', fontWeight: 300,
                          color: '#b0b0b0', margin: '2px 0 0',
                        }}>
                          {lastSeen}
                        </p>
                      )}
                    </div>
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="#c0c0c0" strokeWidth="1.5" strokeLinecap="round">
                      <path d="M6 3l5 5-5 5" />
                    </svg>
                  </Link>
                )
              })}
            </div>
          ) : (
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
              gap: 16,
            }}>

              {/* Card 1 — context-aware */}
              {ownPortrait ? (
                <div style={{
                  border: '1px solid rgba(0,0,0,0.07)',
                  borderRadius: 16,
                  padding: '32px 28px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 16,
                }}>
                  <p style={{
                    fontFamily: CORMORANT,
                    fontSize: '1.375rem',
                    fontWeight: 400,
                    fontStyle: 'italic',
                    letterSpacing: '-0.01em',
                    color: '#1a1a1a',
                    margin: 0,
                    lineHeight: 1.25,
                  }}>
                    Be present. Even when you can&apos;t be.
                  </p>
                  <p style={{
                    fontFamily: GEIST,
                    fontSize: '0.875rem',
                    fontWeight: 300,
                    color: '#6b6b6b',
                    margin: 0,
                    lineHeight: 1.65,
                  }}>
                    Your Sona carries your perspective into every conversation. Add context, expand your circle, and track who&apos;s listening from your dashboard.
                  </p>
                  <div>
                    <Link href="/dashboard" style={{
                      fontFamily: GEIST,
                      fontSize: '0.875rem',
                      fontWeight: 500,
                      color: '#fff',
                      backgroundColor: '#1a1a1a',
                      borderRadius: '980px',
                      padding: '10px 24px',
                      textDecoration: 'none',
                      display: 'inline-block',
                    }}>
                      Go to dashboard
                    </Link>
                  </div>
                </div>
              ) : (
                <div style={{
                  border: '1px solid rgba(0,0,0,0.07)',
                  borderRadius: 16,
                  padding: '32px 28px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 16,
                }}>
                  <p style={{
                    fontFamily: CORMORANT,
                    fontSize: '1.375rem',
                    fontWeight: 400,
                    fontStyle: 'italic',
                    letterSpacing: '-0.01em',
                    color: '#1a1a1a',
                    margin: 0,
                    lineHeight: 1.25,
                  }}>
                    Your whole self, present when it matters.
                  </p>
                  <p style={{
                    fontFamily: GEIST,
                    fontSize: '0.875rem',
                    fontWeight: 300,
                    color: '#6b6b6b',
                    margin: 0,
                    lineHeight: 1.65,
                  }}>
                    Share your knowledge, perspective, and way of thinking — with the people who matter, at the depth you choose. From open discovery to a private inner circle, you set the limits.
                  </p>
                  <div>
                    <Link href="/dashboard/create" style={{
                      fontFamily: GEIST,
                      fontSize: '0.875rem',
                      fontWeight: 500,
                      color: '#fff',
                      backgroundColor: '#1a1a1a',
                      borderRadius: '980px',
                      padding: '10px 24px',
                      textDecoration: 'none',
                      display: 'inline-block',
                    }}>
                      Create your Sona
                    </Link>
                  </div>
                </div>
              )}

              {/* Card 2 — always shown */}
              <div style={{
                border: '1px solid rgba(0,0,0,0.07)',
                borderRadius: 16,
                padding: '32px 28px',
                display: 'flex',
                flexDirection: 'column',
                gap: 16,
              }}>
                <p style={{
                  fontFamily: CORMORANT,
                  fontSize: '1.375rem',
                  fontWeight: 400,
                  fontStyle: 'italic',
                  letterSpacing: '-0.01em',
                  color: '#1a1a1a',
                  margin: 0,
                  lineHeight: 1.25,
                }}>
                  The right mind in the room.
                </p>
                <p style={{
                  fontFamily: GEIST,
                  fontSize: '0.875rem',
                  fontWeight: 300,
                  color: '#6b6b6b',
                  margin: 0,
                  lineHeight: 1.65,
                }}>
                  Build a circle of Sonas from thinkers, leaders, and people who inspire you. Their insights stay with you — a collection of minds to turn to whenever you need perspective, wisdom, or a second opinion.
                </p>
                <div>
                  <Link href="/explore" style={{
                    fontFamily: GEIST,
                    fontSize: '0.875rem',
                    fontWeight: 500,
                    color: '#fff',
                    backgroundColor: '#1a1a1a',
                    borderRadius: '980px',
                    padding: '10px 24px',
                    textDecoration: 'none',
                    display: 'inline-block',
                  }}>
                    Discover Sonas
                  </Link>
                </div>
              </div>

            </div>
          )}
        </section>

      </div>
    </main>
  )
}
