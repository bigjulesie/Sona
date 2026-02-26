'use client'

import { useRef, useEffect } from 'react'
import Image from 'next/image'
import { useChat } from '@/lib/hooks/useChat'
import { MessageBubble } from './MessageBubble'
import { ChatInput } from './ChatInput'

interface ChatInterfaceProps {
  portraitId: string
  portraitName: string
  initialConversationId?: string
  onConversationChange?: (id: string) => void
}

export function ChatInterface({ portraitId, portraitName, initialConversationId, onConversationChange }: ChatInterfaceProps) {
  const { messages, isStreaming, conversationId, sendMessage, loadConversation } = useChat(portraitId)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (initialConversationId) {
      loadConversation(initialConversationId)
    }
  }, [initialConversationId, loadConversation])

  useEffect(() => {
    if (conversationId) {
      onConversationChange?.(conversationId)
    }
  }, [conversationId, onConversationChange])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-y-auto px-4 md:px-6 py-8">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full gap-5 text-center">
            <Image
              src="/brand_assets/icon.svg"
              alt=""
              width={40}
              height={40}
              className="opacity-25"
            />
            <p className="font-display text-xl text-mist italic">
              Begin your conversation with {portraitName}
            </p>
          </div>
        )}
        {messages.map(msg => (
          <MessageBubble
            key={msg.id}
            role={msg.role}
            content={msg.content}
            portraitName={portraitName}
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
      <ChatInput onSend={sendMessage} disabled={isStreaming} />
    </div>
  )
}
