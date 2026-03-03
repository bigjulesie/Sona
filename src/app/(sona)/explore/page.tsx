import { createServerSupabaseClient } from '@/lib/supabase/server'
import { SonaCard } from '@/components/sona/SonaCard'

const CATEGORIES = [
  'All', 'Technology', 'Business', 'Science', 'Arts',
  'Sport', 'Politics', 'Education', 'Health', 'Other',
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

  return (
    <main className="max-w-6xl mx-auto px-4 py-12">
      <h1 className="text-3xl font-bold text-gray-900 mb-2">Explore Sonas</h1>
      <p className="text-gray-500 mb-8">Discover and connect with remarkable people.</p>

      <div className="flex flex-wrap gap-2 mb-6">
        {CATEGORIES.map(cat => (
          <a key={cat}
            href={`/explore?category=${cat}&sort=${sort}${q ? `&q=${q}` : ''}`}
            className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${
              (category ?? 'All') === cat
                ? 'bg-gray-900 text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}>
            {cat}
          </a>
        ))}
      </div>

      <div className="flex items-center gap-4 mb-8">
        <form className="flex-1 max-w-xs">
          <input name="q" defaultValue={q} placeholder="Search by name…"
            className="w-full px-4 py-2 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900" />
        </form>
        <div className="flex gap-1">
          {[
            { value: 'popular', label: 'Popular' },
            { value: 'top_rated', label: 'Top rated' },
            { value: 'trending', label: 'Trending' },
          ].map(opt => (
            <a key={opt.value}
              href={`/explore?sort=${opt.value}${category ? `&category=${category}` : ''}${q ? `&q=${q}` : ''}`}
              className={`px-3 py-1.5 rounded-lg text-sm transition-colors ${
                sort === opt.value ? 'bg-gray-900 text-white' : 'text-gray-500 hover:text-gray-900'
              }`}>
              {opt.label}
            </a>
          ))}
        </div>
      </div>

      {sonas && sonas.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {sonas.map(sona => <SonaCard key={sona.id} {...(sona as any)} />)}
        </div>
      ) : (
        <p className="text-center text-gray-400 py-16">No Sonas found.</p>
      )}
    </main>
  )
}
