import { createAdminClient } from '@/lib/supabase/admin'

export default async function AdminOverview() {
  const supabase = createAdminClient()

  const [
    { count: userCount },
    { count: chunkCount },
    { count: conversationCount },
  ] = await Promise.all([
    supabase.from('profiles').select('*', { count: 'exact', head: true }),
    supabase.from('knowledge_chunks').select('*', { count: 'exact', head: true }),
    supabase.from('conversations').select('*', { count: 'exact', head: true }),
  ])

  return (
    <div>
      <h2 className="font-display text-2xl text-ink mb-6 font-normal">Overview</h2>
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: 'Users', value: userCount ?? 0 },
          { label: 'Knowledge Chunks', value: chunkCount ?? 0 },
          { label: 'Conversations', value: conversationCount ?? 0 },
        ].map(stat => (
          <div key={stat.label} className="bg-vellum border border-brass/20 rounded p-5">
            <p className="text-xs tracking-widest uppercase text-mist mb-2">{stat.label}</p>
            <p className="font-display text-4xl text-ink font-light">{stat.value}</p>
          </div>
        ))}
      </div>
    </div>
  )
}
