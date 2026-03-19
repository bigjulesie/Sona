import { NextRequest } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { assemblePrompt } from '@/lib/synthesis/assembly'
import Anthropic from '@anthropic-ai/sdk'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return new Response('Unauthorized', { status: 401 })

  const { id: sessionId } = await params

  // Load session + portrait
  const { data: session } = await supabase
    .from('group_sessions')
    .select('portrait_id, conversation_id, status')
    .eq('id', sessionId)
    .eq('subscriber_id', user.id)
    .single()

  if (!session || session.status !== 'active') {
    return new Response('Session not found or not active', { status: 404 })
  }

  const { data: portrait } = await supabase
    .from('portraits')
    .select('system_prompt, display_name')
    .eq('id', session.portrait_id)
    .single()

  if (!portrait) return new Response('Portrait not found', { status: 404 })

  // Assemble base prompt with empty RAG chunks and empty transcript
  const basePrompt = await assemblePrompt(supabase, session.portrait_id, user.id, '', [])

  const systemPrompt = `${basePrompt}

---
You have just been invited into a room to listen to a conversation. Send a single brief, natural message to let the person know you're here and listening. Tell them you'll contribute when you have something worth adding — don't force it. Be warm but concise. One or two sentences maximum. Do not use phrases like "I'm ready" or "I'm here to help" — speak as yourself.`

  const anthropic = new Anthropic()
  const stream = await anthropic.messages.stream({
    model: 'claude-sonnet-4-6',
    max_tokens: 120,
    system: systemPrompt,
    messages: [{ role: 'user', content: '[greeting]' }],
  }, { signal: request.signal })

  const encoder = new TextEncoder()
  const readable = new ReadableStream({
    async start(controller) {
      let fullResponse = ''
      try {
        for await (const event of stream) {
          if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
            fullResponse += event.delta.text
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ text: event.delta.text })}\n\n`))
          }
        }
      } catch (err: unknown) {
        if (err instanceof Error && err.name === 'AbortError') {
          controller.close()
          return
        }
        throw err
      }

      // Save greeting to messages table
      if (session.conversation_id && fullResponse.trim()) {
        await supabase.from('messages').insert({
          conversation_id: session.conversation_id,
          role: 'assistant',
          content: fullResponse,
          metadata: {
            trigger: 'greeting',
            session_mode: 'listening',
            group_session_id: sessionId,
          },
        })
      }

      controller.enqueue(encoder.encode(`data: ${JSON.stringify({ done: true })}\n\n`))
      controller.close()
    },
  })

  return new Response(readable, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    },
  })
}
