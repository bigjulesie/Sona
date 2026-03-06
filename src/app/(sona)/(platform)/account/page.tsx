import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { BillingPortalButton } from './BillingPortalButton'
import { AccountSync } from './AccountSync'

const GEIST = 'var(--font-geist-sans)'
const CORMORANT = 'var(--font-cormorant)'

const STATUS_LABEL: Record<string, string> = {
  active: 'Active',
  past_due: 'Past due',
  cancelled: 'Cancelled',
  canceled: 'Cancelled',
}

export default async function AccountPage() {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: subscriptions } = await supabase
    .from('subscriptions')
    .select('id, status, portraits(id, slug, display_name, avatar_url, monthly_price_cents)')
    .eq('subscriber_id', user.id)
    .order('created_at', { ascending: false })

  const { data: profile } = await supabase
    .from('profiles')
    .select('stripe_customer_id')
    .eq('id', user.id)
    .single()

  const { data: ownPortrait } = await supabase
    .from('portraits')
    .select('id, slug, display_name, avatar_url')
    .eq('profile_id', user.id)
    .maybeSingle()

  return (
    <main style={{ minHeight: '100vh', backgroundColor: '#fff' }}>
      <AccountSync />
      <div style={{
        maxWidth: 720,
        margin: '0 auto',
        padding: '56px clamp(24px, 4vw, 48px) 96px',
      }}>

        {/* ── Page header ─────────────────────────────────────────── */}
        <div style={{ marginBottom: 48 }}>
          <h1 style={{
            fontFamily: CORMORANT,
            fontSize: 'clamp(2rem, 4vw, 2.75rem)',
            fontWeight: 400,
            fontStyle: 'italic',
            lineHeight: 1.1,
            letterSpacing: '-0.02em',
            color: '#1a1a1a',
            margin: '0 0 8px',
          }}>
            Account
          </h1>
          <p style={{
            fontFamily: GEIST,
            fontSize: '0.875rem',
            fontWeight: 300,
            color: '#b0b0b0',
            margin: 0,
          }}>
            {user.email}
          </p>
        </div>

        {/* ── Your Sona ───────────────────────────────────────────── */}
        <section style={{ marginBottom: 48 }}>
          <p style={{
            fontFamily: GEIST,
            fontSize: '0.6875rem',
            fontWeight: 500,
            letterSpacing: '0.09em',
            textTransform: 'uppercase',
            color: '#b0b0b0',
            margin: '0 0 16px',
          }}>
            Your Sona
          </p>

          {ownPortrait ? (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: 16,
              padding: '16px 20px',
              border: '1px solid rgba(0,0,0,0.07)',
              borderRadius: 14,
            }}>
              {/* Avatar */}
              {ownPortrait.avatar_url ? (
                <img
                  src={ownPortrait.avatar_url}
                  alt={ownPortrait.display_name}
                  style={{ width: 44, height: 44, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }}
                />
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

              {/* Name */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{
                  fontFamily: CORMORANT, fontSize: '1.125rem', fontWeight: 400,
                  fontStyle: 'italic', color: '#1a1a1a', margin: 0, lineHeight: 1.2,
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                }}>
                  {ownPortrait.display_name}
                </p>
              </div>

              {/* Actions */}
              <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
                <Link
                  href={`/sona/${ownPortrait.slug}`}
                  style={{
                    fontFamily: GEIST, fontSize: '0.8125rem', fontWeight: 400,
                    color: '#6b6b6b', textDecoration: 'none',
                    padding: '7px 16px', borderRadius: '980px',
                    border: '1px solid rgba(0,0,0,0.08)',
                  }}
                >
                  View
                </Link>
                <Link
                  href="/dashboard"
                  style={{
                    fontFamily: GEIST, fontSize: '0.8125rem', fontWeight: 500,
                    color: '#fff', textDecoration: 'none',
                    padding: '7px 16px', borderRadius: '980px',
                    backgroundColor: '#1a1a1a',
                  }}
                >
                  Manage
                </Link>
              </div>
            </div>
          ) : (
            <div style={{
              border: '1px solid rgba(0,0,0,0.07)', borderRadius: 14,
              padding: '28px 24px', textAlign: 'center',
            }}>
              <p style={{
                fontFamily: CORMORANT, fontSize: '1.25rem', fontWeight: 400,
                fontStyle: 'italic', color: '#1a1a1a', margin: '0 0 6px', lineHeight: 1.3,
              }}>
                You haven&apos;t created a Sona yet.
              </p>
              <p style={{
                fontFamily: GEIST, fontSize: '0.8125rem', fontWeight: 300,
                color: '#9b9b9b', margin: '0 0 20px',
              }}>
                Share your knowledge, story, or expertise.
              </p>
              <Link href="/dashboard/create" style={{
                fontFamily: GEIST, fontSize: '0.875rem', fontWeight: 500,
                letterSpacing: '-0.01em', color: '#fff', backgroundColor: '#1a1a1a',
                borderRadius: '980px', padding: '10px 24px',
                textDecoration: 'none', display: 'inline-block',
              }}>
                Create your Sona
              </Link>
            </div>
          )}
        </section>

        <div style={{ height: 1, backgroundColor: 'rgba(0,0,0,0.06)', marginBottom: 40 }} />

        {/* ── Subscriptions ───────────────────────────────────────── */}
        <section style={{ marginBottom: 48 }}>
          <p style={{
            fontFamily: GEIST,
            fontSize: '0.6875rem',
            fontWeight: 500,
            letterSpacing: '0.09em',
            textTransform: 'uppercase',
            color: '#b0b0b0',
            margin: '0 0 16px',
          }}>
            Your circle
          </p>

          {subscriptions && subscriptions.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {subscriptions.map(sub => {
                const portrait = sub.portraits as any
                const isPaid = portrait.monthly_price_cents != null && portrait.monthly_price_cents > 0
                const initial = portrait.display_name?.[0] ?? '?'
                const statusLabel = STATUS_LABEL[sub.status] ?? sub.status.replace('_', ' ')
                const isActive = sub.status === 'active'
                const isPastDue = sub.status === 'past_due'

                return (
                  <Link
                    key={sub.id}
                    href={`/sona/${portrait.slug}`}
                    className="sona-card"
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 16,
                      padding: '16px 20px',
                      backgroundColor: '#fff',
                      border: '1px solid rgba(0,0,0,0.07)',
                      borderRadius: 14,
                      textDecoration: 'none',
                    }}
                  >
                    {/* Avatar */}
                    {portrait.avatar_url ? (
                      <img
                        src={portrait.avatar_url}
                        alt={portrait.display_name}
                        style={{ width: 44, height: 44, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }}
                      />
                    ) : (
                      <div style={{
                        width: 44,
                        height: 44,
                        borderRadius: '50%',
                        backgroundColor: 'rgba(0,0,0,0.04)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0,
                      }}>
                        <span style={{
                          fontFamily: CORMORANT,
                          fontSize: '1.25rem',
                          fontStyle: 'italic',
                          fontWeight: 400,
                          color: '#1a1a1a',
                          lineHeight: 1,
                          userSelect: 'none',
                        }}>
                          {initial}
                        </span>
                      </div>
                    )}

                    {/* Name + price */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{
                        fontFamily: CORMORANT,
                        fontSize: '1.125rem',
                        fontWeight: 400,
                        fontStyle: 'italic',
                        color: '#1a1a1a',
                        margin: 0,
                        lineHeight: 1.2,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}>
                        {portrait.display_name}
                      </p>
                      <p style={{
                        fontFamily: GEIST,
                        fontSize: '0.75rem',
                        fontWeight: 300,
                        color: '#b0b0b0',
                        margin: '2px 0 0',
                      }}>
                        {isPaid
                          ? `$${(portrait.monthly_price_cents / 100).toFixed(0)}/mo`
                          : 'Free'}
                      </p>
                    </div>

                    {/* Status */}
                    <span style={{
                      fontFamily: GEIST,
                      fontSize: '0.6875rem',
                      fontWeight: 500,
                      letterSpacing: '0.04em',
                      color: isPastDue ? '#DE3E7B' : isActive ? '#9b9b9b' : '#c0c0c0',
                      flexShrink: 0,
                    }}>
                      {statusLabel}
                    </span>
                  </Link>
                )
              })}
            </div>
          ) : (
            <div style={{
              border: '1px solid rgba(0,0,0,0.07)',
              borderRadius: 14,
              padding: '28px 24px',
              textAlign: 'center',
            }}>
              <p style={{
                fontFamily: CORMORANT,
                fontSize: '1.25rem',
                fontWeight: 400,
                fontStyle: 'italic',
                color: '#1a1a1a',
                margin: '0 0 6px',
                lineHeight: 1.3,
              }}>
                Your circle is empty.
              </p>
              <p style={{
                fontFamily: GEIST,
                fontSize: '0.8125rem',
                fontWeight: 300,
                color: '#9b9b9b',
                margin: '0 0 20px',
              }}>
                Add someone to your circle to start a conversation.
              </p>
              <Link
                href="/explore"
                style={{
                  fontFamily: GEIST,
                  fontSize: '0.875rem',
                  fontWeight: 500,
                  letterSpacing: '-0.01em',
                  color: '#fff',
                  backgroundColor: '#1a1a1a',
                  borderRadius: '980px',
                  padding: '10px 24px',
                  textDecoration: 'none',
                  display: 'inline-block',
                }}
              >
                Discover Sonas
              </Link>
            </div>
          )}
        </section>

        {/* ── Billing ─────────────────────────────────────────────── */}
        {profile?.stripe_customer_id && (
          <section>
            <p style={{
              fontFamily: GEIST,
              fontSize: '0.6875rem',
              fontWeight: 500,
              letterSpacing: '0.09em',
              textTransform: 'uppercase',
              color: '#b0b0b0',
              margin: '0 0 16px',
            }}>
              Billing
            </p>
            <BillingPortalButton />
          </section>
        )}

      </div>
    </main>
  )
}
