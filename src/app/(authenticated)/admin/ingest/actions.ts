'use server'

import { chunkText } from '@/lib/ingest/chunker'
import { generateEmbeddings } from '@/lib/ingest/embeddings'
import { createAdminClient } from '@/lib/supabase/admin'

export async function ingestContent(formData: FormData) {
  const portraitId = formData.get('portrait_id') as string
  const content = formData.get('content') as string
  const sourceTitle = formData.get('source_title') as string
  const sourceType = formData.get('source_type') as string
  const minTier = formData.get('min_tier') as string

  if (!portraitId || !content) {
    return { error: 'Portrait and content are required' }
  }

  const chunks = chunkText(content)
  const embeddings = await generateEmbeddings(chunks)
  const supabase = createAdminClient()

  const rows = chunks.map((chunk, i) => ({
    portrait_id: portraitId,
    content: chunk,
    embedding: JSON.stringify(embeddings[i]),
    source_title: sourceTitle || null,
    source_type: sourceType || 'transcript',
    min_tier: minTier || 'public',
    chunk_index: i,
  }))

  const { error } = await supabase.from('knowledge_chunks').insert(rows)

  if (error) return { error: error.message }

  await supabase.from('audit_log').insert({
    action: 'ingest',
    resource_type: 'knowledge_chunks',
    metadata: { portrait_id: portraitId, source_title: sourceTitle, chunks_created: chunks.length },
  })

  return { success: true, chunksCreated: chunks.length }
}
