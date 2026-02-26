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
            {status === 'idle' && !error && (
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
