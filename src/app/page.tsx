import { headers } from 'next/headers'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { LandingPage } from '@/components/sona/LandingPage'

export default async function Home() {
  const hdrs = await headers()
  const brand = hdrs.get('x-brand') ?? 'nh'

  if (brand === 'sona') {
    return <LandingPage />
  }

  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (user) redirect('/chat')
  redirect('/login')
}
