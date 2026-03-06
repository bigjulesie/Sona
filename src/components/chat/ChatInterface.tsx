'use client'

import { useRef, useEffect, useState, useCallback } from 'react'
import { useChat } from '@/lib/hooks/useChat'
import { MessageBubble } from './MessageBubble'
import { ChatInput } from './ChatInput'
import { RatingPrompt } from '@/components/sona/RatingPrompt'

const GEIST = 'var(--font-geist-sans)'
const CORMORANT = 'var(--font-cormorant)'

interface ChatInterfaceProps {
  portraitId: string
  portraitName: string
  voiceEnabled?: boolean
  initialConversationId?: string
  onConversationChange?: (id: string) => void
  existingRating?: number | null
}

export function ChatInterface({
  portraitId,
  portraitName,
  voiceEnabled = false,
  initialConversationId,
  onConversationChange,
  existingRating,
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
        if (!res.ok) {
          setPlayingMessageId(null)
          return
        }

        const blob = await res.blob()
        const url = URL.createObjectURL(blob)
        const audio = new Audio(url)
        audio.dataset.blobUrl = url
        audioRef.current = audio
        audio.onended = () => {
          setPlayingMessageId(null)
          URL.revokeObjectURL(url)
        }
        await audio.play()
      } catch {
        if (audioRef.current) {
          const blobUrl = audioRef.current.dataset.blobUrl
          if (blobUrl) URL.revokeObjectURL(blobUrl)
          audioRef.current = null
        }
        setPlayingMessageId(null)
      }
    },
    [portraitId]
  )

  // Auto-play TTS when streaming ends in voice mode
  useEffect(() => {
    if (!voiceMode || isStreaming || messages.length === 0) return
    const last = messages[messages.length - 1]
    if (last.role !== 'assistant' || !last.content) return
    if (autoPlayedRef.current.has(last.id)) return
    autoPlayedRef.current.add(last.id)
    playTTS(last.id, last.content)
  }, [isStreaming, voiceMode, playTTS])

  function stopTTS() {
    if (audioRef.current) {
      const blobUrl = audioRef.current.dataset.blobUrl
      audioRef.current.pause()
      if (blobUrl) URL.revokeObjectURL(blobUrl)
      audioRef.current = null
    }
    setPlayingMessageId(null)
  }

  // Stop audio when switching portraits or unmounting
  useEffect(() => {
    return () => {
      if (audioRef.current) {
        const blobUrl = audioRef.current.dataset.blobUrl
        audioRef.current.pause()
        if (blobUrl) URL.revokeObjectURL(blobUrl)
      }
    }
  }, [portraitId])

  const userMessageCount = messages.filter(m => m.role === 'user').length

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>

      {/* ── Message list ───────────────────────────────────────────── */}
      <div style={{
        flex: 1,
        overflowY: 'auto',
        padding: '32px clamp(16px, 4vw, 24px)',
      }}>

        {/* Empty state */}
        {messages.length === 0 && !isRecording && (
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            height: '100%',
            gap: 16,
            textAlign: 'center',
          }}>
            <svg width="32" height="32" viewBox="0 0 32 32" fill="none" aria-hidden>
              <circle cx="16" cy="16" r="16" fill="#DE3E7B" opacity="0.15" />
              <circle cx="16" cy="16" r="9" fill="#DE3E7B" opacity="0.25" />
              <circle cx="16" cy="16" r="4" fill="#DE3E7B" opacity="0.5" />
            </svg>
            <p style={{
              fontFamily: CORMORANT,
              fontSize: '1.25rem',
              fontWeight: 400,
              fontStyle: 'italic',
              color: '#b0b0b0',
              margin: 0,
            }}>
              Begin your conversation with {portraitName}
            </p>
          </div>
        )}

        {/* Messages */}
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

        {/* Streaming indicator — only while waiting for the first token */}
        {isStreaming && messages[messages.length - 1]?.content === '' && (
          <div style={{ display: 'flex', justifyContent: 'flex-start', marginBottom: 20 }}>
            <div style={{
              backgroundColor: '#f5f5f5',
              border: '1px solid rgba(0,0,0,0.06)',
              borderRadius: '20px 20px 20px 4px',
              padding: '14px 18px',
            }}>
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
              <div style={{ display: 'flex', gap: 5, alignItems: 'center', height: 16 }}>
                {[0, 150, 300].map((delay) => (
                  <span
                    key={delay}
                    style={{
                      width: 6,
                      height: 6,
                      borderRadius: '50%',
                      backgroundColor: 'rgba(0,0,0,0.2)',
                      display: 'inline-block',
                      animation: `bounce 1s ease-in-out ${delay}ms infinite`,
                    }}
                  />
                ))}
              </div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* ── Rating prompt ───────────────────────────────────────────── */}
      {existingRating !== undefined && (
        <div style={{ padding: '0 clamp(16px, 4vw, 24px)' }}>
          <RatingPrompt
            portraitId={portraitId}
            messageCount={userMessageCount}
            existingRating={existingRating}
          />
        </div>
      )}

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
