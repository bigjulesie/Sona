import { redirect } from 'next/navigation'
import Image from 'next/image'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { OnboardingFlow } from './OnboardingFlow'

export default async function OnboardingPage() {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await (supabase as any)
    .from('profiles')
    .select('onboarding_complete, voice_gender')
    .eq('id', user.id)
    .single() as { data: { onboarding_complete: boolean; voice_gender: 'male' | 'female' | null } | null }

  if (profile?.onboarding_complete) redirect('/dashboard')

  return (
    <main style={{
      minHeight: '100vh',
      backgroundColor: '#fff',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '40px 24px',
    }}>
      <div style={{ marginBottom: 48 }}>
        <Image
          src="/brand_assets/sona/Sona brand on white bg 1.svg"
          alt="Sona"
          width={80}
          height={30}
          priority
        />
      </div>
      <OnboardingFlow voiceGender={(profile as any)?.voice_gender ?? null} />
    </main>
  )
}
