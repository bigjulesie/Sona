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
      <h2 className="text-lg font-medium text-stone-900 mb-6">Admin Overview</h2>
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: 'Users', value: userCount ?? 0 },
          { label: 'Knowledge Chunks', value: chunkCount ?? 0 },
          { label: 'Conversations', value: conversationCount ?? 0 },
        ].map(stat => (
          <div key={stat.label} className="bg-white border border-stone-200 rounded-lg p-4">
            <p className="text-xs text-stone-500">{stat.label}</p>
            <p className="text-2xl font-light text-stone-900 mt-1">{stat.value}</p>
          </div>
        ))}
      </div>
    </div>
  )
}
