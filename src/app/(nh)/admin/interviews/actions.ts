'use server'

import { createAdminClient } from '@/lib/supabase/admin'
import { revalidatePath } from 'next/cache'

export async function updateInterviewStatus(
  requestId: string,
  status: 'scheduled' | 'completed',
) {
  const { error } = await createAdminClient()
    .from('interview_requests')
    .update({ status })
    .eq('id', requestId)
  if (error) throw new Error('Failed to update interview status')
  revalidatePath('/admin/interviews')
}

export async function publishSona(portraitId: string) {
  const { error } = await createAdminClient()
    .from('portraits')
    .update({ is_public: true })
    .eq('id', portraitId)
  if (error) throw new Error('Failed to publish Sona')
  revalidatePath('/admin/interviews')
}
