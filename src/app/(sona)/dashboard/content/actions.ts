'use server'

import { createServerSupabaseClient } from '@/lib/supabase/server'

export async function deleteContentSource(sourceId: string): Promise<{ error?: string }> {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Unauthorized' }

  // Verify source exists and belongs to this user (via portrait.creator_id)
  // TODO: remove as any once supabase gen types is run after migration 00019 is applied
  const { data: source } = await supabase
    .from('content_sources' as any)
    .select('id, portrait_id')
    .eq('id', sourceId)
    .maybeSingle() as { data: { id: string; portrait_id: string } | null }

  if (!source) return { error: 'Not found' }

  const { data: portrait } = await supabase
    .from('portraits')
    .select('id')
    .eq('id', source.portrait_id)
    .eq('creator_id', user.id)
    .maybeSingle()

  if (!portrait) return { error: 'Not found' }

  // Delete the source row (CASCADE removes knowledge_chunks and sona_evidence)
  // TODO: remove as any once supabase gen types is run after migration 00019 is applied
  const { error: deleteError } = await supabase
    .from('content_sources' as any)
    .delete()
    .eq('id', sourceId)

  if (deleteError) return { error: 'Failed to delete source.' }

  // Reset synthesis status so the portrait re-synthesises without this source
  const { error: resetError } = await supabase
    .from('portraits')
    .update({ synthesis_status: 'pending' } as any)
    .eq('id', source.portrait_id)
  if (resetError) {
    console.error('[deleteContentSource] failed to reset synthesis_status:', resetError)
  }

  return {}
}
