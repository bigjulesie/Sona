'use client'

import { useRef, useEffect } from 'react'
import { useChat } from '@/lib/hooks/useChat'
import { MessageBubble } from './MessageBubble'
import { ChatInput } from './ChatInput'

interface ChatInterfaceProps {
  portraitId: string
  portraitName: string
  initialConversationId?: string
}

export function ChatInterface({ portraitId, portraitName, initialConversationId }: ChatInterfaceProps) {
  const { messages, isStreaming, sendMessage, loadConversation } = useChat(portraitId)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (initialConversationId) {
      loadConversation(initialConversationId)
    }
  }, [initialConversationId, loadConversation])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-y-auto p-6">
        {messages.length === 0 && (
          <div className="flex items-center justify-center h-full text-stone-400 text-sm">
            Start a conversation with {portraitName}
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
        <div ref={messagesEndRef} />
      </div>
      <ChatInput onSend={sendMessage} disabled={isStreaming} />
    </div>
  )
}
