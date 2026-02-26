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
        if (!res.ok) { setPlayingMessageId(null); return }

        const blob = await res.blob()
        const url = URL.createObjectURL(blob)
        const audio = new Audio(url)
        audio.dataset.blobUrl = url  // store for cleanup
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
