import { redirect } from 'next/navigation'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { BillingPortalButton } from './BillingPortalButton'

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

  return (
    <main className="max-w-2xl mx-auto px-4 py-12">
      <h1 className="text-2xl font-bold text-gray-900 mb-8">Your account</h1>

      <section className="mb-10">
        <h2 className="font-semibold text-gray-700 mb-4">Subscriptions</h2>
        {subscriptions && subscriptions.length > 0 ? (
          <div className="space-y-3">
            {subscriptions.map(sub => {
              const portrait = sub.portraits as any
              return (
                <a key={sub.id} href={`/sona/${portrait.slug}`}
                  className="flex items-center gap-4 p-4 bg-white rounded-xl border border-gray-100 hover:border-gray-300 transition-colors">
                  {portrait.avatar_url ? (
                    <img src={portrait.avatar_url} alt={portrait.display_name}
                      className="w-10 h-10 rounded-full object-cover shrink-0" />
                  ) : (
                    <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center shrink-0">
                      <span className="text-sm font-semibold text-gray-400">{portrait.display_name?.[0] ?? '?'}</span>
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-gray-900 truncate">{portrait.display_name}</p>
                    <p className="text-xs text-gray-400">
                      {portrait.monthly_price_cents
                        ? `$${(portrait.monthly_price_cents / 100).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}/month`
                        : 'Free'}
                    </p>
                  </div>
                  <span className={`text-xs font-medium px-2 py-0.5 rounded-full shrink-0 ${
                    sub.status === 'active' ? 'bg-green-50 text-green-600' :
                    sub.status === 'past_due' ? 'bg-red-50 text-red-600' :
                    'bg-gray-100 text-gray-400'
                  }`}>
                    {sub.status.replace('_', ' ')}
                  </span>
                </a>
              )
            })}
          </div>
        ) : (
          <p className="text-gray-400 text-sm">
            No subscriptions yet. <a href="/explore" className="underline">Explore Sonas</a>
          </p>
        )}
      </section>

      {profile?.stripe_customer_id && (
        <section>
          <h2 className="font-semibold text-gray-700 mb-4">Billing</h2>
          <BillingPortalButton />
        </section>
      )}
    </main>
  )
}
