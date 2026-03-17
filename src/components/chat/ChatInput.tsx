'use client'

import React, { useState, useRef, useEffect, useCallback } from 'react'
import { useVoice } from '@/lib/hooks/useVoice'
import { VoiceWaveform } from './VoiceWaveform'
import type { SessionStatus } from '@/lib/hooks/useGroupSession'

const GEIST = 'var(--font-geist-sans)'

interface ChatInputProps {
  onSend: (message: string) => void
  disabled?: boolean
  voiceEnabled?: boolean
  voiceMode?: boolean
  onToggleVoice?: () => void
  onRecordingChange?: (recording: boolean) => void
  portraitName?: string
  textareaRef?: React.RefObject<HTMLTextAreaElement | null>
  // Session controls
  sessionStatus?: SessionStatus
  onInvite?: () => void
  onPause?: () => void
  onResume?: () => void
  onLeave?: () => void
}

export function ChatInput({
  onSend,
  disabled,
  voiceEnabled = false,
  voiceMode = false,
  onToggleVoice,
  onRecordingChange,
  portraitName,
  textareaRef: textareaRefProp,
  sessionStatus = 'idle',
  onInvite,
  onPause,
  onResume,
  onLeave,
}: ChatInputProps) {
  const [value, setValue] = useState('')
  const [controlsOpen, setControlsOpen] = useState(false)
  const localTextareaRef = useRef<HTMLTextAreaElement>(null)
  const textareaRef = textareaRefProp ?? localTextareaRef

  const handleTranscript = useCallback(
    (text: string) => {
      if (voiceMode) {
        onSend(text)
      } else {
        setValue(text)
        setTimeout(() => textareaRef.current?.focus(), 0)
      }
    },
    [onSend, voiceMode]
  )
  const { status, error, analyser, devices, selectedDeviceId, setSelectedDeviceId, startRecording, stopRecording } = useVoice({
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

  // Close controls disclosure when session ends
  useEffect(() => {
    if (sessionStatus === 'idle' || sessionStatus === 'ended') {
      setControlsOpen(false)
    }
  }, [sessionStatus])

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
  const isActive = sessionStatus === 'active'
  const isPaused = sessionStatus === 'paused'
  const isInRoom = isActive || isPaused
  const isStarting = sessionStatus === 'starting'

  return (
    <div style={{
      borderTop: '1px solid rgba(0,0,0,0.06)',
      backgroundColor: isInRoom ? 'rgba(222,62,123,0.015)' : '#fff',
      transition: 'background-color 0.3s ease',
    }}>

      {/* ── Session row ──────────────────────────────────────────────── */}
      {sessionStatus !== 'ended' && (
        <div style={{
          borderBottom: '1px solid rgba(0,0,0,0.05)',
        }}>

          {/* Idle — invite pill */}
          {(sessionStatus === 'idle') && onInvite && (
            <div style={{ padding: '8px clamp(16px, 4vw, 24px)' }}>
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
                aria-label={`Invite ${portraitName ?? 'them'} into the room`}
              >
                <span style={{
                  width: 6,
                  height: 6,
                  borderRadius: '50%',
                  backgroundColor: '#b0b0b0',
                  display: 'inline-block',
                  flexShrink: 0,
                }} />
                Invite {portraitName ?? 'them'} in
              </button>
            </div>
          )}

          {/* Starting */}
          {isStarting && (
            <div style={{
              padding: '10px clamp(16px, 4vw, 24px)',
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              minHeight: 38,
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
          )}

          {/* Active / Paused — presence row */}
          {isInRoom && (
            <>
              <div
                style={{
                  padding: '8px clamp(16px, 4vw, 24px)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  cursor: 'pointer',
                }}
                role="button"
                tabIndex={0}
                onClick={() => setControlsOpen(o => !o)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault()
                    setControlsOpen(o => !o)
                  }
                }}
                aria-expanded={controlsOpen}
                aria-label={isActive
                  ? `${portraitName ?? 'Sona'} is in the room — tap to manage`
                  : `${portraitName ?? 'Sona'} has stepped out — tap to manage`}
              >
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
                    ? `${portraitName ?? 'Sona'} is in the room`
                    : `${portraitName ?? 'Sona'} has stepped out`}
                </span>

                {/* Single-tap pause/resume */}
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    isActive ? onPause?.() : onResume?.()
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
              </div>

              {/* Expanded controls */}
              {controlsOpen && (
                <div style={{
                  display: 'flex',
                  gap: 8,
                  padding: '4px clamp(16px, 4vw, 24px) 10px',
                }}>
                  <button
                    onClick={() => { isActive ? onPause?.() : onResume?.(); setControlsOpen(false) }}
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
                    onClick={() => { onLeave?.(); setControlsOpen(false) }}
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
          )}
        </div>
      )}

      {/* ── Device picker ────────────────────────────────────────────── */}
      {voiceEnabled && !isRecording && devices.length > 1 && (
        <div style={{ padding: '6px clamp(16px, 4vw, 24px) 0', display: 'flex', alignItems: 'center', gap: 8 }}>
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none" style={{ flexShrink: 0, color: '#b0b0b0' }}>
            <rect x="3.5" y="0.5" width="5" height="7" rx="2.5" stroke="currentColor" strokeWidth="1" />
            <path d="M1 6a5 5 0 0 0 10 0" stroke="currentColor" strokeWidth="1" strokeLinecap="round" fill="none" />
            <line x1="6" y1="11" x2="6" y2="12" stroke="currentColor" strokeWidth="1" strokeLinecap="round" />
          </svg>
          <select
            value={selectedDeviceId}
            onChange={(e) => setSelectedDeviceId(e.target.value)}
            style={{
              fontFamily: GEIST,
              fontSize: '0.75rem',
              color: '#6b6b6b',
              background: 'none',
              border: 'none',
              outline: 'none',
              cursor: 'pointer',
              maxWidth: 220,
            }}
          >
            <option value="">Default microphone</option>
            {devices.map((d) => (
              <option key={d.deviceId} value={d.deviceId}>
                {d.label || `Microphone ${d.deviceId.slice(0, 6)}`}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* ── Privacy banner (voice recording, not in room) ────────────── */}
      {isRecording && !isInRoom && (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 8,
          padding: '8px 16px',
          backgroundColor: '#DC2626',
          color: '#fff',
        }}>
          <span style={{
            width: 8,
            height: 8,
            borderRadius: '50%',
            backgroundColor: '#fff',
            display: 'inline-block',
            animation: 'pulse 1.5s ease-in-out infinite',
          }} />
          <span style={{
            fontFamily: GEIST,
            fontSize: '0.75rem',
            fontWeight: 500,
            letterSpacing: '0.03em',
          }}>
            Microphone active — tap the mic button to stop
          </span>
        </div>
      )}

      {/* ── Form row ─────────────────────────────────────────────────── */}
      <form
        onSubmit={handleSubmit}
        style={{
          display: 'flex',
          alignItems: 'flex-end',
          gap: 10,
          padding: '14px clamp(16px, 4vw, 24px)',
        }}
      >
        {voiceMode ? (
          /* Voice mode controls */
          <div style={{
            flex: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 16,
            minHeight: 44,
          }}>
            {isRecording && (
              <VoiceWaveform analyser={analyser} />
            )}
            {isTranscribing && (
              <span style={{
                fontFamily: GEIST,
                fontSize: '0.75rem',
                fontWeight: 300,
                color: '#9b9b9b',
                letterSpacing: '0.04em',
              }}>
                Transcribing…
              </span>
            )}
            {status === 'idle' && !error && (
              <span style={{
                fontFamily: GEIST,
                fontSize: '0.75rem',
                fontWeight: 300,
                color: '#9b9b9b',
                letterSpacing: '0.04em',
              }}>
                Tap mic to speak
              </span>
            )}
            {error && (
              <span style={{
                fontFamily: GEIST,
                fontSize: '0.75rem',
                color: '#DE3E7B',
              }}>
                {error}
              </span>
            )}
          </div>
        ) : (
          /* Text mode */
          <textarea
            ref={textareaRef}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={isInRoom ? `Say something to ${portraitName ?? 'them'}…` : 'Ask a question…'}
            rows={1}
            disabled={disabled}
            style={{
              flex: 1,
              resize: 'none',
              backgroundColor: '#f7f7f7',
              border: '1px solid rgba(0,0,0,0.08)',
              borderRadius: 14,
              padding: '12px 16px',
              fontFamily: GEIST,
              fontSize: '0.9375rem',
              fontWeight: 300,
              color: '#1a1a1a',
              outline: 'none',
              maxHeight: 128,
              boxSizing: 'border-box',
              lineHeight: 1.5,
              opacity: disabled ? 0.5 : 1,
            }}
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
            style={{
              width: 44,
              height: 44,
              borderRadius: 14,
              border: isRecording ? 'none' : '1px solid rgba(0,0,0,0.08)',
              backgroundColor: isRecording ? '#DC2626' : '#f7f7f7',
              color: isRecording ? '#fff' : '#9b9b9b',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: disabled || isTranscribing ? 'default' : 'pointer',
              opacity: disabled || isTranscribing ? 0.4 : 1,
              position: 'relative',
              flexShrink: 0,
              transition: 'background-color 0.15s ease, color 0.15s ease',
            }}
          >
            {isTranscribing ? (
              <span style={{
                width: 16,
                height: 16,
                border: '1.5px solid rgba(0,0,0,0.2)',
                borderTopColor: 'transparent',
                borderRadius: '50%',
                display: 'block',
                animation: 'spin 0.8s linear infinite',
              }} />
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
            style={{
              width: 44,
              height: 44,
              borderRadius: 14,
              border: voiceMode ? '1px solid rgba(222,62,123,0.3)' : '1px solid rgba(0,0,0,0.08)',
              backgroundColor: voiceMode ? 'rgba(222,62,123,0.06)' : '#f7f7f7',
              color: voiceMode ? '#DE3E7B' : '#9b9b9b',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              flexShrink: 0,
              transition: 'all 0.15s ease',
            }}
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
            style={{
              height: 44,
              padding: '0 20px',
              backgroundColor: '#1a1a1a',
              color: '#fff',
              border: 'none',
              borderRadius: '980px',
              fontFamily: GEIST,
              fontSize: '0.8125rem',
              fontWeight: 500,
              letterSpacing: '-0.01em',
              cursor: disabled || !value.trim() ? 'default' : 'pointer',
              opacity: disabled || !value.trim() ? 0.35 : 1,
              transition: 'opacity 0.15s ease',
              flexShrink: 0,
            }}
          >
            Send
          </button>
        )}
      </form>
    </div>
  )
}
