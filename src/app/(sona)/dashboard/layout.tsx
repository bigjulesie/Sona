import { redirect } from 'next/navigation'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { DashboardNav } from './DashboardNav'

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#fff' }}>
      <DashboardNav />
      <div style={{ maxWidth: 1080, margin: '0 auto', padding: '40px clamp(24px, 4vw, 48px)' }}>
        {children}
      </div>
    </div>
  )
}
