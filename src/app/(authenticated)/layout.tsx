import { createServerSupabaseClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { logout } from '@/app/login/actions'
import Image from 'next/image'

export default async function AuthenticatedLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  return (
    <div className="h-screen bg-parchment flex flex-col overflow-hidden">
      <header className="border-b border-brass/20 bg-parchment px-4 md:px-6 py-3 flex items-center justify-between sticky top-0 z-10 flex-shrink-0">
        <Image
          src="/brand_assets/logo.svg"
          alt="Neural Heirloom"
          width={120}
          height={36}
          priority
          className="md:w-[140px] md:h-[42px]"
        />
        <form action={logout}>
          <button className="text-xs text-mist hover:text-ink tracking-widest uppercase transition-colors">
            Sign out
          </button>
        </form>
      </header>
      <main className="flex-1 flex min-h-0 overflow-hidden">{children}</main>
    </div>
  )
}
