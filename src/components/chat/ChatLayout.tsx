'use client'

import { useState, useCallback } from 'react'
import { ChatInterface } from './ChatInterface'
import { ConversationSidebar } from './ConversationSidebar'

interface Portrait {
  voice_enabled: boolean
  id: string
  display_name: string
}

interface Props {
  portraits: Portrait[]
}

export function ChatLayout({ portraits }: Props) {
  const [selectedPortraitId, setSelectedPortraitId] = useState(portraits[0]?.id ?? '')
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null)
  // sidebarOpen defaults to true on desktop, false on mobile (handled via CSS + state)
  const [sidebarOpen, setSidebarOpen] = useState(true)
  // When a new conversation is saved, refreshTrigger updates to re-fetch the list
  const [refreshTrigger, setRefreshTrigger] = useState<string | null>(null)

  const selectedPortrait = portraits.find(p => p.id === selectedPortraitId) ?? portraits[0]

  const handleSelectPortrait = useCallback((id: string) => {
    setSelectedPortraitId(id)
    setActiveConversationId(null)
  }, [])

  const handleNewConversation = useCallback(() => {
    setActiveConversationId(null)
  }, [])

  const handleConversationChange = useCallback((id: string) => {
    setActiveConversationId(id)
    setRefreshTrigger(id)
  }, [])

  if (!selectedPortrait) return null

  return (
    <div className="flex-1 flex flex-col overflow-hidden min-h-0">
      {/* Sona selector — shown only when there are multiple Sonas */}
      {portraits.length > 1 && (
        <div className="border-b border-brass/20 px-4 md:px-6 py-2 flex items-center gap-3 bg-parchment flex-shrink-0 overflow-x-auto">
          <span className="text-xs uppercase tracking-widest text-mist whitespace-nowrap">Talking with</span>
          <div className="flex gap-2">
            {portraits.map(p => (
              <button
                key={p.id}
                onClick={() => handleSelectPortrait(p.id)}
                className={`text-sm px-3 py-1 rounded-full border transition-colors whitespace-nowrap ${
                  p.id === selectedPortraitId
                    ? 'bg-brass/90 text-parchment border-brass'
                    : 'text-mist border-brass/30 hover:border-brass/60 hover:text-ink'
                }`}
              >
                {p.display_name}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="flex flex-1 overflow-hidden min-h-0">
        {/* Conversation sidebar — hidden on mobile unless sidebarOpen */}
        <div className={`
          ${sidebarOpen ? 'flex' : 'hidden'}
          md:flex flex-col
          fixed md:relative inset-0 md:inset-auto z-40 md:z-auto
        `}>
          {/* Mobile backdrop */}
          <div
            className="md:hidden absolute inset-0 bg-ink/40"
            onClick={() => setSidebarOpen(false)}
          />
          <div className="relative flex flex-col h-full">
            <ConversationSidebar
              portraitId={selectedPortrait.id}
              activeConversationId={activeConversationId}
              refreshTrigger={refreshTrigger}
              onSelect={(id) => {
                setActiveConversationId(id)
                setSidebarOpen(false) // auto-close on mobile after selecting
              }}
              onNew={() => {
                handleNewConversation()
                setSidebarOpen(false)
              }}
            />
          </div>
        </div>

        {/* Main chat area */}
        <div className="flex-1 flex flex-col min-w-0 relative">
          {/* Sidebar toggle button */}
          <button
            onClick={() => setSidebarOpen(prev => !prev)}
            className="absolute top-3 left-3 z-10 p-2 rounded-lg text-mist hover:text-ink hover:bg-vellum transition-colors"
            title={sidebarOpen ? 'Hide conversations' : 'Show conversations'}
            aria-label={sidebarOpen ? 'Hide conversations' : 'Show conversations'}
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
              <rect x="1" y="1" width="14" height="14" rx="2" />
              <line x1="5" y1="1" x2="5" y2="15" />
            </svg>
          </button>

          <ChatInterface
            key={selectedPortrait.id}
            portraitId={selectedPortrait.id}
            portraitName={selectedPortrait.display_name}
            voiceEnabled={selectedPortrait.voice_enabled}
            initialConversationId={activeConversationId ?? undefined}
            onConversationChange={handleConversationChange}
          />
        </div>
      </div>
    </div>
  )
}
