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

  const navLink = 'block text-sm text-mist hover:text-ink px-3 py-2 rounded hover:bg-vellum transition-colors tracking-wide'

  return (
    <div className="flex flex-1">
      <nav className="w-48 border-r border-brass/20 bg-parchment p-4 space-y-0.5">
        <Link href="/admin" className={navLink}>Overview</Link>
        <Link href="/admin/users" className={navLink}>Users</Link>
        <Link href="/admin/ingest" className={navLink}>Ingestion</Link>
        <Link href="/admin/portrait" className={navLink}>Portrait</Link>
      </nav>
      <div className="flex-1 p-6">{children}</div>
    </div>
  )
}
