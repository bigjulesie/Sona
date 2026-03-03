import { createAdminClient } from '@/lib/supabase/admin'
import { ChunkBrowser } from './ChunkBrowser'

export default async function ChunksPage() {
  const supabase = createAdminClient()
  const { data: portraits } = await supabase
    .from('portraits')
    .select('id, display_name')
    .order('created_at', { ascending: true })

  return (
    <div>
      <h2 className="font-display text-2xl text-ink mb-2 font-normal">Knowledge Chunks</h2>
      <p className="text-sm text-mist mb-6">Browse and delete ingested knowledge chunks per Sona.</p>
      <ChunkBrowser portraits={portraits ?? []} />
    </div>
  )
}
