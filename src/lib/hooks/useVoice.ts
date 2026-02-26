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
