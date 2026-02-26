interface MessageBubbleProps {
  role: 'user' | 'assistant'
  content: string
  portraitName?: string
  onPlayTTS?: () => void
  isPlayingTTS?: boolean
}

export function MessageBubble({ role, content, portraitName, onPlayTTS, isPlayingTTS }: MessageBubbleProps) {
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
        {onPlayTTS && (
          <button
            onClick={onPlayTTS}
            className={`mt-2 flex items-center gap-1.5 text-xs transition-colors ${
              isPlayingTTS ? 'text-brass' : 'text-mist hover:text-ink'
            }`}
            title={isPlayingTTS ? 'Playing…' : 'Listen'}
          >
            <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor">
              {isPlayingTTS ? (
                <>
                  <rect x="2" y="2" width="3" height="8" rx="1" />
                  <rect x="7" y="2" width="3" height="8" rx="1" />
                </>
              ) : (
                <path d="M3 2l7 4-7 4V2z" />
              )}
            </svg>
            {isPlayingTTS ? 'Playing' : 'Listen'}
          </button>
        )}
      </div>
    </div>
  )
}
