'use server'

import { chunkText } from '@/lib/ingest/chunker'
import { generateEmbeddings } from '@/lib/ingest/embeddings'
import { createAdminClient } from '@/lib/supabase/admin'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import type { Database } from '@/lib/supabase/types'

type AccessTier = Database['public']['Enums']['access_tier']

export async function ingestContent(formData: FormData) {
  const portraitId = formData.get('portrait_id') as string
  const content = formData.get('content') as string
  const sourceTitle = formData.get('source_title') as string
  const sourceType = formData.get('source_type') as string
  const minTier = (formData.get('min_tier') as AccessTier) || 'public'

  if (!portraitId || !content) {
    return { error: 'Portrait and content are required' }
  }

  // Verify caller ownership or admin status
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Unauthorized' }

  const { data: profile } = await supabase
    .from('profiles')
    .select('is_admin')
    .eq('id', user.id)
    .single()

  if (!profile?.is_admin) {
    // Non-admin must own the portrait
    const { data: portrait } = await supabase
      .from('portraits')
      .select('id')
      .eq('id', portraitId)
      .eq('creator_id', user.id)
      .maybeSingle()
    if (!portrait) return { error: 'Forbidden' }
  }

  const chunks = chunkText(content)
  const embeddings = await generateEmbeddings(chunks)
  const adminSupabase = createAdminClient()

  const rows = chunks.map((chunk, i) => ({
    portrait_id: portraitId,
    content: chunk,
    embedding: JSON.stringify(embeddings[i]),
    source_title: sourceTitle || null,
    source_type: sourceType || 'transcript',
    min_tier: minTier,
    chunk_index: i,
  }))

  const { error } = await adminSupabase.from('knowledge_chunks').insert(rows)

  if (error) return { error: error.message }

  await adminSupabase.from('audit_log').insert({
    action: 'ingest',
    resource_type: 'knowledge_chunks',
    metadata: { portrait_id: portraitId, source_title: sourceTitle, chunks_created: chunks.length },
  })

  return { success: true, chunksCreated: chunks.length }
}
