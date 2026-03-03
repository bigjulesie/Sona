import Link from 'next/link'

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
  return (
    <Link href={`/sona/${slug}`} className="block group">
      <div className="bg-white rounded-2xl p-6 border border-gray-100 hover:border-gray-300 hover:shadow-md transition-all">
        <div className="flex items-start gap-4">
          {avatar_url ? (
            <img src={avatar_url} alt={display_name}
              className="w-14 h-14 rounded-full object-cover flex-shrink-0" />
          ) : (
            <div className="w-14 h-14 rounded-full bg-gray-100 flex items-center justify-center flex-shrink-0">
              <span className="text-xl font-semibold text-gray-400">{display_name[0]}</span>
            </div>
          )}
          <div className="min-w-0 flex-1">
            <h3 className="font-semibold text-gray-900 group-hover:text-indigo-600 transition-colors truncate">
              {display_name}
            </h3>
            {tagline && <p className="text-sm text-gray-500 mt-0.5 line-clamp-2">{tagline}</p>}
          </div>
        </div>
        <div className="flex items-center justify-between mt-4 pt-4 border-t border-gray-50">
          <div className="flex items-center gap-3 text-xs text-gray-400 flex-wrap">
            {category && (
              <span className="bg-gray-50 px-2 py-0.5 rounded-full">{category}</span>
            )}
            <span>{(subscriber_count ?? 0).toLocaleString()} subscribers</span>
            {avg_rating && rating_count >= 5 && <span>★ {avg_rating}</span>}
          </div>
          <span className={`text-xs font-medium px-2 py-0.5 rounded-full shrink-0 ${
            monthly_price_cents
              ? 'bg-indigo-50 text-indigo-600'
              : 'bg-green-50 text-green-600'
          }`}>
            {monthly_price_cents
              ? `$${(monthly_price_cents / 100).toFixed(0)}/mo`
              : 'Free'}
          </span>
        </div>
      </div>
    </Link>
  )
}
