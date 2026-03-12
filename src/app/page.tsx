import { createServerSupabaseClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { LandingPage } from '@/components/sona/LandingPage'
import { HoldingPage } from '@/components/sona/HoldingPage'
import { getBrand } from '@/lib/brand'
import { cookies } from 'next/headers'

export default async function Home() {
  const [brand, supabase] = await Promise.all([getBrand(), createServerSupabaseClient()])
  const { data: { user } } = await supabase.auth.getUser()

  if (brand === 'sona') {
    const cookieStore = await cookies()
    const hasInvite = cookieStore.get('sona-invite')?.value === '1'
    if (!hasInvite) return <HoldingPage />
    if (user) redirect('/home')
    return <LandingPage />
  }

  if (user) redirect('/chat')
  redirect('/login')
}
