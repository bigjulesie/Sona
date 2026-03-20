'use server'

import { revalidatePath } from 'next/cache'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function retrySynthesis(portraitId: string) {
  await assertAdmin()
  // 'error' is not 'synthesising', so the guard inside runFullSynthesis won't block.
  // Call it directly — it will set synthesis_status to 'synthesising' at the start of its run.
  const { runFullSynthesis } = await import('@/lib/synthesis/character-synthesise')
  // Fire and forget — do not await so the server action returns immediately
  runFullSynthesis(portraitId, 'admin_retry').catch((err: unknown) => {
    console.error('[retrySynthesis] background synthesis failed:', err)
  })
  revalidatePath('/sona-admin')
}

async function assertAdmin() {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Unauthenticated')
  // Use admin client for profile read to guarantee success regardless of RLS policy state
  const admin = createAdminClient()
  const { data: profile } = await admin
    .from('profiles')
    .select('is_admin')
    .eq('id', user.id)
    .single()
  if (!profile?.is_admin) throw new Error('Forbidden')
}

export async function resetPortraitStatus(portraitId: string) {
  await assertAdmin()
  const admin = createAdminClient()

  // Reset stuck synthesis status
  await (admin as any)
    .from('portraits')
    .update({ synthesis_status: 'error' })
    .eq('id', portraitId)
    .eq('synthesis_status', 'synthesising')

  // Reset stuck web research status (only if still running)
  await (admin as any)
    .from('portraits')
    .update({ web_research_status: 'error' })
    .eq('id', portraitId)
    .eq('web_research_status', 'running')

  // Mark any orphaned running/pending synthesis jobs as errored
  await (admin as any)
    .from('sona_synthesis_jobs')
    .update({
      status: 'error',
      error_msg: 'Reset by admin — job was stuck',
      completed_at: new Date().toISOString(),
    })
    .eq('portrait_id', portraitId)
    .in('status', ['running', 'pending'])

  revalidatePath('/sona-admin')
}

export async function togglePortraitPublished(portraitId: string, isPublic: boolean) {
  await assertAdmin()
  const admin = createAdminClient()
  const { error } = await admin
    .from('portraits')
    .update({ is_public: isPublic })
    .eq('id', portraitId)
  if (error) {
    console.error('togglePortraitPublished error:', { portraitId, isPublic, error })
    throw new Error('Failed to update portrait')
  }
  revalidatePath('/sona-admin')
}
