import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { SubscribeButton } from '@/components/sona/SubscribeButton'
import { ChatInterface } from '@/components/chat/ChatInterface'

const GEIST = 'var(--font-geist-sans)'
const CORMORANT = 'var(--font-cormorant)'

interface PageProps {
  params: Promise<{ slug: string }>
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params
  const supabase = await createServerSupabaseClient()
  const { data: portrait } = await supabase
    .from('portraits')
    .select('display_name, tagline, bio, avatar_url')
    .eq('slug', slug)
    .eq('brand', 'sona')
    .eq('is_public', true)
    .maybeSingle()

  if (!portrait) return { title: 'Not Found' }

  const title = portrait.display_name
  const description = portrait.tagline
    ?? portrait.bio?.slice(0, 160)
    ?? `Talk with ${portrait.display_name} on Sona.`

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      type: 'profile',
      ...(portrait.avatar_url ? { images: [{ url: portrait.avatar_url }] } : {}),
    },
    twitter: {
      card: portrait.avatar_url ? 'summary_large_image' : 'summary',
      title,
      description,
      ...(portrait.avatar_url ? { images: [portrait.avatar_url] } : {}),
    },
  }
}

export default async function SonaPage({ params }: PageProps) {
  const { slug } = await params
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: portrait } = await supabase
    .from('portraits')
    .select('id, display_name, tagline, bio, avatar_url, monthly_price_cents, slug')
    .eq('slug', slug)
    .eq('brand', 'sona')
    .eq('is_public', true)
    .maybeSingle()

  if (!portrait) notFound()

  let isSubscribed = false
  let existingRating: number | null = null
  if (user) {
    const { data: sub } = await supabase
      .from('subscriptions')
      .select('id')
      .eq('subscriber_id', user.id)
      .eq('portrait_id', portrait.id)
      .eq('status', 'active')
      .maybeSingle()
    isSubscribed = !!sub

    if (isSubscribed) {
      const { data: rating } = await supabase
        .from('ratings')
        .select('score')
        .eq('subscriber_id', user.id)
        .eq('portrait_id', portrait.id)
        .maybeSingle()
      existingRating = rating?.score ?? null
    }
  }

  const { data: stats } = await supabase
    .from('portrait_discovery')
    .select('subscriber_count, avg_rating, rating_count')
    .eq('id', portrait.id)
    .maybeSingle()

  const isPaid = portrait.monthly_price_cents != null && portrait.monthly_price_cents > 0
  const initial = portrait.display_name?.[0] ?? '?'
  const subscriberCount = stats?.subscriber_count ?? 0

  return (
    <main style={{ minHeight: '100vh', backgroundColor: '#fff' }}>
      <div style={{
        maxWidth: 720,
        margin: '0 auto',
        padding: '0 clamp(24px, 4vw, 48px) 96px',
      }}>

        {/* ── Back link ───────────────────────────────────────────── */}
        <div style={{ paddingTop: 40, marginBottom: 56 }}>
          <Link
            href="/explore"
            className="sona-link"
            style={{
              fontFamily: GEIST,
              fontSize: '0.8125rem',
              fontWeight: 400,
              color: '#6b6b6b',
              textDecoration: 'none',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
            }}
          >
            <span aria-hidden style={{ fontSize: '1em' }}>←</span> Explore
          </Link>
        </div>

        {/* ── Hero ────────────────────────────────────────────────── */}
        <div style={{ textAlign: 'center', marginBottom: 48 }}>

          {/* Avatar */}
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 24 }}>
            {portrait.avatar_url ? (
              <img
                src={portrait.avatar_url}
                alt={portrait.display_name}
                style={{
                  width: 108,
                  height: 108,
                  borderRadius: '50%',
                  objectFit: 'cover',
                }}
              />
            ) : (
              <div style={{
                width: 108,
                height: 108,
                borderRadius: '50%',
                backgroundColor: 'rgba(0,0,0,0.04)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}>
                <span style={{
                  fontFamily: CORMORANT,
                  fontSize: '2.75rem',
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
          </div>

          {/* Name */}
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
            {portrait.display_name}
          </h1>

          {/* Tagline */}
          {portrait.tagline && (
            <p style={{
              fontFamily: GEIST,
              fontSize: '1rem',
              fontWeight: 300,
              lineHeight: 1.6,
              color: '#6b6b6b',
              margin: '0 auto 20px',
              maxWidth: 480,
            }}>
              {portrait.tagline}
            </p>
          )}

          {/* Meta row */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 20,
            flexWrap: 'wrap',
          }}>
            {subscriberCount > 0 && (
              <span style={{
                fontFamily: GEIST,
                fontSize: '0.8125rem',
                color: '#b0b0b0',
              }}>
                {subscriberCount.toLocaleString()} {subscriberCount === 1 ? 'subscriber' : 'subscribers'}
              </span>
            )}
            {stats?.avg_rating && (stats?.rating_count ?? 0) >= 5 && (
              <span style={{
                fontFamily: GEIST,
                fontSize: '0.8125rem',
                color: '#b0b0b0',
              }}>
                ★ {stats.avg_rating}
              </span>
            )}
            <span style={{
              fontFamily: GEIST,
              fontSize: '0.8125rem',
              fontWeight: 500,
              color: isPaid ? '#1a1a1a' : '#9b9b9b',
            }}>
              {isPaid
                ? `$${(portrait.monthly_price_cents! / 100).toFixed(0)}/mo`
                : 'Free'}
            </span>
          </div>
        </div>

        {/* ── Divider ─────────────────────────────────────────────── */}
        <div style={{ height: 1, backgroundColor: 'rgba(0,0,0,0.06)', marginBottom: 40 }} />

        {/* ── Bio ─────────────────────────────────────────────────── */}
        {portrait.bio && (
          <p style={{
            fontFamily: GEIST,
            fontSize: '1rem',
            fontWeight: 300,
            lineHeight: 1.8,
            color: '#3a3a3a',
            marginBottom: 48,
          }}>
            {portrait.bio}
          </p>
        )}

        {/* ── Subscribe gate ───────────────────────────────────────── */}
        {!isSubscribed && (
          <div style={{
            border: '1px solid rgba(0,0,0,0.08)',
            borderRadius: 20,
            padding: '36px 32px',
            textAlign: 'center',
          }}>
            <p style={{
              fontFamily: CORMORANT,
              fontSize: '1.5rem',
              fontWeight: 400,
              fontStyle: 'italic',
              color: '#1a1a1a',
              margin: '0 0 8px',
              lineHeight: 1.3,
            }}>
              Begin your conversation with {portrait.display_name}.
            </p>
            <p style={{
              fontFamily: GEIST,
              fontSize: '0.875rem',
              fontWeight: 300,
              color: '#6b6b6b',
              margin: '0 0 24px',
            }}>
              {isPaid
                ? `$${(portrait.monthly_price_cents! / 100).toFixed(0)} per month. Cancel any time.`
                : 'Free to join. No credit card required.'}
            </p>
            <SubscribeButton
              portraitId={portrait.id}
              isFree={!portrait.monthly_price_cents}
              isLoggedIn={!!user}
              slug={portrait.slug}
            />
          </div>
        )}

        {/* ── Chat ────────────────────────────────────────────────── */}
        {isSubscribed && (
          <ChatInterface
            portraitId={portrait.id}
            portraitName={portrait.display_name}
            existingRating={existingRating}
          />
        )}

      </div>
    </main>
  )
}
