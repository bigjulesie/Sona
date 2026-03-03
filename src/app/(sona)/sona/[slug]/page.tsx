import { notFound } from 'next/navigation'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { SubscribeButton } from '@/components/sona/SubscribeButton'
import { ChatInterface } from '@/components/chat/ChatInterface'

interface PageProps {
  params: Promise<{ slug: string }>
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
    .single()

  if (!portrait) notFound()

  let isSubscribed = false
  if (user) {
    const { data: sub } = await supabase
      .from('subscriptions')
      .select('id')
      .eq('subscriber_id', user.id)
      .eq('portrait_id', portrait.id)
      .eq('status', 'active')
      .maybeSingle()
    isSubscribed = !!sub
  }

  const { data: stats } = await supabase
    .from('portrait_discovery')
    .select('subscriber_count, avg_rating, rating_count')
    .eq('id', portrait.id)
    .maybeSingle()

  return (
    <main className="max-w-2xl mx-auto px-4 py-12">
      <div className="flex items-start gap-6 mb-8">
        {portrait.avatar_url ? (
          <img src={portrait.avatar_url} alt={portrait.display_name}
            className="w-24 h-24 rounded-full object-cover shrink-0" />
        ) : (
          <div className="w-24 h-24 rounded-full bg-gray-100 flex items-center justify-center shrink-0">
            <span className="text-3xl font-semibold text-gray-400">{portrait.display_name[0] ?? '?'}</span>
          </div>
        )}
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{portrait.display_name}</h1>
          {portrait.tagline && <p className="text-gray-500 mt-1">{portrait.tagline}</p>}
          <div className="flex items-center gap-4 mt-2 text-sm text-gray-400">
            <span>{(stats?.subscriber_count ?? 0).toLocaleString()} subscribers</span>
            {stats?.avg_rating && (stats?.rating_count ?? 0) >= 5 && (
              <span>★ {stats.avg_rating}</span>
            )}
            <span className={portrait.monthly_price_cents ? 'text-indigo-600' : 'text-green-600'}>
              {portrait.monthly_price_cents
                ? `$${(portrait.monthly_price_cents / 100).toFixed(0)}/month`
                : 'Free'}
            </span>
          </div>
        </div>
      </div>

      {portrait.bio && (
        <p className="text-gray-600 mb-8 leading-relaxed">{portrait.bio}</p>
      )}

      {!isSubscribed && (
        <div className="mb-8 p-6 bg-gray-50 rounded-2xl">
          <p className="text-gray-600 text-sm mb-4">
            {portrait.monthly_price_cents
              ? `Subscribe for $${(portrait.monthly_price_cents / 100).toFixed(0)}/month to have a full conversation.`
              : 'Follow for free to unlock full conversations.'}
          </p>
          <SubscribeButton
            portraitId={portrait.id}
            isFree={!portrait.monthly_price_cents}
            isLoggedIn={!!user}
            slug={portrait.slug}
          />
        </div>
      )}

      {isSubscribed && (
        <ChatInterface portraitId={portrait.id} portraitName={portrait.display_name} />
      )}
    </main>
  )
}
