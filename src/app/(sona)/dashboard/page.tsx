import { createServerSupabaseClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'

const UNLOCKS = [
  { count: 25, label: 'Inner circle interviews' },
  { count: 100, label: 'Analytics dashboard' },
  { count: 250, label: 'Custom domain' },
]

export default async function DashboardPage() {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: portrait } = await supabase
    .from('portraits')
    .select('id, display_name, slug, is_public, monthly_price_cents')
    .eq('creator_id', user.id)
    .maybeSingle()

  if (!portrait) redirect('/dashboard/create')

  const { data: stats } = await supabase
    .from('portrait_discovery')
    .select('subscriber_count')
    .eq('id', portrait.id)
    .maybeSingle()

  const subscriberCount = Number(stats?.subscriber_count ?? 0)
  const mrr = portrait.monthly_price_cents
    ? (subscriberCount * portrait.monthly_price_cents) / 100
    : 0

  const { data: interviewRequest } = await supabase
    .from('interview_requests')
    .select('status')
    .eq('portrait_id', portrait.id)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-2xl font-bold text-gray-900">{portrait.display_name}</h1>
        {portrait.is_public && (
          <a href={`/sona/${portrait.slug}`} target="_blank"
            className="text-sm text-indigo-600 hover:underline">View public page &#8599;</a>
        )}
      </div>

      {!portrait.is_public && (
        <div className="mb-6 p-4 bg-amber-50 border border-amber-200 rounded-xl text-sm text-amber-800">
          {interviewRequest
            ? `Your interview is ${interviewRequest.status}. We'll notify you when your Sona goes live.`
            : 'Schedule your WhatsApp interview to get your Sona live.'}
          {!interviewRequest && (
            <Link href="/dashboard/interview" className="ml-2 underline font-medium">Schedule now &rarr;</Link>
          )}
        </div>
      )}

      <div className="grid grid-cols-2 gap-4 mb-8">
        <div className="bg-white rounded-2xl p-6 border border-gray-100">
          <p className="text-sm text-gray-500 mb-1">Subscribers</p>
          <p className="text-3xl font-bold text-gray-900">{subscriberCount.toLocaleString()}</p>
        </div>
        <div className="bg-white rounded-2xl p-6 border border-gray-100">
          <p className="text-sm text-gray-500 mb-1">Monthly revenue</p>
          <p className="text-3xl font-bold text-gray-900">{mrr > 0 ? `$${mrr.toFixed(0)}` : '\u2014'}</p>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 p-6">
        <h2 className="font-semibold text-gray-900 mb-4">Unlock more features</h2>
        <div className="space-y-3">
          {UNLOCKS.map(({ count, label }) => {
            const unlocked = subscriberCount >= count
            return (
              <div key={count} className={`flex items-center justify-between py-2 ${unlocked ? '' : 'opacity-40'}`}>
                <span className="text-sm text-gray-700">{label}</span>
                <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                  unlocked ? 'bg-green-50 text-green-600' : 'bg-gray-100 text-gray-400'
                }`}>
                  {unlocked ? 'Unlocked' : `${count} subscribers`}
                </span>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
