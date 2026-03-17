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
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null)
  const transcriptRef = useRef<string>('')
  const transcriptWindowRef = useRef<string>('')  // rolling 90s window
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const contributingRef = useRef(false)  // mutual exclusion
  // Issue 1: keep onAside in a ref so the recursive timer always sees the latest callback
  const onAsideRef = useRef(onAside)
  // Issue 2: guard against double-tap race before state flush
  const inviteInFlightRef = useRef(false)
  // Issue 3: track whether audio capture is running
  const activeRef = useRef(false)

  // Keep onAsideRef in sync with the latest prop value
  useEffect(() => { onAsideRef.current = onAside }, [onAside])

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
              // Issue 1: use ref so stale closure doesn't capture an old callback
              onAsideRef.current({
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
        // Issue 3: only reschedule if audio capture is still active
        if (activeRef.current) scheduleContribution(currentSessionId)
      }
    }, cadenceMs)
  }, [])

  const stopStream = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current)
      timerRef.current = null
    }
    // Issue 3: mark as inactive before disconnecting
    activeRef.current = false
    // Issue 4: disconnect the source node explicitly
    if (sourceRef.current) {
      sourceRef.current.disconnect()
      sourceRef.current = null
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
      const url = `wss://api.deepgram.com/v1/listen?model=nova-2&smart_format=true&interim_results=false&token=${encodeURIComponent(token)}`
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
    // Issue 4: store source node so stopStream can disconnect it
    sourceRef.current = source
    // eslint-disable-next-line @typescript-eslint/no-deprecated
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

    // Issue 3: mark as active now that audio pipeline is running
    activeRef.current = true
    return true
  }, [openDeepgramSocket, onError])

  const invite = useCallback(async () => {
    // Issue 2: guard against double-tap race before state flush
    if (status !== 'idle' || inviteInFlightRef.current) return
    inviteInFlightRef.current = true

    try {
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
    } finally {
      inviteInFlightRef.current = false
    }
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
