import { createServerSupabaseClient } from '@/lib/supabase/server'
import { SonaCard } from '@/components/sona/SonaCard'

export const dynamic = 'force-dynamic'

const GEIST = 'var(--font-geist-sans)'
const CORMORANT = 'var(--font-cormorant)'

const CATEGORIES = [
  'All', 'Technology', 'Business', 'Science', 'Arts',
  'Sport', 'Politics', 'Education', 'Health', 'Other',
]

const SORT_OPTIONS = [
  { value: 'popular', label: 'Popular' },
  { value: 'top_rated', label: 'Top rated' },
  { value: 'trending', label: 'Trending' },
]

interface PageProps {
  searchParams: Promise<{ category?: string; sort?: string; q?: string }>
}

export default async function ExplorePage({ searchParams }: PageProps) {
  const { category, sort = 'popular', q } = await searchParams
  const supabase = await createServerSupabaseClient()

  let query = supabase.from('portrait_discovery').select('*')
  if (category && category !== 'All') query = query.eq('category', category)
  if (q) query = query.ilike('display_name', `%${q}%`)

  const orderCol =
    sort === 'top_rated' ? 'avg_rating'
    : sort === 'trending' ? 'new_subscribers_30d'
    : 'subscriber_count'

  query = query.order(orderCol, { ascending: false })
  const { data: sonas } = await query

  const activeCategory = category ?? 'All'

  return (
    <main style={{ minHeight: '100vh', backgroundColor: '#fff' }}>

      {/* ── Page header ──────────────────────────────────────────────── */}
      <div style={{
        maxWidth: 1200,
        margin: '0 auto',
        padding: '56px clamp(24px, 4vw, 48px) 40px',
      }}>
        <h1 style={{
          fontFamily: CORMORANT,
          fontSize: 'clamp(2.5rem, 4vw, 3.25rem)',
          fontWeight: 400,
          fontStyle: 'italic',
          letterSpacing: '-0.02em',
          lineHeight: 1,
          color: '#1a1a1a',
          margin: '0 0 10px',
        }}>
          Discover
        </h1>
        <p style={{
          fontFamily: GEIST,
          fontSize: '1rem',
          fontWeight: 300,
          color: '#6b6b6b',
          margin: 0,
        }}>
          Remarkable people. Add them to your circle.
        </p>
      </div>

      {/* ── Filter bar ───────────────────────────────────────────────── */}
      <div style={{
        borderTop: '1px solid rgba(0,0,0,0.06)',
        borderBottom: '1px solid rgba(0,0,0,0.06)',
        position: 'sticky',
        top: 56,
        zIndex: 30,
        backgroundColor: 'rgba(255,255,255,0.92)',
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
      }}>
        <div style={{
          maxWidth: 1200,
          margin: '0 auto',
          padding: '0 clamp(24px, 4vw, 48px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 24,
          overflowX: 'auto',
        }}>

          {/* Category tabs */}
          <nav style={{ display: 'flex', alignItems: 'center', flexShrink: 0 }}>
            {CATEGORIES.map(cat => {
              const isActive = activeCategory === cat
              const href = `/explore?category=${encodeURIComponent(cat)}&sort=${sort}${q ? `&q=${encodeURIComponent(q)}` : ''}`
              return (
                <a
                  key={cat}
                  href={href}
                  className={isActive ? undefined : 'sona-filter-tab'}
                  style={{
                    fontFamily: GEIST,
                    fontSize: '0.8125rem',
                    fontWeight: isActive ? 500 : 400,
                    color: isActive ? '#1a1a1a' : '#6b6b6b',
                    textDecoration: 'none',
                    padding: '15px 14px',
                    display: 'inline-block',
                    borderBottom: isActive ? '2px solid #DE3E7B' : '2px solid transparent',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {cat}
                </a>
              )
            })}
          </nav>

          {/* Search + Sort */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 24, flexShrink: 0 }}>
            <form action="/explore" style={{ display: 'flex', alignItems: 'center' }}>
              <input type="hidden" name="sort" value={sort} />
              {category && <input type="hidden" name="category" value={category} />}
              <input
                name="q"
                defaultValue={q}
                placeholder="Search…"
                style={{
                  fontFamily: GEIST,
                  fontSize: '0.8125rem',
                  color: '#1a1a1a',
                  background: 'transparent',
                  border: 'none',
                  borderBottom: '1px solid rgba(0,0,0,0.15)',
                  padding: '4px 0',
                  outline: 'none',
                  width: 110,
                }}
              />
            </form>

            <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
              {SORT_OPTIONS.map(opt => {
                const isActive = sort === opt.value
                return (
                  <a
                    key={opt.value}
                    href={`/explore?sort=${opt.value}${category ? `&category=${encodeURIComponent(category)}` : ''}${q ? `&q=${encodeURIComponent(q)}` : ''}`}
                    className={isActive ? undefined : 'sona-link'}
                    style={{
                      fontFamily: GEIST,
                      fontSize: '0.8125rem',
                      fontWeight: isActive ? 500 : 400,
                      color: isActive ? '#1a1a1a' : '#6b6b6b',
                      textDecoration: 'none',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {opt.label}
                  </a>
                )
              })}
            </div>
          </div>
        </div>
      </div>

      {/* ── Grid ─────────────────────────────────────────────────────── */}
      <div style={{
        maxWidth: 1200,
        margin: '0 auto',
        padding: '48px clamp(24px, 4vw, 48px) 96px',
      }}>
        {sonas && sonas.length > 0 ? (
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))',
            gap: 20,
          }}>
            {sonas.map(sona => (
              <SonaCard
                key={sona.id}
                {...(sona as any)}
                creatorAvatarUrl={(sona as any).creator_avatar_url ?? null}
                creatorHaloColor={(sona as any).creator_halo_color ?? null}
              />
            ))}
          </div>
        ) : (
          <div style={{ textAlign: 'center', padding: '96px 0' }}>
            {/* Coral mark */}
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 24 }}>
              <svg width="36" height="36" viewBox="0 0 72 72" fill="none" aria-hidden>
                <circle cx="36" cy="36" r="36" fill="url(#emptyGrad)" opacity="0.25" />
                <defs>
                  <radialGradient id="emptyGrad" cx="0" cy="0" r="1"
                    gradientUnits="userSpaceOnUse"
                    gradientTransform="translate(36 36) rotate(90) scale(36)">
                    <stop stopColor="#DE3E7B" />
                    <stop offset="1" stopColor="#DE3E7B" stopOpacity="0" />
                  </radialGradient>
                </defs>
              </svg>
            </div>
            <p style={{
              fontFamily: CORMORANT,
              fontSize: '1.5rem',
              fontStyle: 'italic',
              fontWeight: 400,
              color: '#6b6b6b',
              margin: '0 0 10px',
            }}>
              No Sonas found.
            </p>
            <p style={{
              fontFamily: GEIST,
              fontSize: '0.875rem',
              fontWeight: 300,
              color: '#b0b0b0',
              margin: 0,
            }}>
              Try a different category or search term.
            </p>
          </div>
        )}
      </div>

    </main>
  )
}
