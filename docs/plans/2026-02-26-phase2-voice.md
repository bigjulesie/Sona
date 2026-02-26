# Phase 2 Voice Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add voice input (Deepgram Nova-2) and TTS output (ElevenLabs) to the Sona chat interface, with a clear recording indicator satisfying the platform's trust/privacy ethic.

**Architecture:** Three-endpoint Option B pipeline — `/api/transcribe` (audio→text), existing `/api/chat` (text→text, unchanged), `/api/tts` (text→audio). Client orchestrates steps; `useVoice` hook manages MediaRecorder lifecycle and waveform data; `ChatInterface` owns voice mode state and TTS auto-play.

**Tech Stack:** MediaRecorder API, Web Audio API (AnalyserNode), Deepgram Nova-2 REST, ElevenLabs streaming TTS REST, HTMLAudioElement

---

## Task 1: DB migration — add voice columns to portraits

**Files:**
- Create: `supabase/migrations/00008_add_voice_fields.sql`
- Modify: `src/lib/supabase/types.ts`

**Step 1: Write the migration**

```sql
-- supabase/migrations/00008_add_voice_fields.sql
ALTER TABLE portraits
  ADD COLUMN voice_enabled     BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN voice_provider_id TEXT;
```

**Step 2: Apply migration to local Supabase**

```bash
npx supabase db push
```
Expected: migration applied with no errors. If using remote only, apply via the Supabase dashboard SQL editor.

**Step 3: Update the portraits type in `src/lib/supabase/types.ts`**

Find the `portraits` block (around line 80) and add to all three sections (`Row`, `Insert`, `Update`):

```typescript
// In Row:
voice_enabled: boolean
voice_provider_id: string | null

// In Insert:
voice_enabled?: boolean
voice_provider_id?: string | null

// In Update:
voice_enabled?: boolean
voice_provider_id?: string | null
```

**Step 4: Verify build**

```bash
npm run build
```
Expected: compiles with no type errors.

**Step 5: Commit**

```bash
git add supabase/migrations/00008_add_voice_fields.sql src/lib/supabase/types.ts
git commit -m "feat: add voice_enabled and voice_provider_id columns to portraits"
```

---

## Task 2: Environment variables

**Files:**
- Modify: `.env.local.example`

**Step 1: Add the new variables**

Append to `.env.local.example`:

```
# Deepgram (speech-to-text)
DEEPGRAM_API_KEY=

# ElevenLabs (text-to-speech)
ELEVENLABS_API_KEY=
ELEVENLABS_DEFAULT_VOICE_ID=
```

**Step 2: Add real values to your local `.env.local`**

Obtain:
- `DEEPGRAM_API_KEY` from console.deepgram.com
- `ELEVENLABS_API_KEY` from elevenlabs.io/app/settings/api-keys
- `ELEVENLABS_DEFAULT_VOICE_ID` — go to elevenlabs.io/voice-library, pick a voice, copy its ID from the URL or the voice card

**Step 3: Commit**

```bash
git add .env.local.example
git commit -m "chore: add Deepgram and ElevenLabs env vars to example"
```

---

## Task 3: `/api/transcribe` endpoint

**Files:**
- Create: `src/app/api/transcribe/route.ts`

**Step 1: Create the route**

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'

export async function POST(req: NextRequest) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const formData = await req.formData()
  const audio = formData.get('audio') as Blob | null
  if (!audio) return NextResponse.json({ error: 'audio field required' }, { status: 400 })

  const buffer = await audio.arrayBuffer()

  const dgRes = await fetch(
    'https://api.deepgram.com/v1/listen?model=nova-2&smart_format=true',
    {
      method: 'POST',
      headers: {
        Authorization: `Token ${process.env.DEEPGRAM_API_KEY}`,
        'Content-Type': 'audio/webm',
      },
      body: buffer,
    }
  )

  if (!dgRes.ok) {
    const text = await dgRes.text()
    return NextResponse.json({ error: `Deepgram error: ${text}` }, { status: 500 })
  }

  const data = await dgRes.json()
  const transcript =
    data.results?.channels?.[0]?.alternatives?.[0]?.transcript ?? ''

  return NextResponse.json({ transcript })
}
```

**Step 2: Verify build**

```bash
npm run build
```
Expected: new route `/api/transcribe` appears in build output.

**Step 3: Smoke test manually** (optional but recommended)

Start dev server, open browser console, paste:
```javascript
const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
const rec = new MediaRecorder(stream)
const chunks = []
rec.ondataavailable = e => chunks.push(e.data)
rec.start()
// speak for 3 seconds then:
rec.stop()
await new Promise(r => setTimeout(r, 500))
const blob = new Blob(chunks, { type: 'audio/webm' })
const fd = new FormData(); fd.append('audio', blob, 'test.webm')
const r = await fetch('/api/transcribe', { method: 'POST', body: fd })
console.log(await r.json())
```
Expected: `{ transcript: "your spoken words" }`

**Step 4: Commit**

```bash
git add src/app/api/transcribe/route.ts
git commit -m "feat: add /api/transcribe endpoint using Deepgram Nova-2"
```

---

## Task 4: `/api/tts` endpoint

**Files:**
- Create: `src/app/api/tts/route.ts`

**Step 1: Create the route**

```typescript
import { NextRequest } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'

export async function POST(req: NextRequest) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return new Response('Unauthorized', { status: 401 })

  const { text, portrait_id } = await req.json()
  if (!text || !portrait_id) {
    return new Response('text and portrait_id required', { status: 400 })
  }

  const { data: portrait } = await supabase
    .from('portraits')
    .select('voice_enabled, voice_provider_id')
    .eq('id', portrait_id)
    .single()

  if (!portrait?.voice_enabled) {
    return new Response('Voice not enabled for this portrait', { status: 403 })
  }

  const voiceId =
    portrait.voice_provider_id ?? process.env.ELEVENLABS_DEFAULT_VOICE_ID
  if (!voiceId) {
    return new Response('No voice ID configured', { status: 500 })
  }

  const elRes = await fetch(
    `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}/stream`,
    {
      method: 'POST',
      headers: {
        'xi-api-key': process.env.ELEVENLABS_API_KEY!,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        text,
        model_id: 'eleven_turbo_v2_5',
        voice_settings: { stability: 0.5, similarity_boost: 0.75 },
      }),
    }
  )

  if (!elRes.ok) {
    const error = await elRes.text()
    return new Response(`ElevenLabs error: ${error}`, { status: 500 })
  }

  return new Response(elRes.body, {
    headers: {
      'Content-Type': 'audio/mpeg',
      'Cache-Control': 'no-cache',
    },
  })
}
```

**Step 2: Verify build**

```bash
npm run build
```
Expected: `/api/tts` appears in build output.

**Step 3: Commit**

```bash
git add src/app/api/tts/route.ts
git commit -m "feat: add /api/tts endpoint proxying ElevenLabs streaming audio"
```

---

## Task 5: `useVoice` hook

**Files:**
- Create: `src/lib/hooks/useVoice.ts`

**Step 1: Create the hook**

```typescript
'use client'

import { useState, useRef, useCallback } from 'react'

export type VoiceStatus = 'idle' | 'recording' | 'transcribing'

interface UseVoiceOptions {
  onTranscript: (text: string) => void
}

export function useVoice({ onTranscript }: UseVoiceOptions) {
  const [status, setStatus] = useState<VoiceStatus>('idle')
  const [error, setError] = useState<string | null>(null)
  const [analyser, setAnalyser] = useState<AnalyserNode | null>(null)
  const recorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const streamRef = useRef<MediaStream | null>(null)
  const audioCtxRef = useRef<AudioContext | null>(null)

  const startRecording = useCallback(async () => {
    setError(null)
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      streamRef.current = stream

      // AudioContext must be created (or resumed) on a user gesture — this IS the user gesture.
      const audioCtx = new AudioContext()
      audioCtxRef.current = audioCtx
      const source = audioCtx.createMediaStreamSource(stream)
      const analyserNode = audioCtx.createAnalyser()
      analyserNode.fftSize = 256
      source.connect(analyserNode)
      setAnalyser(analyserNode)

      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : 'audio/webm'

      const recorder = new MediaRecorder(stream, { mimeType })
      chunksRef.current = []
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data)
      }

      recorderRef.current = recorder
      recorder.start()
      setStatus('recording')
    } catch {
      setError('Could not access microphone. Please check your browser permissions.')
      setStatus('idle')
    }
  }, [])

  const stopRecording = useCallback(async () => {
    const recorder = recorderRef.current
    if (!recorder || recorder.state === 'inactive') return

    setStatus('transcribing')
    setAnalyser(null)

    await new Promise<void>((resolve) => {
      recorder.onstop = () => resolve()
      recorder.stop()
    })

    streamRef.current?.getTracks().forEach((t) => t.stop())
    audioCtxRef.current?.close()

    const blob = new Blob(chunksRef.current, { type: 'audio/webm' })
    const formData = new FormData()
    formData.append('audio', blob, 'recording.webm')

    try {
      const res = await fetch('/api/transcribe', { method: 'POST', body: formData })
      if (!res.ok) throw new Error('Transcription failed')
      const { transcript } = await res.json()
      if (transcript?.trim()) {
        onTranscript(transcript.trim())
      }
    } catch {
      setError('Transcription failed. Please try again.')
    } finally {
      setStatus('idle')
    }
  }, [onTranscript])

  return { status, error, analyser, startRecording, stopRecording }
}
```

**Step 2: Verify build**

```bash
npm run build
```
Expected: clean compile.

**Step 3: Commit**

```bash
git add src/lib/hooks/useVoice.ts
git commit -m "feat: add useVoice hook (MediaRecorder + Deepgram transcription)"
```

---

## Task 6: `VoiceWaveform` component

**Files:**
- Create: `src/components/chat/VoiceWaveform.tsx`

**Step 1: Create the component**

Uses `requestAnimationFrame` + direct style mutation (no state updates) to animate 7 bars from `AnalyserNode` data at 60fps without causing React re-renders.

```tsx
'use client'

import { useEffect, useRef } from 'react'

interface Props {
  analyser: AnalyserNode | null
}

const BAR_COUNT = 7

export function VoiceWaveform({ analyser }: Props) {
  const barRefs = useRef<(HTMLDivElement | null)[]>([])
  const rafRef = useRef<number | null>(null)

  useEffect(() => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current)

    if (!analyser) {
      barRefs.current.forEach((el) => el && (el.style.height = '4px'))
      return
    }

    const data = new Uint8Array(analyser.frequencyBinCount)
    const step = Math.floor(data.length / BAR_COUNT)

    function tick() {
      analyser.getByteFrequencyData(data)
      for (let i = 0; i < BAR_COUNT; i++) {
        const value = data[i * step] / 255
        const height = Math.max(4, Math.round(value * 28))
        const el = barRefs.current[i]
        if (el) el.style.height = `${height}px`
      }
      rafRef.current = requestAnimationFrame(tick)
    }

    rafRef.current = requestAnimationFrame(tick)
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
    }
  }, [analyser])

  return (
    <div className="flex items-center gap-[3px] h-8" aria-hidden>
      {Array.from({ length: BAR_COUNT }).map((_, i) => (
        <div
          key={i}
          ref={(el) => { barRefs.current[i] = el }}
          className="w-[3px] rounded-full bg-current"
          style={{ height: '4px', transition: 'none' }}
        />
      ))}
    </div>
  )
}
```

**Step 2: Verify build**

```bash
npm run build
```

**Step 3: Commit**

```bash
git add src/components/chat/VoiceWaveform.tsx
git commit -m "feat: add VoiceWaveform component (AnalyserNode-driven bar visualiser)"
```

---

## Task 7: Update `ChatInput` with voice mode UI

**Files:**
- Modify: `src/components/chat/ChatInput.tsx`

**Step 1: Replace the entire file**

The updated ChatInput accepts four new props: `voiceEnabled`, `voiceMode`, `onToggleVoice`, and `onRecordingChange`. In voice mode the textarea is hidden and replaced by recording controls.

```tsx
'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { useVoice } from '@/lib/hooks/useVoice'
import { VoiceWaveform } from './VoiceWaveform'

interface ChatInputProps {
  onSend: (message: string) => void
  disabled?: boolean
  voiceEnabled?: boolean
  voiceMode?: boolean
  onToggleVoice?: () => void
  onRecordingChange?: (recording: boolean) => void
}

export function ChatInput({
  onSend,
  disabled,
  voiceEnabled = false,
  voiceMode = false,
  onToggleVoice,
  onRecordingChange,
}: ChatInputProps) {
  const [value, setValue] = useState('')
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const handleTranscript = useCallback(
    (text: string) => { onSend(text) },
    [onSend]
  )
  const { status, error, analyser, startRecording, stopRecording } = useVoice({
    onTranscript: handleTranscript,
  })

  // Auto-grow textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`
    }
  }, [value])

  // Notify parent when recording state changes
  useEffect(() => {
    onRecordingChange?.(status === 'recording')
  }, [status, onRecordingChange])

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!value.trim() || disabled) return
    onSend(value.trim())
    setValue('')
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSubmit(e)
    }
  }

  function handleMicClick() {
    if (status === 'idle') startRecording()
    else if (status === 'recording') stopRecording()
  }

  const isRecording = status === 'recording'
  const isTranscribing = status === 'transcribing'

  return (
    <div className="border-t border-brass/20 bg-parchment">
      {/* Privacy banner — visible only while recording */}
      {isRecording && (
        <div className="flex items-center justify-center gap-2 px-4 py-2 bg-red-600/90 text-white text-xs font-medium tracking-wide">
          <span className="w-2 h-2 rounded-full bg-white animate-pulse" />
          Microphone active — tap the mic button to stop
        </div>
      )}

      <form onSubmit={handleSubmit} className="flex items-end gap-3 px-4 md:px-6 py-4">
        {voiceMode ? (
          /* Voice mode controls */
          <div className="flex-1 flex items-center justify-center gap-4 min-h-[44px]">
            {isRecording && (
              <span className="text-red-600">
                <VoiceWaveform analyser={analyser} />
              </span>
            )}
            {isTranscribing && (
              <span className="text-xs text-mist tracking-wide">Transcribing…</span>
            )}
            {status === 'idle' && (
              <span className="text-xs text-mist tracking-wide">Tap mic to speak</span>
            )}
            {error && (
              <span className="text-xs text-red-600">{error}</span>
            )}
          </div>
        ) : (
          /* Text mode */
          <textarea
            ref={textareaRef}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask a question…"
            rows={1}
            disabled={disabled}
            className="flex-1 resize-none bg-vellum border border-brass/20 rounded-xl px-4 py-3
                       text-sm text-ink placeholder:text-mist/60
                       focus:outline-none focus:border-brass
                       disabled:opacity-50 max-h-32 transition-colors"
          />
        )}

        {/* Mic button — only shown when voice is enabled for this Sona */}
        {voiceEnabled && (
          <button
            type="button"
            onClick={handleMicClick}
            disabled={disabled || isTranscribing}
            title={isRecording ? 'Stop recording' : 'Start recording'}
            aria-label={isRecording ? 'Stop recording' : 'Start voice input'}
            className={`p-3 rounded-xl transition-colors shrink-0 relative disabled:opacity-40 ${
              isRecording
                ? 'bg-red-600 text-white'
                : 'bg-vellum border border-brass/20 text-mist hover:text-ink hover:border-brass'
            }`}
          >
            {/* Pulsing ring while recording */}
            {isRecording && (
              <span className="absolute inset-0 rounded-xl border-2 border-red-400 animate-ping opacity-75" />
            )}
            {isTranscribing ? (
              <span className="w-4 h-4 border border-brass/60 border-t-transparent rounded-full animate-spin block" />
            ) : (
              <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                <rect x="5" y="1" width="6" height="9" rx="3" />
                <path d="M2 8a6 6 0 0 0 12 0" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" />
                <line x1="8" y1="14" x2="8" y2="16" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                <line x1="5" y1="16" x2="11" y2="16" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
            )}
          </button>
        )}

        {/* Voice mode toggle — only shown when voice is enabled */}
        {voiceEnabled && (
          <button
            type="button"
            onClick={onToggleVoice}
            title={voiceMode ? 'Switch to text mode' : 'Switch to voice mode'}
            className={`p-3 rounded-xl transition-colors shrink-0 border ${
              voiceMode
                ? 'bg-brass/10 border-brass/40 text-brass'
                : 'bg-vellum border-brass/20 text-mist hover:text-ink hover:border-brass'
            }`}
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
              {voiceMode ? (
                /* keyboard icon */
                <>
                  <rect x="1" y="4" width="14" height="9" rx="1.5" />
                  <line x1="4" y1="7.5" x2="4" y2="7.5" strokeWidth="2" />
                  <line x1="8" y1="7.5" x2="8" y2="7.5" strokeWidth="2" />
                  <line x1="12" y1="7.5" x2="12" y2="7.5" strokeWidth="2" />
                  <line x1="4" y1="10.5" x2="12" y2="10.5" strokeWidth="2" />
                </>
              ) : (
                /* waveform icon */
                <>
                  <path d="M1 8h2M13 8h2M4 5v6M12 5v6M7 3v10M9 3v10" />
                </>
              )}
            </svg>
          </button>
        )}

        {/* Send button — only in text mode */}
        {!voiceMode && (
          <button
            type="submit"
            disabled={disabled || !value.trim()}
            className="px-5 py-3 bg-ink text-parchment rounded-xl text-xs tracking-widest uppercase
                       hover:bg-ink/90 disabled:opacity-40 transition-colors shrink-0"
          >
            Send
          </button>
        )}
      </form>
    </div>
  )
}
```

**Step 2: Verify build**

```bash
npm run build
```
Expected: clean compile, no TypeScript errors.

**Step 3: Commit**

```bash
git add src/components/chat/ChatInput.tsx
git commit -m "feat: add voice mode UI to ChatInput (mic button, waveform, privacy banner)"
```

---

## Task 8: Update `ChatInterface` with TTS auto-play and voice state

**Files:**
- Modify: `src/components/chat/ChatInterface.tsx`
- Modify: `src/components/chat/MessageBubble.tsx`

**Step 1: Update `MessageBubble` to accept a TTS play callback**

Read `src/components/chat/MessageBubble.tsx`, then add a speaker button to assistant messages.

Add `onPlayTTS?: () => void` and `isPlayingTTS?: boolean` props. Inside the assistant message render, add after the content:

```tsx
{onPlayTTS && (
  <button
    onClick={onPlayTTS}
    className={`mt-2 flex items-center gap-1.5 text-xs transition-colors ${
      isPlayingTTS ? 'text-brass' : 'text-mist hover:text-ink'
    }`}
    title={isPlayingTTS ? 'Playing…' : 'Listen'}
  >
    <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor">
      {isPlayingTTS ? (
        /* pause bars */
        <>
          <rect x="2" y="2" width="3" height="8" rx="1" />
          <rect x="7" y="2" width="3" height="8" rx="1" />
        </>
      ) : (
        /* play triangle */
        <path d="M3 2l7 4-7 4V2z" />
      )}
    </svg>
    {isPlayingTTS ? 'Playing' : 'Listen'}
  </button>
)}
```

**Step 2: Replace `ChatInterface.tsx` entirely**

```tsx
'use client'

import { useRef, useEffect, useState, useCallback } from 'react'
import Image from 'next/image'
import { useChat } from '@/lib/hooks/useChat'
import { MessageBubble } from './MessageBubble'
import { ChatInput } from './ChatInput'

interface ChatInterfaceProps {
  portraitId: string
  portraitName: string
  voiceEnabled?: boolean
  initialConversationId?: string
  onConversationChange?: (id: string) => void
}

export function ChatInterface({
  portraitId,
  portraitName,
  voiceEnabled = false,
  initialConversationId,
  onConversationChange,
}: ChatInterfaceProps) {
  const { messages, isStreaming, conversationId, sendMessage, loadConversation } =
    useChat(portraitId)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  // Voice mode state
  const [voiceMode, setVoiceMode] = useState(false)
  const [isRecording, setIsRecording] = useState(false)

  // TTS state
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const [playingMessageId, setPlayingMessageId] = useState<string | null>(null)
  // Track which message IDs have already had TTS auto-played to avoid replaying
  const autoPlayedRef = useRef<Set<string>>(new Set())

  useEffect(() => {
    if (initialConversationId) loadConversation(initialConversationId)
  }, [initialConversationId, loadConversation])

  useEffect(() => {
    if (conversationId) onConversationChange?.(conversationId)
  }, [conversationId, onConversationChange])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // Auto-play TTS when streaming ends in voice mode
  useEffect(() => {
    if (!voiceMode || isStreaming || messages.length === 0) return
    const last = messages[messages.length - 1]
    if (last.role !== 'assistant' || !last.content) return
    if (autoPlayedRef.current.has(last.id)) return
    autoPlayedRef.current.add(last.id)
    playTTS(last.id, last.content)
  }, [isStreaming]) // intentionally only react to streaming state change

  const playTTS = useCallback(
    async (messageId: string, text: string) => {
      if (audioRef.current) {
        audioRef.current.pause()
        audioRef.current.onended = null
        audioRef.current = null
      }
      setPlayingMessageId(messageId)

      try {
        const res = await fetch('/api/tts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text, portrait_id: portraitId }),
        })
        if (!res.ok) { setPlayingMessageId(null); return }

        const blob = await res.blob()
        const url = URL.createObjectURL(blob)
        const audio = new Audio(url)
        audioRef.current = audio
        audio.onended = () => {
          setPlayingMessageId(null)
          URL.revokeObjectURL(url)
        }
        await audio.play()
      } catch {
        setPlayingMessageId(null)
      }
    },
    [portraitId]
  )

  function stopTTS() {
    audioRef.current?.pause()
    audioRef.current = null
    setPlayingMessageId(null)
  }

  // Stop audio when unmounting or switching portraits
  useEffect(() => {
    return () => { audioRef.current?.pause() }
  }, [portraitId])

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-y-auto px-4 md:px-6 py-8">
        {messages.length === 0 && !isRecording && (
          <div className="flex flex-col items-center justify-center h-full gap-5 text-center">
            <Image src="/brand_assets/icon.svg" alt="" width={40} height={40} className="opacity-25" />
            <p className="font-display text-xl text-mist italic">
              Begin your conversation with {portraitName}
            </p>
          </div>
        )}
        {messages.map((msg) => (
          <MessageBubble
            key={msg.id}
            role={msg.role}
            content={msg.content}
            portraitName={portraitName}
            onPlayTTS={
              msg.role === 'assistant' && voiceEnabled
                ? () => {
                    if (playingMessageId === msg.id) stopTTS()
                    else playTTS(msg.id, msg.content)
                  }
                : undefined
            }
            isPlayingTTS={playingMessageId === msg.id}
          />
        ))}
        {isStreaming && (
          <div className="flex justify-start mb-5">
            <div className="bg-vellum border border-brass/20 rounded-2xl rounded-bl-sm px-5 py-4">
              <p className="text-xs tracking-widest uppercase text-brass mb-2">{portraitName}</p>
              <div className="flex gap-1.5 items-center h-4">
                <span className="w-1.5 h-1.5 rounded-full bg-brass/60 animate-bounce [animation-delay:0ms]" />
                <span className="w-1.5 h-1.5 rounded-full bg-brass/60 animate-bounce [animation-delay:150ms]" />
                <span className="w-1.5 h-1.5 rounded-full bg-brass/60 animate-bounce [animation-delay:300ms]" />
              </div>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>
      <ChatInput
        onSend={sendMessage}
        disabled={isStreaming}
        voiceEnabled={voiceEnabled}
        voiceMode={voiceMode}
        onToggleVoice={() => setVoiceMode((v) => !v)}
        onRecordingChange={setIsRecording}
      />
    </div>
  )
}
```

**Step 3: Verify build**

```bash
npm run build
```
Expected: clean compile.

**Step 4: Commit**

```bash
git add src/components/chat/ChatInterface.tsx src/components/chat/MessageBubble.tsx
git commit -m "feat: add TTS auto-play and voice mode state to ChatInterface"
```

---

## Task 9: Wire voice config through chat page and `ChatLayout`

**Files:**
- Modify: `src/app/(authenticated)/chat/page.tsx`
- Modify: `src/components/chat/ChatLayout.tsx`

**Step 1: Update `chat/page.tsx` to select voice fields**

Change the portraits select query to include `voice_enabled`:

```typescript
const { data: portraits } = await supabase
  .from('portraits')
  .select('id, display_name, voice_enabled')
  .order('created_at', { ascending: true })
```

**Step 2: Update `ChatLayout` to pass `voiceEnabled` to `ChatInterface`**

Update the `Portrait` interface:
```typescript
interface Portrait {
  id: string
  display_name: string
  voice_enabled: boolean
}
```

In the JSX where `ChatInterface` is rendered, add:
```tsx
<ChatInterface
  key={selectedPortrait.id}
  portraitId={selectedPortrait.id}
  portraitName={selectedPortrait.display_name}
  voiceEnabled={selectedPortrait.voice_enabled}
  initialConversationId={activeConversationId ?? undefined}
  onConversationChange={handleConversationChange}
/>
```

**Step 3: Verify build**

```bash
npm run build
```
Expected: clean compile, `/chat` route still in output.

**Step 4: Commit**

```bash
git add src/app/(authenticated)/chat/page.tsx src/components/chat/ChatLayout.tsx
git commit -m "feat: pass voice_enabled from portrait through chat page to ChatInterface"
```

---

## Task 10: Admin — add voice fields to Portrait editor

**Files:**
- Modify: `src/app/(authenticated)/admin/portrait/PortraitEditor.tsx`
- Modify: `src/app/(authenticated)/admin/portrait/actions.ts`
- Modify: `src/app/(authenticated)/admin/portrait/page.tsx`

**Step 1: Update `updatePortrait` action to accept voice fields**

In `actions.ts`, update the `updatePortrait` signature:

```typescript
export async function updatePortrait(portraitId: string, fields: {
  display_name: string
  slug: string
  system_prompt: string
  voice_enabled: boolean
  voice_provider_id: string | null
})
```

Update the `.update(fields)` call — the fields object now includes the voice fields, which Supabase will persist automatically.

Also update `createPortrait` to accept optional voice fields (default `voice_enabled: false`):
Add to the insert object:
```typescript
voice_enabled: false,
voice_provider_id: null,
```

**Step 2: Update `PortraitEditor.tsx`**

Update the `Portrait` interface:
```typescript
interface Portrait {
  id: string
  slug: string
  display_name: string
  system_prompt: string
  voice_enabled: boolean
  voice_provider_id: string | null
}
```

Update `PortraitForm` to accept and manage `voice_enabled` and `voice_provider_id`:

Add to the form's initial state (alongside `displayName`, `slug`, `systemPrompt`):
```typescript
const [voiceEnabled, setVoiceEnabled] = useState(initial.voice_enabled)
const [voiceProviderId, setVoiceProviderId] = useState(initial.voice_provider_id ?? '')
```

Update `handleSave` to pass these to `onSave`:
```typescript
const res = await onSave({
  display_name: displayName,
  slug,
  system_prompt: systemPrompt,
  voice_enabled: voiceEnabled,
  voice_provider_id: voiceProviderId || null,
})
```

Add to the form JSX (below the system prompt section, above the Save button):

```tsx
<div className="border-t border-brass/20 pt-5 space-y-4">
  <p className="text-xs tracking-widest uppercase text-mist">Voice</p>

  <div className="flex items-center gap-3">
    <button
      type="button"
      onClick={() => setVoiceEnabled(v => !v)}
      className={`relative inline-flex h-5 w-9 rounded-full border transition-colors ${
        voiceEnabled ? 'bg-brass border-brass' : 'bg-vellum border-brass/30'
      }`}
      aria-pressed={voiceEnabled}
    >
      <span className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-parchment shadow transition-transform ${
        voiceEnabled ? 'translate-x-4' : 'translate-x-0'
      }`} />
    </button>
    <span className="text-sm text-ink">Voice enabled</span>
  </div>

  {voiceEnabled && (
    <div>
      <label className={labelClass}>ElevenLabs Voice ID</label>
      <input
        value={voiceProviderId}
        onChange={e => setVoiceProviderId(e.target.value)}
        placeholder="Leave blank to use default voice"
        className={inputClass}
      />
      <p className="text-xs text-mist/60 mt-1">
        Override the default voice with a specific ElevenLabs voice clone ID.
      </p>
    </div>
  )}
</div>
```

**Step 3: Update `portrait/page.tsx` to select voice fields**

In the page's Supabase query, add `voice_enabled, voice_provider_id` to the select:

```typescript
const { data: portraits } = await supabase
  .from('portraits')
  .select('id, slug, display_name, system_prompt, voice_enabled, voice_provider_id')
  .order('created_at', { ascending: true })
```

Pass them to `PortraitEditor`:
```tsx
<PortraitEditor portraits={portraits ?? []} />
```

(The `portraits` variable now includes the voice fields automatically.)

**Step 4: Update `handleUpdate` and `handleCreate` in PortraitEditor** to pass voice fields through to the server actions. The `onSave` function signature needs to be updated to match:

```typescript
onSave: (fields: {
  display_name: string
  slug: string
  system_prompt: string
  voice_enabled: boolean
  voice_provider_id: string | null
}) => Promise<{ success?: boolean; error?: string }>
```

**Step 5: Verify build**

```bash
npm run build
```
Expected: all routes compile cleanly.

**Step 6: Commit**

```bash
git add src/app/(authenticated)/admin/portrait/
git commit -m "feat: add voice_enabled toggle and voice_provider_id field to portrait admin"
```

---

## Final Verification

```bash
npm run build
```
Expected output includes:
```
├ ƒ /api/transcribe
├ ƒ /api/tts
```

Manual test checklist:
1. Enable voice on a portrait via `/admin/portrait`
2. Open `/chat` — mic and toggle buttons appear in the input area
3. Click toggle to enter voice mode
4. Click mic — privacy banner appears, mic button turns red with pulsing ring, waveform animates
5. Speak, click mic again — banner disappears, "Transcribing…" shows briefly
6. Message appears in chat, Sona responds, audio plays automatically
7. Speaker icon on assistant messages — click to replay, click again to stop
8. Click toggle to return to text mode — textarea reappears, no mic/toggle buttons hidden if voice disabled

---

## Architecture Notes for Future Tasks

**Adding ambient VAD mode (future):** `useVoice` is written to be extended. Add a `mode: 'click' | 'vad'` option; in VAD mode, use `AnalyserNode` silence detection to auto-call `stopRecording()`.

**Migrating to Option A (unified endpoint, future):** Create `/api/voice-chat` that imports the Deepgram and ElevenLabs fetch logic from the modules built here. Client changes from 3 sequential fetches to 1. Estimated 1 day.
