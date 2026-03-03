import { redirect } from 'next/navigation'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { completeOnboarding } from './actions'

export default async function OnboardingPage() {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('onboarding_complete')
    .eq('id', user.id)
    .single()

  if (profile?.onboarding_complete) redirect('/dashboard')

  return (
    <main className="min-h-screen flex items-center justify-center px-4">
      <div className="max-w-lg w-full">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Welcome to Sona</h1>
        <p className="text-gray-500 mb-10">What would you like to do first?</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <form action={completeOnboarding.bind(null, 'create')}>
            <button type="submit"
              className="w-full p-6 rounded-2xl border-2 border-gray-200 hover:border-gray-900 text-left transition-colors">
              <div className="text-2xl mb-3">✦</div>
              <h2 className="font-semibold text-gray-900 mb-1">Create my Sona</h2>
              <p className="text-sm text-gray-500">Build your digital presence and share it with the world.</p>
            </button>
          </form>
          <form action={completeOnboarding.bind(null, 'explore')}>
            <button type="submit"
              className="w-full p-6 rounded-2xl border-2 border-gray-200 hover:border-gray-900 text-left transition-colors">
              <div className="text-2xl mb-3">◎</div>
              <h2 className="font-semibold text-gray-900 mb-1">Explore Sonas</h2>
              <p className="text-sm text-gray-500">Discover and connect with remarkable people.</p>
            </button>
          </form>
        </div>
      </div>
    </main>
  )
}
