import { createServerSupabaseClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { redirect } from 'next/navigation'
import Link from 'next/link'

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const admin = createAdminClient()
  const { data: profile } = await admin
    .from('profiles')
    .select('is_admin')
    .eq('id', user.id)
    .single()

  if (!profile?.is_admin) {
    redirect('/chat')
  }

  const navLink = 'block text-sm text-mist hover:text-ink px-3 py-2 rounded hover:bg-vellum transition-colors tracking-wide whitespace-nowrap'

  return (
    <div className="flex flex-1 min-h-0 overflow-hidden">
      <nav className="w-16 md:w-48 border-r border-brass/20 bg-parchment p-2 md:p-4 space-y-0.5 flex-shrink-0 overflow-y-auto">
        <Link href="/admin" className={navLink}>
          <span className="hidden md:inline">Overview</span>
          <span className="md:hidden text-center block" title="Overview">⊞</span>
        </Link>
        <Link href="/admin/users" className={navLink}>
          <span className="hidden md:inline">Users</span>
          <span className="md:hidden text-center block" title="Users">👤</span>
        </Link>
        <Link href="/admin/ingest" className={navLink}>
          <span className="hidden md:inline">Ingestion</span>
          <span className="md:hidden text-center block" title="Ingestion">↑</span>
        </Link>
        <Link href="/admin/portrait" className={navLink}>
          <span className="hidden md:inline">Portrait</span>
          <span className="md:hidden text-center block" title="Portrait">◎</span>
        </Link>
        <Link href="/admin/chunks" className={navLink}>
          <span className="hidden md:inline">Chunks</span>
          <span className="md:hidden text-center block" title="Chunks">≡</span>
        </Link>
      </nav>
      <div className="flex-1 p-4 md:p-6 overflow-y-auto">{children}</div>
    </div>
  )
}
