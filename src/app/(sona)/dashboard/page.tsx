import { createServerSupabaseClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'

const UNLOCKS = [
  { count: 25, label: 'Inner circle interviews' },
  { count: 100, label: 'Analytics dashboard' },
  { count: 250, label: 'Custom domain' },
]

const INTERVIEW_STATUS_LABEL: Record<string, string> = {
  pending: 'Pending — we\'ll be in touch via WhatsApp',
  scheduled: 'Scheduled',
  completed: 'Completed',
}

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

  const { count: chunkCount } = await supabase
    .from('knowledge_chunks')
    .select('id', { count: 'exact', head: true })
    .eq('portrait_id', portrait.id)

  const hasContent = (chunkCount ?? 0) > 0

  // Determine the single most relevant next action for this creator
  const nextAction = !portrait.is_public
    ? !interviewRequest
      ? { label: 'Schedule your interview', description: 'Book your WhatsApp interview to get your Sona live.', href: '/dashboard/interview', cta: 'Schedule now' }
      : !hasContent
        ? { label: 'Add content while you wait', description: 'Upload writings, talks, or documents to enrich your Sona before launch.', href: '/dashboard/content', cta: 'Add content' }
        : null
    : null

  const setupSteps = [
    {
      label: 'Create your Sona',
      description: 'Name, bio, and category',
      done: true,
      href: '/dashboard/settings',
    },
    {
      label: 'WhatsApp interview',
      description: interviewRequest
        ? (INTERVIEW_STATUS_LABEL[interviewRequest.status] ?? interviewRequest.status)
        : 'We\'ll capture your voice and values',
      done: !!interviewRequest,
      href: '/dashboard/interview',
    },
    {
      label: 'Add content',
      description: hasContent ? 'Content uploaded' : 'Optional — upload writings, talks, or documents',
      done: hasContent,
      href: '/dashboard/content',
      optional: true,
    },
    {
      label: 'Set your pricing',
      description: portrait.monthly_price_cents
        ? `$${(portrait.monthly_price_cents / 100).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}/month`
        : 'Free',
      done: true,
      href: '/dashboard/settings',
    },
  ]

  const allRequiredDone = !!interviewRequest

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-2xl font-bold text-gray-900">{portrait.display_name}</h1>
        {portrait.is_public && (
          <a href={`/sona/${portrait.slug}`} target="_blank"
            className="text-sm text-indigo-600 hover:underline">View public page &#8599;</a>
        )}
      </div>

      {nextAction && (
        <Link href={nextAction.href}
          className="flex items-center justify-between mb-6 p-5 bg-gray-900 text-white rounded-2xl hover:bg-gray-800 transition-colors group">
          <div>
            <p className="text-xs font-medium text-gray-400 mb-0.5 uppercase tracking-wide">Recommended next step</p>
            <p className="font-semibold">{nextAction.label}</p>
            <p className="text-sm text-gray-400 mt-0.5">{nextAction.description}</p>
          </div>
          <span className="text-gray-400 group-hover:text-white transition-colors text-xl shrink-0 ml-4">&#8594;</span>
        </Link>
      )}

      {!portrait.is_public && (
        <div className="mb-8 bg-white rounded-2xl border border-gray-100 p-6">
          <div className="flex items-start justify-between mb-5">
            <div>
              <h2 className="font-semibold text-gray-900">Getting your Sona live</h2>
              <p className="text-xs text-gray-400 mt-0.5">
                {allRequiredDone
                  ? 'Interview requested — we\'ll notify you when you\'re live.'
                  : 'Complete the steps below to launch your Sona.'}
              </p>
            </div>
            {allRequiredDone && (
              <span className="text-xs font-medium px-2.5 py-1 bg-amber-50 text-amber-700 rounded-full">In review</span>
            )}
          </div>

          <div className="space-y-1">
            {setupSteps.map((step) => (
              <Link key={step.label} href={step.href}
                className="flex items-center gap-3 p-3 rounded-xl hover:bg-gray-50 transition-colors group">
                <div className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 ${
                  step.done ? 'bg-gray-900' : 'border-2 border-gray-200'
                }`}>
                  {step.done && (
                    <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className={`text-sm font-medium ${step.done ? 'text-gray-500 line-through' : 'text-gray-900'}`}>
                      {step.label}
                    </span>
                    {step.optional && (
                      <span className="text-xs text-gray-400">(optional)</span>
                    )}
                  </div>
                  <p className="text-xs text-gray-400 mt-0.5 truncate">{step.description}</p>
                </div>
                <span className="text-gray-200 group-hover:text-gray-400 transition-colors text-sm">&#8594;</span>
              </Link>
            ))}
          </div>
        </div>
      )}

      {portrait.is_public && (
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
      )}

      {portrait.is_public && (
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
      )}
    </div>
  )
}
