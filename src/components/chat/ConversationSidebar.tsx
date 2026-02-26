'use client'

import { useEffect, useState, useCallback } from 'react'

interface Conversation {
  id: string
  title: string | null
  portrait_id: string
  created_at: string
  updated_at: string
}

interface Props {
  portraitId: string
  activeConversationId: string | null
  refreshTrigger: string | null
  onSelect: (id: string) => void
  onNew: () => void
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))
  if (diffDays === 0) return 'Today'
  if (diffDays === 1) return 'Yesterday'
  if (diffDays < 7) return `${diffDays} days ago`
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

export function ConversationSidebar({ portraitId, activeConversationId, refreshTrigger, onSelect, onNew }: Props) {
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [loading, setLoading] = useState(true)

  const fetchConversations = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/conversations')
      if (!res.ok) return
      const data: Conversation[] = await res.json()
      setConversations(data.filter(c => c.portrait_id === portraitId))
    } finally {
      setLoading(false)
    }
  }, [portraitId])

  useEffect(() => {
    fetchConversations()
  }, [fetchConversations, refreshTrigger])

  return (
    <aside className="w-64 border-r border-brass/20 bg-vellum flex flex-col flex-shrink-0">
      <div className="px-4 py-3 border-b border-brass/20 flex items-center justify-between">
        <h2 className="text-xs uppercase tracking-widest text-mist">History</h2>
        <button
          onClick={onNew}
          className="text-xs text-brass hover:text-ink transition-colors font-medium"
        >
          + New
        </button>
      </div>
      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="p-4 text-xs text-mist">Loading…</div>
        ) : conversations.length === 0 ? (
          <div className="p-4 text-xs text-mist italic leading-relaxed">
            No previous conversations.<br />Start typing to begin.
          </div>
        ) : (
          conversations.map(conv => (
            <button
              key={conv.id}
              onClick={() => onSelect(conv.id)}
              className={`w-full text-left px-4 py-3 transition-colors border-b border-brass/10 last:border-0 ${
                conv.id === activeConversationId
                  ? 'bg-parchment'
                  : 'hover:bg-parchment/60'
              }`}
            >
              <p className="text-sm text-ink truncate">
                {conv.title || 'Untitled conversation'}
              </p>
              <p className="text-xs text-mist mt-0.5">{formatDate(conv.updated_at)}</p>
            </button>
          ))
        )}
      </div>
    </aside>
  )
}
