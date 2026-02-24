import { createServerSupabaseClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { redirect } from 'next/navigation'
import Link from 'next/link'

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  // Check admin status — for Phase 1, admin = family tier
  const admin = createAdminClient()
  const { data: profile } = await admin
    .from('profiles')
    .select('access_tier')
    .eq('id', user.id)
    .single()

  if (profile?.access_tier !== 'family') {
    redirect('/chat')
  }

  return (
    <div className="flex flex-1">
      <nav className="w-48 border-r border-stone-200 bg-white p-4 space-y-1">
        <Link href="/admin" className="block text-sm text-stone-600 hover:text-stone-900 px-2 py-1.5 rounded hover:bg-stone-50">
          Overview
        </Link>
        <Link href="/admin/users" className="block text-sm text-stone-600 hover:text-stone-900 px-2 py-1.5 rounded hover:bg-stone-50">
          Users
        </Link>
        <Link href="/admin/ingest" className="block text-sm text-stone-600 hover:text-stone-900 px-2 py-1.5 rounded hover:bg-stone-50">
          Ingestion
        </Link>
        <Link href="/admin/portrait" className="block text-sm text-stone-600 hover:text-stone-900 px-2 py-1.5 rounded hover:bg-stone-50">
          Portrait
        </Link>
      </nav>
      <div className="flex-1 p-6">{children}</div>
    </div>
  )
}
