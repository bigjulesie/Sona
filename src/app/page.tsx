import { createServerSupabaseClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { LandingPage } from '@/components/sona/LandingPage'
import { getBrand } from '@/lib/brand'

export default async function Home() {
  const [brand, supabase] = await Promise.all([getBrand(), createServerSupabaseClient()])
  const { data: { user } } = await supabase.auth.getUser()

  if (brand === 'sona') {
    if (user) redirect('/home')
    return <LandingPage />
  }

  if (user) redirect('/chat')
  redirect('/login')
}
