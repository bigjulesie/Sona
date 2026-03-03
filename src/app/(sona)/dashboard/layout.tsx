import { redirect } from 'next/navigation'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import Link from 'next/link'

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-100 px-6 py-4">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <a href="/" className="font-semibold text-gray-900">Sona</a>
          <nav className="flex gap-6 text-sm">
            {[
              { href: '/dashboard', label: 'Overview' },
              { href: '/dashboard/content', label: 'Content' },
              { href: '/dashboard/interview', label: 'Interview' },
              { href: '/dashboard/settings', label: 'Settings' },
            ].map(item => (
              <Link key={item.href} href={item.href}
                className="text-gray-500 hover:text-gray-900 transition-colors">
                {item.label}
              </Link>
            ))}
          </nav>
          <a href="/account" className="text-sm text-gray-500 hover:text-gray-900">Account</a>
        </div>
      </header>
      <div className="max-w-5xl mx-auto px-6 py-10">{children}</div>
    </div>
  )
}
