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

// Transcribe a 20-second chunk of audio per cycle.
const CHUNK_INTERVAL_MS = 20_000

// Pace detection: measure wpm over the last 60 seconds
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

  const streamRef = useRef<MediaStream | null>(null)
  const recorderRef = useRef<MediaRecorder | null>(null)
  const transcriptRef = useRef<string>('')
  const transcriptWindowRef = useRef<string>('')  // rolling ~400-word window
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)      // contribution cadence
  const chunkTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)  // chunk rotation
  const contributingRef = useRef(false)
  const inviteInFlightRef = useRef(false)
  const activeRef = useRef(false)
  const onAsideRef = useRef(onAside)

  useEffect(() => { onAsideRef.current = onAside }, [onAside])

  // Schedule next proactive contribution based on conversation pace
  const scheduleContribution = useCallback((currentSessionId: string) => {
    if (timerRef.current) clearTimeout(timerRef.current)
    const wpm = measureWpm(transcriptWindowRef.current)
    const cadenceMs = wpm > 150 ? 90_000 : 120_000

    timerRef.current = setTimeout(async () => {
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

        if (!res.ok || !res.body) throw new Error('Contribute request failed')

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
        console.warn('[useGroupSession] contribute failed:', err)
      } finally {
        contributingRef.current = false
        setIsContributing(false)
        if (activeRef.current) scheduleContribution(currentSessionId)
      }
    }, cadenceMs)
  }, [])

  // Send one audio chunk to the server for transcription and append the result
  const transcribeChunk = useCallback(async (blob: Blob, mimeType: string) => {
    const formData = new FormData()
    formData.append('audio', blob, 'chunk.webm')
    formData.append('mimeType', mimeType)
    try {
      const res = await fetch('/api/group-sessions/transcribe', { method: 'POST', body: formData })
      if (!res.ok) return
      const { transcript } = await res.json()
      if (transcript?.trim()) {
        transcriptRef.current += ' ' + transcript
        const words = transcriptRef.current.trim().split(/\s+/)
        transcriptWindowRef.current = words.slice(-400).join(' ')
      }
    } catch {
      // Non-fatal — a missed chunk doesn't end the session
    }
  }, [])

  // Record one chunk, transcribe it when done, then immediately start the next
  const recordChunk = useCallback((stream: MediaStream, mimeType: string) => {
    if (!activeRef.current) return

    const chunks: Blob[] = []
    const recorder = new MediaRecorder(stream, { mimeType })

    recorder.ondataavailable = (e) => { if (e.data.size > 0) chunks.push(e.data) }
    recorder.onstop = async () => {
      if (chunks.length > 0) {
        const blob = new Blob(chunks, { type: mimeType })
        await transcribeChunk(blob, mimeType)
      }
      // Chain to next chunk (activeRef check at top prevents infinite loop after stop)
      recordChunk(stream, mimeType)
    }

    recorder.start()
    recorderRef.current = recorder

    chunkTimerRef.current = setTimeout(() => {
      if (recorder.state !== 'inactive') recorder.stop()
    }, CHUNK_INTERVAL_MS)
  }, [transcribeChunk])

  const stopStream = useCallback(() => {
    activeRef.current = false
    if (timerRef.current) { clearTimeout(timerRef.current); timerRef.current = null }
    if (chunkTimerRef.current) { clearTimeout(chunkTimerRef.current); chunkTimerRef.current = null }
    if (recorderRef.current?.state !== 'inactive') recorderRef.current?.stop()
    recorderRef.current = null
    streamRef.current?.getTracks().forEach(t => t.stop())
    streamRef.current = null
  }, [])

  const start = useCallback(async () => {
    let stream: MediaStream | null = null

    // Prefer system-audio capture via getDisplayMedia — this doesn't claim the
    // microphone, so active meetings (Zoom, Teams, FaceTime, etc.) aren't
    // interrupted by a competing audio session or Bluetooth profile switch.
    // Not supported on iOS/iPadOS Safari, so we gracefully fall through to mic.
    if (typeof navigator.mediaDevices?.getDisplayMedia === 'function') {
      try {
        // Most browsers require video:true even when we only want audio;
        // we stop the video track immediately after capture.
        const raw = await (navigator.mediaDevices.getDisplayMedia as (
          constraints: MediaStreamConstraints
        ) => Promise<MediaStream>)({ video: true, audio: true })

        // Discard video immediately — stops the visible screen-share overlay.
        raw.getVideoTracks().forEach(t => t.stop())

        if (raw.getAudioTracks().length > 0) {
          stream = raw
          // If the user clicks "Stop sharing" in the browser banner, pause.
          raw.getAudioTracks()[0].addEventListener('ended', () => {
            if (activeRef.current) {
              stopStream()
              setStatus('paused')
            }
          })
        } else {
          // User didn't enable "Share system audio" in the picker — fall through.
          raw.getTracks().forEach(t => t.stop())
        }
      } catch {
        // User cancelled the picker or browser rejected — fall through to mic.
      }
    }

    // Fall back to microphone if display-audio capture wasn't available or failed.
    if (!stream) {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      } catch {
        onError("Your microphone isn't available.")
        return false
      }
    }

    const mimeType =
      ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg']
        .find(t => MediaRecorder.isTypeSupported(t)) ?? 'audio/webm'

    streamRef.current = stream
    activeRef.current = true
    recordChunk(stream, mimeType)
    return true
  }, [onError, recordChunk, stopStream])

  const invite = useCallback(async () => {
    if (status !== 'idle' || inviteInFlightRef.current) return
    inviteInFlightRef.current = true

    try {
      setStatus('starting')

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

      const started = await start()
      if (!started) {
        setStatus('error')
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
    const started = await start()
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

  useEffect(() => {
    return () => { stopStream() }
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
