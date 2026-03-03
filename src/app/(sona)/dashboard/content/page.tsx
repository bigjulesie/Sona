import { redirect } from 'next/navigation'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { IngestForm } from '@/app/(nh)/admin/ingest/IngestForm'

export default async function DashboardContentPage() {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: portrait } = await supabase
    .from('portraits')
    .select('id, display_name')
    .eq('creator_id', user.id)
    .maybeSingle()

  if (!portrait) redirect('/dashboard/create')

  return (
    <div className="max-w-lg">
      <h1 className="text-xl font-bold text-gray-900 mb-2">Add content</h1>
      <p className="text-gray-500 text-sm mb-8">Upload documents or paste text to enrich your Sona.</p>
      <IngestForm lockedPortraitId={portrait.id} lockedPortraitName={portrait.display_name} />
    </div>
  )
}
