import { redirect } from 'next/navigation'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { SonaNav } from '@/components/sona/SonaNav'
import { DashboardSubNav } from './DashboardSubNav'

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: portrait } = await supabase
    .from('portraits')
    .select('display_name, is_public')
    .eq('creator_id', user.id)
    .maybeSingle()

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#fff' }}>
      <SonaNav />
      {portrait && (
        <DashboardSubNav
          portraitName={portrait.display_name}
          isPublic={portrait.is_public ?? false}
        />
      )}
      <div style={{ maxWidth: 1080, margin: '0 auto', padding: '40px clamp(24px, 4vw, 48px)' }}>
        {children}
      </div>
    </div>
  )
}
