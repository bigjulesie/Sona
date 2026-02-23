import { SupabaseClient } from '@supabase/supabase-js'
import { generateEmbedding } from '@/lib/ingest/embeddings'

export async function retrieveRelevantChunks(
  supabase: SupabaseClient,
  query: string,
  portraitId: string,
  limit: number = 8
) {
  const embedding = await generateEmbedding(query)

  // RLS automatically filters by user's access_tier
  const { data, error } = await supabase.rpc('match_knowledge_chunks', {
    query_embedding: JSON.stringify(embedding),
    match_portrait_id: portraitId,
    match_count: limit,
  })

  if (error) throw error
  return data ?? []
}
