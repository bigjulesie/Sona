'use server'

import { createAdminClient } from '@/lib/supabase/admin'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

async function assertAdmin() {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Unauthenticated')
  const { data: profile } = await supabase
    .from('profiles').select('is_admin').eq('id', user.id).single()
  if (!profile?.is_admin) throw new Error('Forbidden')
}

export async function updateInterviewStatus(
  requestId: string,
  status: 'scheduled' | 'completed',
) {
  await assertAdmin()
  const { error } = await createAdminClient()
    .from('interview_requests')
    .update({ status })
    .eq('id', requestId)
  if (error) throw new Error('Failed to update interview status')
  revalidatePath('/admin/interviews')
}

export async function publishSona(portraitId: string) {
  await assertAdmin()
  const { error } = await createAdminClient()
    .from('portraits')
    .update({ is_public: true })
    .eq('id', portraitId)
  if (error) throw new Error('Failed to publish Sona')
  revalidatePath('/admin/interviews')
}
