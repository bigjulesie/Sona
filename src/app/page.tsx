import { createServerSupabaseClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { LandingPage } from '@/components/sona/LandingPage'
import { getBrand } from '@/lib/brand'

export default async function Home() {
  const brand = await getBrand()

  if (brand === 'sona') {
    return <LandingPage />
  }

  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (user) redirect('/chat')
  redirect('/login')
}
