import { createServerSupabaseClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { ChatInterface } from '@/components/chat/ChatInterface'

export default async function ChatPage() {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  // Get the first portrait (single-portrait for Phase 1)
  const { data: portrait } = await supabase
    .from('portraits')
    .select('id, display_name')
    .limit(1)
    .single()

  if (!portrait) {
    return (
      <div className="flex-1 flex items-center justify-center text-stone-500 text-sm">
        No portrait configured yet.
      </div>
    )
  }

  return (
    <div className="flex-1 flex flex-col">
      <ChatInterface
        portraitId={portrait.id}
        portraitName={portrait.display_name}
      />
    </div>
  )
}
