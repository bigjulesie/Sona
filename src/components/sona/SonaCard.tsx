import Link from 'next/link'

const GEIST = 'var(--font-geist-sans)'
const CORMORANT = 'var(--font-cormorant)'

interface SonaCardProps {
  id: string
  slug: string
  display_name: string
  tagline: string | null
  avatar_url: string | null
  category: string | null
  subscriber_count: number
  avg_rating: string | null
  rating_count: number
  monthly_price_cents: number | null
}

export function SonaCard({
  slug, display_name, tagline, avatar_url, category,
  subscriber_count, avg_rating, rating_count, monthly_price_cents,
}: SonaCardProps) {
  const isPaid = monthly_price_cents != null && monthly_price_cents > 0
  const initial = display_name?.[0] ?? '?'

  return (
    <Link href={`/sona/${slug}`} style={{ display: 'block', textDecoration: 'none' }}>
      <article className="sona-card" style={{
        backgroundColor: '#fff',
        border: '1px solid rgba(0,0,0,0.07)',
        borderRadius: 16,
        padding: '32px 24px 24px',
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        boxSizing: 'border-box',
      }}>

        {/* Avatar */}
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 20 }}>
          {avatar_url ? (
            <img
              src={avatar_url}
              alt={display_name}
              style={{ width: 72, height: 72, borderRadius: '50%', objectFit: 'cover' }}
            />
          ) : (
            <div style={{
              width: 72,
              height: 72,
              borderRadius: '50%',
              backgroundColor: 'rgba(0,0,0,0.04)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}>
              <span style={{
                fontFamily: CORMORANT,
                fontSize: '1.875rem',
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
        <h3 style={{
          fontFamily: CORMORANT,
          fontSize: '1.375rem',
          fontWeight: 400,
          lineHeight: 1.2,
          letterSpacing: '-0.01em',
          color: '#1a1a1a',
          margin: '0 0 8px',
          textAlign: 'center',
        }}>
          {display_name}
        </h3>

        {/* Tagline */}
        {tagline && (
          <p style={{
            fontFamily: GEIST,
            fontSize: '0.8125rem',
            fontWeight: 300,
            lineHeight: 1.55,
            color: '#6b6b6b',
            margin: '0 0 0',
            textAlign: 'center',
            display: '-webkit-box',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical' as const,
            overflow: 'hidden',
          }}>
            {tagline}
          </p>
        )}

        {/* Push footer to bottom */}
        <div style={{ flex: 1, minHeight: 20 }} />

        {/* Footer */}
        <div style={{
          borderTop: '1px solid rgba(0,0,0,0.06)',
          paddingTop: 16,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            {category && (
              <>
                <span style={{
                  width: 5,
                  height: 5,
                  borderRadius: '50%',
                  backgroundColor: '#DE3E7B',
                  display: 'inline-block',
                  flexShrink: 0,
                }} />
                <span style={{
                  fontFamily: GEIST,
                  fontSize: '0.6875rem',
                  fontWeight: 500,
                  letterSpacing: '0.07em',
                  textTransform: 'uppercase' as const,
                  color: '#6b6b6b',
                }}>
                  {category}
                </span>
              </>
            )}
          </div>

          <span style={{
            fontFamily: GEIST,
            fontSize: '0.8125rem',
            fontWeight: 500,
            color: isPaid ? '#1a1a1a' : '#9b9b9b',
          }}>
            {isPaid
              ? `$${(monthly_price_cents! / 100).toFixed(0)}/mo`
              : 'Free'}
          </span>
        </div>

        {/* Meta row */}
        {(subscriber_count > 0 || (avg_rating && rating_count >= 5)) && (
          <div style={{
            display: 'flex',
            gap: 12,
            justifyContent: 'center',
            marginTop: 10,
          }}>
            {subscriber_count > 0 && (
              <span style={{
                fontFamily: GEIST,
                fontSize: '0.6875rem',
                color: '#c0c0c0',
              }}>
                {subscriber_count.toLocaleString()} {subscriber_count === 1 ? 'subscriber' : 'subscribers'}
              </span>
            )}
            {avg_rating && rating_count >= 5 && (
              <span style={{
                fontFamily: GEIST,
                fontSize: '0.6875rem',
                color: '#c0c0c0',
              }}>
                ★ {avg_rating}
              </span>
            )}
          </div>
        )}

      </article>
    </Link>
  )
}
