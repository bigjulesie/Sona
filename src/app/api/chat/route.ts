import { NextRequest } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { retrieveRelevantChunks } from '@/lib/rag/retrieve'
import Anthropic from '@anthropic-ai/sdk'

export async function POST(request: NextRequest) {
  const anthropic = new Anthropic()
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return new Response('Unauthorized', { status: 401 })
  }

  const { message, conversation_id, portrait_id } = await request.json()

  if (!message || !portrait_id) {
    return new Response('message and portrait_id are required', { status: 400 })
  }

  // Get portrait system prompt
  const { data: portrait } = await supabase
    .from('portraits')
    .select('system_prompt, display_name')
    .eq('id', portrait_id)
    .single()

  if (!portrait) {
    return new Response('Portrait not found', { status: 404 })
  }

  // Retrieve relevant knowledge chunks (RLS filters by user tier)
  const chunks = await retrieveRelevantChunks(supabase, message, portrait_id)

  // Build context from retrieved chunks
  const context = chunks
    .map((c: { source_title?: string; content: string }) =>
      `[Source: ${c.source_title ?? 'Unknown'}]\n${c.content}`
    )
    .join('\n\n---\n\n')

  // Get or create conversation
  let convId = conversation_id
  if (!convId) {
    const { data: conv } = await supabase
      .from('conversations')
      .insert({ user_id: user.id, portrait_id, title: message.slice(0, 100) })
      .select('id')
      .single()
    convId = conv?.id
  }

  // Get conversation history
  const { data: history } = await supabase
    .from('messages')
    .select('role, content')
    .eq('conversation_id', convId)
    .order('created_at', { ascending: true })
    .limit(20)

  // Save user message
  await supabase.from('messages').insert({
    conversation_id: convId,
    role: 'user',
    content: message,
    chunks_referenced: chunks.map((c: { id: string }) => c.id),
  })

  // Build messages array for Claude
  const messages: Anthropic.MessageParam[] = [
    ...(history ?? []).map(m => ({
      role: m.role as 'user' | 'assistant',
      content: m.content,
    })),
    { role: 'user', content: message },
  ]

  // System prompt with RAG context
  const systemPrompt = `${portrait.system_prompt}

---
REFERENCE MATERIAL (from ${portrait.display_name}'s own words and writings):

${context}

---
Use the reference material above to ground your responses in what ${portrait.display_name} has actually said and expressed. If the reference material doesn't contain relevant information for the question, draw on the persona description but note that you're speaking more generally.`

  // Stream response
  const stream = await anthropic.messages.stream({
    model: 'claude-sonnet-4-6',
    max_tokens: 2048,
    system: systemPrompt,
    messages,
  })

  const encoder = new TextEncoder()
  const readable = new ReadableStream({
    async start(controller) {
      let fullResponse = ''

      for await (const event of stream) {
        if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
          fullResponse += event.delta.text
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ text: event.delta.text })}\n\n`))
        }
      }

      // Save assistant message
      await supabase.from('messages').insert({
        conversation_id: convId,
        role: 'assistant',
        content: fullResponse,
      })

      // Audit log
      const { createAdminClient } = await import('@/lib/supabase/admin')
      const adminSupabase = createAdminClient()
      await adminSupabase.from('audit_log').insert({
        user_id: user.id,
        action: 'chat',
        resource_type: 'conversation',
        resource_id: convId,
        metadata: { portrait_id, chunks_used: chunks.length },
      })

      controller.enqueue(encoder.encode(`data: ${JSON.stringify({ done: true, conversation_id: convId })}\n\n`))
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
