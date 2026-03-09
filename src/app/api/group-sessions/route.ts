import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'

export async function POST(request: NextRequest) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { portrait_id } = await request.json()
  if (!portrait_id) return NextResponse.json({ error: 'portrait_id required' }, { status: 400 })

  // Verify portrait exists and subscriber can access it
  const { data: portrait } = await supabase
    .from('portraits')
    .select('id, display_name')
    .eq('id', portrait_id)
    .single()
  if (!portrait) return NextResponse.json({ error: 'Portrait not found' }, { status: 404 })

  // Create the conversation that will hold the Sona's asides
  const { data: conversation, error: convError } = await supabase
    .from('conversations')
    .insert({
      user_id: user.id,
      portrait_id,
      title: `In the room with ${portrait.display_name}`,
    })
    .select('id')
    .single()

  if (convError || !conversation) {
    return NextResponse.json({ error: 'Failed to create conversation' }, { status: 500 })
  }

  // Create the group session linked to the conversation
  const { data: session, error: sessionError } = await supabase
    .from('group_sessions')
    .insert({
      subscriber_id: user.id,
      portrait_id,
      conversation_id: conversation.id,
      status: 'active',
      mode: 'listening',
    })
    .select('id')
    .single()

  if (sessionError || !session) {
    return NextResponse.json({ error: 'Failed to create session' }, { status: 500 })
  }

  // Update the conversation with the session ID (now that we have it)
  await supabase
    .from('conversations')
    .update({ group_session_id: session.id })
    .eq('id', conversation.id)

  return NextResponse.json({
    session_id: session.id,
    conversation_id: conversation.id,
  })
}
