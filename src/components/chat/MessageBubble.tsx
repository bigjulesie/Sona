interface MessageBubbleProps {
  role: 'user' | 'assistant'
  content: string
  portraitName?: string
}

export function MessageBubble({ role, content, portraitName }: MessageBubbleProps) {
  const isUser = role === 'user'

  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'} mb-4`}>
      <div className={`max-w-[75%] ${isUser
        ? 'bg-stone-900 text-white rounded-2xl rounded-br-sm'
        : 'bg-stone-100 text-stone-900 rounded-2xl rounded-bl-sm'
      } px-4 py-3`}>
        {!isUser && (
          <p className="text-xs font-medium text-stone-500 mb-1">{portraitName}</p>
        )}
        <p className="text-sm leading-relaxed whitespace-pre-wrap">{content}</p>
      </div>
    </div>
  )
}
