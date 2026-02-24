interface MessageBubbleProps {
  role: 'user' | 'assistant'
  content: string
  portraitName?: string
}

export function MessageBubble({ role, content, portraitName }: MessageBubbleProps) {
  const isUser = role === 'user'

  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'} mb-5`}>
      <div
        className={`max-w-[72%] px-5 py-4 ${
          isUser
            ? 'bg-ink text-parchment rounded-2xl rounded-br-sm'
            : 'bg-vellum text-ink border border-brass/20 rounded-2xl rounded-bl-sm'
        }`}
      >
        {!isUser && (
          <p className="text-xs tracking-widest uppercase text-brass mb-2">{portraitName}</p>
        )}
        <p className="text-sm leading-relaxed whitespace-pre-wrap font-body">{content}</p>
      </div>
    </div>
  )
}
