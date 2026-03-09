import { NextRequest } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { retrieveRelevantChunks } from '@/lib/rag/retrieve'
import Anthropic from '@anthropic-ai/sdk'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return new Response('Unauthorized', { status: 401 })

  const { id: sessionId } = await params
  const { transcript } = await request.json()
  if (!transcript?.trim()) return new Response('transcript required', { status: 400 })

  // Load session + portrait + conversation
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

  // RAG retrieval — use the transcript as the query
  const chunks = await retrieveRelevantChunks(supabase, transcript, session.portrait_id)
  const context = chunks
    .map((c: { source_title?: string; content: string }) =>
      `[Source: ${c.source_title ?? 'Unknown'}]\n${c.content}`
    )
    .join('\n\n---\n\n')

  // Listening aside system prompt — distinct from the standard conversation prompt
  const systemPrompt = `${portrait.system_prompt}

---
REFERENCE MATERIAL (from ${portrait.display_name}'s own words and writings):

${context || 'No directly relevant material found — draw on the persona description.'}

---
You are currently present in a room, listening to a conversation. You are speaking privately to the person who invited you. The conversation has included the following:

${transcript}

---
Respond as you would if you were physically present — sometimes you will reference what you just heard, sometimes you will offer a broader thought. Always be yourself. Keep your thought concise — you are leaning in, not holding the floor. Do not preface with phrases like "Based on what I heard..." unless it genuinely fits. Speak naturally.`

  const anthropic = new Anthropic()
  const stream = await anthropic.messages.stream({
    model: 'claude-sonnet-4-6',
    max_tokens: 400,    // asides are short — lean in, don't hold the floor
    system: systemPrompt,
    messages: [{ role: 'user', content: '[listening aside]' }],
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

      // Save aside as a message in the linked conversation
      if (session.conversation_id && fullResponse.trim()) {
        await supabase.from('messages').insert({
          conversation_id: session.conversation_id,
          role: 'assistant',
          content: fullResponse,
          metadata: {
            trigger: 'proactive',
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
