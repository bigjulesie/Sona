# In the Room — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build the "In the Room" group conversation listening mode — a subscriber invites their Sona to listen to a live conversation via microphone and receive private asides in their existing Sona conversation thread.

**Architecture:** Ten sequential tasks. The DB migration and `MessageBubble` variant are the foundation everything else builds on. The Deepgram temporary token route enables client-side WebSocket streaming without server-side WebSocket infrastructure. The `useGroupSession` hook wires audio capture, transcript accumulation, pace detection, and contribution triggering into a single composable unit that `ChatInterface` consumes.

**Tech Stack:** Next.js 16 App Router, TypeScript, Supabase (Postgres + RLS), Deepgram streaming WebSocket, Anthropic SDK streaming, MediaStream API, React hooks

**Design doc:** `docs/plans/2026-03-09-in-the-room-design.md` — read before starting. Every decision in this plan is grounded in that document.

---

## Task 1: Database migration — group_sessions table

**Files:**
- Create: `supabase/migrations/00017_group_sessions.sql`

---

**Step 1: Read the existing migrations for context**

Read `supabase/migrations/00009_profiles_subscriptions.sql` to understand the pattern for creating tables with RLS. Read `supabase/migrations/00001_core_schema.sql` lines 44–53 to see how `conversations` is structured — `group_sessions` links to it.

---

**Step 2: Write the migration**

Create `supabase/migrations/00017_group_sessions.sql`:

```sql
-- Group sessions track the lifecycle of an "In the Room" listening session.
-- Each session links to a conversation where the Sona's asides are stored as messages.
-- Raw audio transcript is always ephemeral — never stored here.

CREATE TABLE group_sessions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subscriber_id   UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  portrait_id     UUID NOT NULL REFERENCES portraits(id) ON DELETE CASCADE,
  conversation_id UUID REFERENCES conversations(id) ON DELETE SET NULL,
  status          TEXT NOT NULL DEFAULT 'active'
                    CHECK (status IN ('active', 'paused', 'ended')),
  mode            TEXT NOT NULL DEFAULT 'listening'
                    CHECK (mode IN ('listening', 'active')),
  started_at      TIMESTAMPTZ DEFAULT now(),
  ended_at        TIMESTAMPTZ,
  created_at      TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_group_sessions_subscriber ON group_sessions(subscriber_id);
CREATE INDEX idx_group_sessions_portrait   ON group_sessions(portrait_id);

ALTER TABLE group_sessions ENABLE ROW LEVEL SECURITY;

-- Subscribers manage their own sessions
CREATE POLICY "subscribers_own_group_sessions" ON group_sessions
  FOR ALL USING (subscriber_id = auth.uid());

-- Service role has full access (for PATCH from API routes using admin client)
CREATE POLICY "service_role_group_sessions" ON group_sessions
  FOR ALL USING (auth.role() = 'service_role');

-- Link conversations back to the group session that spawned them
ALTER TABLE conversations
  ADD COLUMN IF NOT EXISTS group_session_id UUID
    REFERENCES group_sessions(id) ON DELETE SET NULL;

CREATE INDEX idx_conversations_group_session
  ON conversations(group_session_id)
  WHERE group_session_id IS NOT NULL;
```

---

**Step 3: Apply the migration**

```bash
npx supabase db push
```
Expected: Migration applies without error. `group_sessions` table created. `conversations.group_session_id` column added.

---

**Step 4: Commit**

```bash
git add supabase/migrations/00017_group_sessions.sql
git commit -m "feat: group_sessions table for In the Room listening mode

Tracks session lifecycle (active/paused/ended), links to the conversation
where Sona asides are stored. conversations.group_session_id FK added.
Raw audio transcript is never stored — ephemeral by design."
```

---

## Task 2: MessageBubble aside variant

The aside variant is the single most visible brand decision in this feature. The coral left border with flat left radius must feel like a presence signal, not a notification.

**Files:**
- Modify: `src/components/chat/MessageBubble.tsx`

---

**Step 1: Read the current MessageBubble**

Read `src/components/chat/MessageBubble.tsx` in full. The current interface is:
```typescript
interface MessageBubbleProps {
  role: 'user' | 'assistant'
  content: string
  portraitName?: string
  onPlayTTS?: () => void
  isPlayingTTS?: boolean
}
```
There is no `variant` prop. We add one.

---

**Step 2: Add the variant prop and aside rendering**

Replace the `MessageBubbleProps` interface and `MessageBubble` function entirely with:

```typescript
interface MessageBubbleProps {
  role: 'user' | 'assistant'
  content: string
  portraitName?: string
  onPlayTTS?: () => void
  isPlayingTTS?: boolean
  variant?: 'aside'  // proactive listening aside — coral left border treatment
}

export function MessageBubble({
  role,
  content,
  portraitName,
  onPlayTTS,
  isPlayingTTS,
  variant,
}: MessageBubbleProps) {
  const isUser = role === 'user'
  const isAside = variant === 'aside'

  // Aside variant: coral left border, flat left radius, fafafa background
  if (isAside) {
    return (
      <div style={{
        display: 'flex',
        justifyContent: 'flex-start',
        marginBottom: 20,
      }}>
        <div style={{
          maxWidth: '80%',
          padding: '14px 18px',
          backgroundColor: '#fafafa',
          border: '1px solid rgba(0,0,0,0.06)',
          borderLeft: '2px solid #DE3E7B',   // inline — Tailwind v4 safe
          borderRadius: '0 20px 20px 0',      // flat left edge is load-bearing
        }}>
          {portraitName && (
            <p style={{
              fontFamily: GEIST,
              fontSize: '0.625rem',
              fontWeight: 500,
              letterSpacing: '0.1em',
              textTransform: 'uppercase',
              color: '#DE3E7B',               // coral for aside name label
              margin: '0 0 8px',
            }}>
              {portraitName}
            </p>
          )}
          <p style={{
            fontFamily: GEIST,
            fontSize: '0.9375rem',
            fontWeight: 300,
            lineHeight: 1.65,
            color: '#1a1a1a',
            margin: 0,
            whiteSpace: 'pre-wrap',
          }}>
            {renderMarkdown(content)}
          </p>
        </div>
      </div>
    )
  }

  // Standard variant (unchanged)
  return (
    <div style={{
      display: 'flex',
      justifyContent: isUser ? 'flex-end' : 'flex-start',
      marginBottom: 20,
    }}>
      <div style={{
        maxWidth: '72%',
        padding: '14px 18px',
        borderRadius: isUser ? '20px 20px 4px 20px' : '20px 20px 20px 4px',
        backgroundColor: isUser ? '#1a1a1a' : '#f5f5f5',
        border: isUser ? 'none' : '1px solid rgba(0,0,0,0.06)',
      }}>
        {!isUser && portraitName && (
          <p style={{
            fontFamily: GEIST,
            fontSize: '0.625rem',
            fontWeight: 500,
            letterSpacing: '0.1em',
            textTransform: 'uppercase',
            color: '#b0b0b0',
            margin: '0 0 8px',
          }}>
            {portraitName}
          </p>
        )}
        <p style={{
          fontFamily: GEIST,
          fontSize: '0.9375rem',
          fontWeight: 300,
          lineHeight: 1.65,
          color: isUser ? '#fff' : '#1a1a1a',
          margin: 0,
          whiteSpace: 'pre-wrap',
        }}>
          {renderMarkdown(content)}
        </p>
        {onPlayTTS && (
          <button
            onClick={onPlayTTS}
            title={isPlayingTTS ? 'Playing…' : 'Listen'}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              marginTop: 10,
              background: 'none',
              border: 'none',
              padding: 0,
              cursor: 'pointer',
              fontFamily: GEIST,
              fontSize: '0.75rem',
              fontWeight: 400,
              color: isPlayingTTS ? '#DE3E7B' : '#b0b0b0',
              transition: 'color 0.15s ease',
            }}
          >
            <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor">
              {isPlayingTTS ? (
                <>
                  <rect x="2" y="2" width="3" height="8" rx="1" />
                  <rect x="7" y="2" width="3" height="8" rx="1" />
                </>
              ) : (
                <path d="M3 2l7 4-7 4V2z" />
              )}
            </svg>
            {isPlayingTTS ? 'Playing' : 'Listen'}
          </button>
        )}
      </div>
    </div>
  )
}
```

---

**Step 3: Add the presence-pulse animation to globals.css**

Read `src/app/globals.css`. Add after the existing `@keyframes` blocks:

```css
@keyframes presence-pulse {
  0%, 100% { opacity: 1; transform: scale(1); }
  50%       { opacity: 0.45; transform: scale(0.88); }
}

@media (prefers-reduced-motion: reduce) {
  .presence-dot { animation: none !important; }
}
```

---

**Step 4: Build check**

```bash
npm run build
```
Expected: `✓ Compiled successfully` — no type errors.

---

**Step 5: Commit**

```bash
git add src/components/chat/MessageBubble.tsx src/app/globals.css
git commit -m "feat: MessageBubble aside variant for In the Room listening asides

Adds variant='aside' prop: coral left border (2px #DE3E7B), flat left
radius (0 20px 20px 0), coral name label. Driven by msg.metadata.trigger.
Adds presence-pulse keyframe (2.8s) with prefers-reduced-motion guard."
```

---

## Task 3: Deepgram temporary token route

The client cannot hold the Deepgram API key. This route issues a short-lived token so the client can open a WebSocket directly to Deepgram. This avoids server-side WebSocket infrastructure entirely.

**Files:**
- Create: `src/app/api/deepgram-token/route.ts`

---

**Step 1: Understand the pattern**

Read `src/app/api/transcribe/route.ts` for the auth + rate-limit pattern to follow. The new route follows the same structure but calls Deepgram's token endpoint instead of the listen endpoint.

---

**Step 2: Write the route**

Create `src/app/api/deepgram-token/route.ts`:

```typescript
import { NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'

// Issues a short-lived Deepgram token so the client can open a WebSocket
// directly to Deepgram for real-time streaming transcription.
// Tokens are valid for 30 seconds — enough to establish the WebSocket connection.
export async function POST() {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  if (!process.env.DEEPGRAM_API_KEY) {
    return NextResponse.json({ error: 'DEEPGRAM_API_KEY not configured' }, { status: 500 })
  }

  try {
    const res = await fetch('https://api.deepgram.com/v1/auth/grant', {
      method: 'POST',
      headers: {
        Authorization: `Token ${process.env.DEEPGRAM_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        time_to_live_in_seconds: 30,
      }),
    })

    if (!res.ok) {
      const text = await res.text()
      return NextResponse.json({ error: `Deepgram token error: ${text}` }, { status: 500 })
    }

    const { key } = await res.json()
    return NextResponse.json({ token: key })
  } catch {
    return NextResponse.json({ error: 'Token service unavailable' }, { status: 500 })
  }
}
```

---

**Step 3: Build check**

```bash
npm run build
```
Expected: `✓ Compiled successfully`

---

**Step 4: Commit**

```bash
git add src/app/api/deepgram-token/route.ts
git commit -m "feat: Deepgram temporary token route for client-side streaming

Issues a 30-second Deepgram token so the client can open a WebSocket
directly to Deepgram. Avoids server-side WebSocket proxy infrastructure.
Auth-gated — only authenticated subscribers can request tokens."
```

---

## Task 4: Group sessions API routes

Two routes: create a session (POST) and update its status (PATCH).

**Files:**
- Create: `src/app/api/group-sessions/route.ts`
- Create: `src/app/api/group-sessions/[id]/route.ts`

---

**Step 1: Read the conversations route for pattern reference**

Read `src/app/api/conversations/route.ts` to see how conversations are created — the group session creation follows the same pattern (create session + create linked conversation in one request).

---

**Step 2: Create the POST route**

Create `src/app/api/group-sessions/route.ts`:

```typescript
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
```

---

**Step 3: Create the PATCH route**

Create `src/app/api/group-sessions/[id]/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const { status } = await request.json()

  if (!['active', 'paused', 'ended'].includes(status)) {
    return NextResponse.json({ error: 'Invalid status' }, { status: 400 })
  }

  const update: Record<string, unknown> = { status }
  if (status === 'ended') update.ended_at = new Date().toISOString()

  const { error } = await supabase
    .from('group_sessions')
    .update(update)
    .eq('id', id)
    .eq('subscriber_id', user.id) // RLS + explicit check

  if (error) return NextResponse.json({ error: 'Update failed' }, { status: 500 })

  return NextResponse.json({ ok: true })
}
```

---

**Step 4: Build check**

```bash
npm run build
```
Expected: `✓ Compiled successfully`

---

**Step 5: Commit**

```bash
git add src/app/api/group-sessions/route.ts src/app/api/group-sessions/[id]/route.ts
git commit -m "feat: group sessions API — create and update session lifecycle

POST /api/group-sessions creates session + linked conversation atomically.
PATCH /api/group-sessions/[id] updates status (active/paused/ended).
Subscriber-scoped — RLS + explicit subscriber_id check on PATCH."
```

---

## Task 5: Contribute API route

The core of the feature. Receives a transcript window, retrieves relevant knowledge chunks, builds the listening-aside system prompt, and streams the Sona's thought back.

**Files:**
- Create: `src/app/api/group-sessions/[id]/contribute/route.ts`

---

**Step 1: Read the chat route for the RAG + streaming pattern**

Read `src/app/api/chat/route.ts` in full. The contribute route follows the same pattern: RAG retrieval → system prompt → Anthropic stream → save message → return stream. The key difference is the system prompt and that the "user message" is the transcript, not a direct subscriber query.

---

**Step 2: Create the contribute route**

Create `src/app/api/group-sessions/[id]/contribute/route.ts`:

```typescript
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
```

---

**Step 3: Build check**

```bash
npm run build
```
Expected: `✓ Compiled successfully`

---

**Step 4: Commit**

```bash
git add src/app/api/group-sessions/[id]/contribute/route.ts
git commit -m "feat: group session contribute route for In the Room listening asides

Receives transcript window, runs RAG retrieval, builds listening-aside
system prompt, streams Sona response (max 400 tokens — concise asides).
Saves aside to linked conversation with trigger='proactive' metadata."
```

---

## Task 6: useGroupSession hook

The hook manages the entire client-side session lifecycle: microphone capture, Deepgram WebSocket, transcript accumulation, pace detection, contribution timer, and mutual exclusion.

**Files:**
- Create: `src/lib/hooks/useGroupSession.ts`

---

**Step 1: Read useVoice for MediaStream patterns**

Read `src/lib/hooks/useVoice.ts` to understand how the existing hook opens the microphone and sends audio to the server. `useGroupSession` opens the microphone differently — streaming to Deepgram's WebSocket rather than accumulating and posting a file.

---

**Step 2: Create the hook**

Create `src/lib/hooks/useGroupSession.ts`:

```typescript
'use client'

import { useState, useRef, useCallback, useEffect } from 'react'

export type SessionStatus = 'idle' | 'starting' | 'active' | 'paused' | 'ended' | 'error'

interface GroupSessionMessage {
  id: string
  content: string
  trigger: 'proactive' | 'direct'
  timestamp: number
}

interface UseGroupSessionOptions {
  portraitId: string
  conversationId: string | null
  onAside: (message: GroupSessionMessage) => void
  onError: (message: string) => void
}

// Pace detection: measure wpm over the last 60 seconds
// Fast (>150 wpm) → 90s cadence. Slower → 120s cadence.
function measureWpm(transcript: string, windowMs = 60000): number {
  const words = transcript.trim().split(/\s+/).filter(Boolean).length
  return Math.round((words / windowMs) * 60000)
}

export function useGroupSession({
  portraitId,
  conversationId,
  onAside,
  onError,
}: UseGroupSessionOptions) {
  const [status, setStatus] = useState<SessionStatus>('idle')
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [isContributing, setIsContributing] = useState(false)

  // Refs — not state, so they don't trigger re-renders
  const wsRef = useRef<WebSocket | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const processorRef = useRef<ScriptProcessorNode | null>(null)
  const audioContextRef = useRef<AudioContext | null>(null)
  const transcriptRef = useRef<string>('')
  const transcriptWindowRef = useRef<string>('')  // rolling 90s window
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const contributingRef = useRef(false)  // mutual exclusion

  // Schedule next contribution based on current pace
  const scheduleContribution = useCallback((currentSessionId: string) => {
    if (timerRef.current) clearTimeout(timerRef.current)
    const wpm = measureWpm(transcriptWindowRef.current)
    const cadenceMs = wpm > 150 ? 90_000 : 120_000

    timerRef.current = setTimeout(async () => {
      // Skip if already contributing (mutual exclusion) or paused
      if (contributingRef.current || !transcriptWindowRef.current.trim()) {
        scheduleContribution(currentSessionId)
        return
      }

      contributingRef.current = true
      setIsContributing(true)

      try {
        const res = await fetch(`/api/group-sessions/${currentSessionId}/contribute`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ transcript: transcriptWindowRef.current }),
        })

        if (!res.ok || !res.body) {
          throw new Error('Contribute request failed')
        }

        const reader = res.body.getReader()
        const decoder = new TextDecoder()
        let fullText = ''

        while (true) {
          const { done, value } = await reader.read()
          if (done) break
          const chunk = decoder.decode(value)
          const lines = chunk.split('\n\n').filter(l => l.startsWith('data: '))
          for (const line of lines) {
            const data = JSON.parse(line.slice(6))
            if (data.text) fullText += data.text
            if (data.done && fullText.trim()) {
              onAside({
                id: crypto.randomUUID(),
                content: fullText.trim(),
                trigger: 'proactive',
                timestamp: Date.now(),
              })
            }
          }
        }
      } catch (err) {
        // Non-fatal — log and continue scheduling
        console.warn('[useGroupSession] contribute failed:', err)
      } finally {
        contributingRef.current = false
        setIsContributing(false)
        scheduleContribution(currentSessionId)
      }
    }, cadenceMs)
  }, [onAside])

  const stopStream = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current)
      timerRef.current = null
    }
    if (processorRef.current) {
      processorRef.current.disconnect()
      processorRef.current = null
    }
    if (audioContextRef.current) {
      audioContextRef.current.close()
      audioContextRef.current = null
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop())
      streamRef.current = null
    }
    if (wsRef.current) {
      wsRef.current.close()
      wsRef.current = null
    }
  }, [])

  const openDeepgramSocket = useCallback(async (token: string): Promise<WebSocket> => {
    return new Promise((resolve, reject) => {
      const url = `wss://api.deepgram.com/v1/listen?model=nova-2&smart_format=true&interim_results=false&token=${token}`
      const ws = new WebSocket(url)

      ws.onopen = () => resolve(ws)
      ws.onerror = () => reject(new Error('Deepgram WebSocket failed to open'))

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data)
          const transcript = data.channel?.alternatives?.[0]?.transcript
          if (transcript?.trim()) {
            transcriptRef.current += ' ' + transcript
            // Rolling window: keep last ~400 words (~90–120s of speech)
            const words = transcriptRef.current.trim().split(/\s+/)
            transcriptWindowRef.current = words.slice(-400).join(' ')
          }
        } catch {
          // Ignore malformed messages
        }
      }
    })
  }, [])

  const start = useCallback(async (currentSessionId: string) => {
    // Request microphone permission
    let stream: MediaStream
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true })
    } catch {
      onError("Your microphone isn't available.")
      return false
    }

    // Fetch a short-lived Deepgram token
    const tokenRes = await fetch('/api/deepgram-token', { method: 'POST' })
    if (!tokenRes.ok) {
      stream.getTracks().forEach(t => t.stop())
      onError('Unable to start listening — try again in a moment.')
      return false
    }
    const { token } = await tokenRes.json()

    // Open Deepgram WebSocket
    let ws: WebSocket
    try {
      ws = await openDeepgramSocket(token)
    } catch {
      stream.getTracks().forEach(t => t.stop())
      onError('Unable to connect to transcription service.')
      return false
    }

    // Stream microphone audio to Deepgram via ScriptProcessorNode
    const audioContext = new AudioContext({ sampleRate: 16000 })
    const source = audioContext.createMediaStreamSource(stream)
    const processor = audioContext.createScriptProcessor(4096, 1, 1)

    processor.onaudioprocess = (e) => {
      if (ws.readyState !== WebSocket.OPEN) return
      const float32 = e.inputBuffer.getChannelData(0)
      // Convert Float32 to Int16 PCM
      const int16 = new Int16Array(float32.length)
      for (let i = 0; i < float32.length; i++) {
        int16[i] = Math.max(-32768, Math.min(32767, float32[i] * 32768))
      }
      ws.send(int16.buffer)
    }

    source.connect(processor)
    processor.connect(audioContext.destination)

    streamRef.current = stream
    wsRef.current = ws
    processorRef.current = processor
    audioContextRef.current = audioContext

    return true
  }, [openDeepgramSocket, onError])

  const invite = useCallback(async () => {
    if (status !== 'idle') return
    setStatus('starting')

    // Create session via API
    const res = await fetch('/api/group-sessions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ portrait_id: portraitId }),
    })

    if (!res.ok) {
      setStatus('error')
      onError('Unable to start session — try again in a moment.')
      return
    }

    const { session_id } = await res.json()
    setSessionId(session_id)

    const started = await start(session_id)
    if (!started) {
      setStatus('error')
      // Update session to ended
      await fetch(`/api/group-sessions/${session_id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'ended' }),
      })
      return
    }

    setStatus('active')
    scheduleContribution(session_id)
  }, [status, portraitId, start, scheduleContribution, onError])

  const pause = useCallback(async () => {
    if (status !== 'active' || !sessionId) return
    // Suspend WebSocket stream (stop sending audio)
    stopStream()
    setStatus('paused')
    await fetch(`/api/group-sessions/${sessionId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'paused' }),
    })
  }, [status, sessionId, stopStream])

  const resume = useCallback(async () => {
    if (status !== 'paused' || !sessionId) return
    const started = await start(sessionId)
    if (!started) return
    setStatus('active')
    await fetch(`/api/group-sessions/${sessionId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'active' }),
    })
    scheduleContribution(sessionId)
  }, [status, sessionId, start, scheduleContribution])

  const leave = useCallback(async () => {
    if (status === 'idle' || status === 'ended' || !sessionId) return
    stopStream()
    setStatus('ended')
    await fetch(`/api/group-sessions/${sessionId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'ended' }),
    })
  }, [status, sessionId, stopStream])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopStream()
    }
  }, [stopStream])

  return {
    status,
    sessionId,
    isContributing,
    invite,
    pause,
    resume,
    leave,
    transcript: transcriptWindowRef,
  }
}
```

---

**Step 3: Build check**

```bash
npm run build
```
Expected: `✓ Compiled successfully`

---

**Step 4: Commit**

```bash
git add src/lib/hooks/useGroupSession.ts
git commit -m "feat: useGroupSession hook — microphone capture, Deepgram streaming, contribution timer

Manages full In the Room session lifecycle: MediaStream → Deepgram WebSocket
→ rolling transcript → pace-aware contribution timer → mutual exclusion guard.
invite/pause/resume/leave controls with server status sync."
```

---

## Task 7: PresenceBar component

The presence indicator row at the top of the conversation. Handles the "in the room" state, the inline controls disclosure, and the single-tap pause affordance.

**Files:**
- Create: `src/components/chat/PresenceBar.tsx`

---

**Step 1: Write the component**

Create `src/components/chat/PresenceBar.tsx`:

```typescript
'use client'

import { useState } from 'react'
import type { SessionStatus } from '@/lib/hooks/useGroupSession'

const GEIST = 'var(--font-geist-sans)'

interface PresenceBarProps {
  portraitName: string
  status: SessionStatus
  onInvite: () => void
  onPause: () => void
  onResume: () => void
  onLeave: () => void
}

export function PresenceBar({
  portraitName,
  status,
  onInvite,
  onPause,
  onResume,
  onLeave,
}: PresenceBarProps) {
  const [controlsOpen, setControlsOpen] = useState(false)

  const isActive = status === 'active'
  const isPaused = status === 'paused'
  const isInRoom = isActive || isPaused
  const isIdle = status === 'idle'
  const isStarting = status === 'starting'

  if (isIdle || status === 'ended') {
    return (
      <div style={{
        padding: '10px clamp(16px, 4vw, 24px)',
        borderBottom: '1px solid rgba(0,0,0,0.05)',
        display: 'flex',
        alignItems: 'center',
      }}>
        <button
          onClick={onInvite}
          style={{
            fontFamily: GEIST,
            fontSize: '0.75rem',
            fontWeight: 400,
            color: '#6b6b6b',
            background: 'none',
            border: '1px solid rgba(0,0,0,0.10)',
            borderRadius: '980px',
            padding: '5px 14px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: 7,
          }}
          aria-label={`Invite ${portraitName} into the room`}
        >
          <span style={{
            width: 6,
            height: 6,
            borderRadius: '50%',
            backgroundColor: '#b0b0b0',
            display: 'inline-block',
            flexShrink: 0,
          }} />
          Invite {portraitName} in
        </button>
      </div>
    )
  }

  if (isStarting) {
    return (
      <div style={{
        padding: '10px clamp(16px, 4vw, 24px)',
        borderBottom: '1px solid rgba(0,0,0,0.05)',
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        minHeight: 40,
      }}>
        <span style={{
          fontFamily: GEIST,
          fontSize: '0.75rem',
          fontWeight: 400,
          color: '#b0b0b0',
        }}>
          Joining the room…
        </span>
      </div>
    )
  }

  return (
    <>
      {/* Presence row — tappable to open controls */}
      <button
        onClick={() => setControlsOpen(o => !o)}
        style={{
          width: '100%',
          padding: '10px clamp(16px, 4vw, 24px)',
          borderBottom: controlsOpen ? 'none' : '1px solid rgba(0,0,0,0.05)',
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          background: 'none',
          border: 'none',
          borderBottom: '1px solid rgba(0,0,0,0.05)',
          cursor: 'pointer',
          textAlign: 'left',
          minHeight: 40,
        }}
        aria-expanded={controlsOpen}
        aria-label={`${portraitName} is in the room — tap to manage`}
      >
        {/* Animated coral dot */}
        <span
          aria-hidden="true"
          className="presence-dot"
          style={{
            width: 7,
            height: 7,
            borderRadius: '50%',
            backgroundColor: isActive ? '#DE3E7B' : '#b0b0b0',
            display: 'inline-block',
            flexShrink: 0,
            animation: isActive ? 'presence-pulse 2.8s ease-in-out infinite' : 'none',
            transition: 'background-color 0.2s ease',
          }}
        />
        <span style={{
          fontFamily: GEIST,
          fontSize: '0.75rem',
          fontWeight: 400,
          color: '#6b6b6b',
          letterSpacing: '0.01em',
          flex: 1,
        }}>
          {isActive
            ? `${portraitName} is in the room`
            : `${portraitName} has stepped out`}
        </span>

        {/* Single-tap pause/resume affordance — no need to open controls */}
        <button
          onClick={(e) => {
            e.stopPropagation()  // don't also toggle controls
            isActive ? onPause() : onResume()
          }}
          style={{
            fontFamily: GEIST,
            fontSize: '0.6875rem',
            fontWeight: 400,
            color: '#b0b0b0',
            background: 'none',
            border: 'none',
            padding: '2px 8px',
            cursor: 'pointer',
            borderRadius: '980px',
            flexShrink: 0,
          }}
          aria-label={isActive ? 'Pause listening' : 'Resume listening'}
        >
          {isActive ? 'Pause' : 'Resume'}
        </button>
      </button>

      {/* Inline controls disclosure */}
      {controlsOpen && (
        <div style={{
          display: 'flex',
          gap: 8,
          padding: '8px clamp(16px, 4vw, 24px) 12px',
          borderBottom: '1px solid rgba(0,0,0,0.05)',
          backgroundColor: '#fff',
        }}>
          <button
            onClick={() => { isActive ? onPause() : onResume(); setControlsOpen(false) }}
            style={{
              fontFamily: GEIST,
              fontSize: '0.75rem',
              fontWeight: 450,
              color: '#6b6b6b',
              background: 'none',
              border: '1px solid rgba(0,0,0,0.10)',
              borderRadius: '980px',
              padding: '6px 14px',
              cursor: 'pointer',
            }}
          >
            {isActive ? 'Step out for a moment' : 'Come back in'}
          </button>
          <button
            onClick={() => { onLeave(); setControlsOpen(false) }}
            style={{
              fontFamily: GEIST,
              fontSize: '0.75rem',
              fontWeight: 450,
              color: '#6b6b6b',
              background: 'none',
              border: '1px solid rgba(0,0,0,0.10)',
              borderRadius: '980px',
              padding: '6px 14px',
              cursor: 'pointer',
            }}
          >
            Leave the room
          </button>
        </div>
      )}
    </>
  )
}
```

---

**Step 2: Build check**

```bash
npm run build
```
Expected: `✓ Compiled successfully`

---

**Step 3: Commit**

```bash
git add src/components/chat/PresenceBar.tsx
git commit -m "feat: PresenceBar component for In the Room presence indicator

Shows animated coral dot + '[Name] is in the room' when active.
Inline controls disclosure (no modal/drawer) for step-out and leave.
Single-tap pause/resume affordance directly in presence row for mobile."
```

---

## Task 8: Wire it all into ChatInterface

Connect `useGroupSession`, `PresenceBar`, session dividers, auto-scroll suppression, and aside message rendering into the existing `ChatInterface`.

**Files:**
- Modify: `src/components/chat/ChatInterface.tsx`

---

**Step 1: Add the session divider type to the messages shape**

In `ChatInterface`, messages come from `useChat`. Dividers are synthetic — rendered by `ChatInterface` itself, not stored in the messages array. They are keyed by the group session's `started_at` / `ended_at` timestamps.

---

**Step 2: Add aside-aware auto-scroll guard**

Replace the current auto-scroll `useEffect` (line 50–52):

```typescript
// Current — scrolls on every message (wrong for in-room mode)
useEffect(() => {
  messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
}, [messages])
```

With:

```typescript
const textareaRef = useRef<HTMLTextAreaElement | null>(null)

useEffect(() => {
  // Suppress auto-scroll when subscriber has focus in the textarea or has unsent text
  // Prevents asides from yanking the screen during active typing
  const textarea = textareaRef.current
  if (textarea && (document.activeElement === textarea || textarea.value.trim())) return
  messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
}, [messages])
```

Pass `textareaRef` down to `ChatInput` via a new `textareaRef` prop.

---

**Step 3: Add useGroupSession and PresenceBar**

Add to the top of `ChatInterface`:

```typescript
import { useGroupSession } from '@/lib/hooks/useGroupSession'
import { PresenceBar } from './PresenceBar'
```

Inside the component, after existing state:

```typescript
const [groupSessionConvId, setGroupSessionConvId] = useState<string | null>(null)
const [groupError, setGroupError] = useState<string | null>(null)
const [asideMessages, setAsideMessages] = useState<Array<{
  id: string; content: string; trigger: 'proactive' | 'direct'; timestamp: number
}>>([])

const {
  status: sessionStatus,
  invite,
  pause,
  resume,
  leave,
} = useGroupSession({
  portraitId,
  conversationId: groupSessionConvId,
  onAside: (msg) => setAsideMessages(prev => [...prev, msg]),
  onError: (msg) => setGroupError(msg),
})
```

---

**Step 4: Add PresenceBar and session divider to the JSX**

In the return block, add `<PresenceBar>` immediately before the message list div:

```typescript
<PresenceBar
  portraitName={portraitName}
  status={sessionStatus}
  onInvite={invite}
  onPause={pause}
  onResume={resume}
  onLeave={leave}
/>
```

Inside the message list, after the empty state block and before the messages map, add the session-start divider when a group session is active:

```typescript
{(sessionStatus === 'active' || sessionStatus === 'paused') && (
  <div style={{
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    margin: '8px 0 20px',
  }}>
    <div style={{ flex: 1, height: 1, backgroundColor: 'rgba(0,0,0,0.07)' }} />
    <span style={{
      fontFamily: GEIST,
      fontSize: '0.6875rem',
      fontWeight: 400,
      color: '#b0b0b0',
      letterSpacing: '0.04em',
      whiteSpace: 'nowrap',
    }}>
      {portraitName} joined the room
    </span>
    <div style={{ flex: 1, height: 1, backgroundColor: 'rgba(0,0,0,0.07)' }} />
  </div>
)}
```

Update the messages map to pass `variant` to `MessageBubble`:

```typescript
{messages.filter(msg => !(isStreaming && msg.role === 'assistant' && msg.content === '')).map((msg) => (
  <MessageBubble
    key={msg.id}
    role={msg.role}
    content={msg.content}
    portraitName={portraitName}
    variant={(msg as { metadata?: { trigger?: string } }).metadata?.trigger === 'proactive' ? 'aside' : undefined}
    onPlayTTS={
      msg.role === 'assistant' && voiceEnabled && !((msg as { metadata?: { trigger?: string } }).metadata?.trigger === 'proactive')
        ? () => {
            if (playingMessageId === msg.id) stopTTS()
            else playTTS(msg.id, msg.content)
          }
        : undefined
    }
    isPlayingTTS={playingMessageId === msg.id}
  />
))}

{/* Proactive asides from current session (not yet in DB-backed messages) */}
{asideMessages.map((aside) => (
  <MessageBubble
    key={aside.id}
    role="assistant"
    content={aside.content}
    portraitName={portraitName}
    variant="aside"
  />
))}
```

Add `aria-live="polite"` and `role="log"` to the message list container div:

```typescript
<div
  role="log"
  aria-live="polite"
  aria-atomic="false"
  style={{ flex: 1, overflowY: 'auto', padding: '32px clamp(16px, 4vw, 24px)' }}
>
```

---

**Step 5: Build check**

```bash
npm run build
```
Expected: `✓ Compiled successfully`. Fix any TypeScript errors — the `messages` type from `useChat` may not include `metadata`; cast as needed or extend the type.

---

**Step 6: Commit**

```bash
git add src/components/chat/ChatInterface.tsx
git commit -m "feat: wire In the Room into ChatInterface

Adds PresenceBar, useGroupSession, session dividers, aside-aware auto-scroll
suppression, aside message variant rendering, and aria-live='polite' on
message log. Proactive asides rendered with coral left border variant."
```

---

## Task 9: ChatInput microphone status indicator

Replace the alarming red recording banner with the calm presence-consistent mic status indicator when in-room mode is active.

**Files:**
- Modify: `src/components/chat/ChatInput.tsx`

---

**Step 1: Add inRoomMode prop and update the component**

Add `inRoomMode?: boolean` and `inRoomMicActive?: boolean` to `ChatInputProps`.

In the component body, suppress the red privacy banner when `inRoomMode` is true. Instead, render the calm mic status below the input:

After the existing red recording banner block (lines 117–144), add a conditional:

```typescript
{/* In-room mic status — replaces red banner when in-room mode is active */}
{inRoomMode && (
  <div style={{
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    padding: '6px clamp(16px, 4vw, 24px) 0',
  }}>
    <span
      className="presence-dot"
      style={{
        width: 6,
        height: 6,
        borderRadius: '50%',
        backgroundColor: inRoomMicActive ? '#DE3E7B' : '#b0b0b0',
        display: 'inline-block',
        animation: inRoomMicActive ? 'presence-pulse 2.8s ease-in-out infinite' : 'none',
        transition: 'background-color 0.2s ease',
      }}
      aria-label={inRoomMicActive ? 'Microphone active, listening to room' : 'Microphone paused'}
    />
    <span style={{
      fontFamily: GEIST,
      fontSize: '0.6875rem',
      fontWeight: 400,
      color: '#b0b0b0',
      letterSpacing: '0.04em',
    }}>
      {inRoomMicActive ? 'Listening' : 'Paused'}
    </span>
  </div>
)}
```

Update the textarea placeholder when `inRoomMode` is true:

```typescript
placeholder={inRoomMode ? `Say something to ${portraitName ?? 'them'}…` : 'Ask a question…'}
```

This requires adding `portraitName?: string` to `ChatInputProps` as well.

Suppress the red recording banner when `inRoomMode` is true — wrap the existing banner block:

```typescript
{/* Privacy banner — visible only while recording and NOT in in-room mode */}
{isRecording && !inRoomMode && (
  // ... existing red banner JSX unchanged ...
)}
```

---

**Step 2: Pass new props from ChatInterface**

In `ChatInterface`, update the `<ChatInput>` render:

```typescript
<ChatInput
  onSend={sendMessage}
  disabled={isStreaming}
  voiceEnabled={voiceEnabled}
  voiceMode={voiceMode}
  onToggleVoice={() => setVoiceMode((v) => !v)}
  onRecordingChange={setIsRecording}
  portraitName={portraitName}
  inRoomMode={sessionStatus === 'active' || sessionStatus === 'paused'}
  inRoomMicActive={sessionStatus === 'active'}
  textareaRef={textareaRef}
/>
```

---

**Step 3: Build check**

```bash
npm run build
```
Expected: `✓ Compiled successfully`

---

**Step 4: Commit**

```bash
git add src/components/chat/ChatInput.tsx src/components/chat/ChatInterface.tsx
git commit -m "feat: ChatInput in-room mode — calm mic indicator, updated placeholder

Suppresses alarming red recording banner during in-room sessions.
Replaces with calm coral/grey dot + 'Listening'/'Paused' label.
Placeholder changes to 'Say something to [Name]…' in room mode."
```

---

## Task 10: End-to-end verification

No code changes — manual verification that all pieces work together.

---

**Step 1: Start the dev server**

```bash
npm run dev
```

---

**Step 2: Open a Sona conversation**

Navigate to a Sona's conversation page. Verify:
- [ ] `PresenceBar` renders above the message list with "Invite [Name] in" button
- [ ] The coral dot is grey and static in idle state

---

**Step 3: Invite the Sona in**

Click "Invite [Name] in":
- [ ] Browser prompts for microphone permission — grant it
- [ ] Status transitions to "active"
- [ ] Coral dot appears, pulsing at a calm rate
- [ ] "[Name] is in the room" text visible
- [ ] Session divider appears in the message thread
- [ ] Supabase: `group_sessions` row created with `status='active'`
- [ ] Supabase: `conversations` row created with `group_session_id` set

---

**Step 4: Speak for 90–120 seconds**

Say something aloud near the microphone. After the contribution timer fires:
- [ ] A proactive aside message appears in the thread with coral left border
- [ ] The Sona's name above the aside is in coral
- [ ] Supabase: `messages` row inserted with `metadata.trigger='proactive'`

---

**Step 5: Direct address**

Type a message in the input:
- [ ] Placeholder reads "Say something to [Name]…"
- [ ] Message sends normally via the existing chat API
- [ ] Response appears as a standard (non-aside) message

---

**Step 6: Pause**

Click "Pause" in the presence bar:
- [ ] Coral dot turns grey, static
- [ ] "[Name] has stepped out" text
- [ ] Supabase: `group_sessions.status` updated to `'paused'`
- [ ] No further contributions arrive while paused

---

**Step 7: Resume and leave**

Click "Resume", then open controls and click "Leave the room":
- [ ] Session ends cleanly
- [ ] "[Name] left the room" divider does NOT appear yet (that's a future enhancement)
- [ ] Supabase: `group_sessions.status='ended'`, `ended_at` set
- [ ] `PresenceBar` returns to idle state with "Invite in" button

---

**Step 8: Final build check**

```bash
npm run build
```
Expected: `✓ Compiled successfully` with no errors.

---

**Step 9: Commit**

```bash
git add -A
git commit -m "feat: In the Room — end-to-end verified

Group conversation listening mode complete. Sona listens via Deepgram
streaming, contributes proactive asides every 90-120s, responds to direct
subscriber queries. Ephemeral transcript, persistent Sona thoughts."
```

---

## Summary

| Task | What it delivers |
|---|---|
| 1 | `group_sessions` table + `conversations.group_session_id` |
| 2 | `MessageBubble` aside variant — coral left border |
| 3 | Deepgram temporary token route |
| 4 | Group sessions POST + PATCH routes |
| 5 | Contribute route — listening-aside prompt + streaming |
| 6 | `useGroupSession` hook — full session lifecycle |
| 7 | `PresenceBar` component |
| 8 | `ChatInterface` wired with everything |
| 9 | `ChatInput` in-room mode |
| 10 | End-to-end verification |
