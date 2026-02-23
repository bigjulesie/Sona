import { createServerSupabaseClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { logout } from '@/app/login/actions'

export default async function AuthenticatedLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  return (
    <div className="min-h-screen bg-stone-50 flex flex-col">
      <header className="border-b border-stone-200 bg-white px-6 py-3 flex items-center justify-between">
        <h1 className="text-sm font-medium tracking-tight text-stone-900">Neural Heirloom</h1>
        <form action={logout}>
          <button className="text-xs text-stone-500 hover:text-stone-900 transition-colors">
            Sign out
          </button>
        </form>
      </header>
      <main className="flex-1 flex">{children}</main>
    </div>
  )
}
