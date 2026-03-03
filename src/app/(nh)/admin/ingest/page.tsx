import { createAdminClient } from '@/lib/supabase/admin'
import { IngestForm } from './IngestForm'

export default async function IngestPage() {
  const supabase = createAdminClient()
  const { data: portraits } = await supabase
    .from('portraits')
    .select('id, display_name')
    .order('display_name')

  return (
    <div>
      <h2 className="font-display text-2xl text-ink mb-1 font-normal">Ingest Content</h2>
      <p className="text-sm text-mist mb-6">Add source material to a Sona&apos;s knowledge base.</p>
      <IngestForm portraits={portraits ?? []} />
    </div>
  )
}
