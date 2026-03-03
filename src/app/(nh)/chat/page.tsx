import { createServerSupabaseClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { ChatLayout } from '@/components/chat/ChatLayout'

export default async function ChatPage() {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const { data: portraits } = await supabase
    .from('portraits')
    .select('id, display_name, voice_enabled')
    .order('created_at', { ascending: true })

  if (!portraits || portraits.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center text-stone-500 text-sm">
        No portrait configured yet.
      </div>
    )
  }

  return <ChatLayout portraits={portraits} />
}
