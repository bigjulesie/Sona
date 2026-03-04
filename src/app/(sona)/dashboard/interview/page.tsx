import { createServerSupabaseClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { InterviewStep } from '../create/InterviewStep'

export default async function DashboardInterviewPage() {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: portrait } = await supabase
    .from('portraits')
    .select('id, display_name')
    .eq('creator_id', user.id)
    .maybeSingle()

  if (!portrait) redirect('/dashboard/create')

  const { data: existing } = await supabase
    .from('interview_requests')
    .select('status, scheduled_at')
    .eq('portrait_id', portrait.id)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  return (
    <div className="max-w-lg">
      <h1 className="text-2xl font-bold text-gray-900 mb-2">WhatsApp Interview</h1>
      <p className="text-gray-500 text-sm mb-8">
        We conduct a WhatsApp interview to capture your voice and values — the foundation of your Sona.
      </p>

      {existing ? (
        <div className="p-5 bg-amber-50 border border-amber-200 rounded-xl text-sm text-amber-800">
          <p className="font-medium mb-1">Interview request received</p>
          <p>
            Status: <span className="capitalize">{existing.status}</span>
            {existing.scheduled_at && (
              <> · Scheduled for {new Date(existing.scheduled_at).toLocaleDateString('en-US', { dateStyle: 'long' })}</>
            )}
          </p>
          <p className="mt-2 text-amber-600">We&apos;ll be in touch via WhatsApp.</p>
        </div>
      ) : (
        <InterviewStep portraitId={portrait.id} returnHref="/dashboard" />
      )}
    </div>
  )
}
