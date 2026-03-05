const GEIST = 'var(--font-geist-sans)'

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
    <div style={{
      display: 'flex',
      justifyContent: isUser ? 'flex-end' : 'flex-start',
      marginBottom: 20,
    }}>
      <div style={{
        maxWidth: '72%',
        padding: '14px 18px',
        borderRadius: isUser ? '20px 20px 4px 20px' : '20px 20px 20px 4px',
        backgroundColor: isUser ? '#1a1a1a' : '#f5f5f5',
        border: isUser ? 'none' : '1px solid rgba(0,0,0,0.06)',
      }}>
        {!isUser && portraitName && (
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
        )}
        <p style={{
          fontFamily: GEIST,
          fontSize: '0.9375rem',
          fontWeight: 300,
          lineHeight: 1.65,
          color: isUser ? '#fff' : '#1a1a1a',
          margin: 0,
          whiteSpace: 'pre-wrap',
        }}>
          {content}
        </p>
        {onPlayTTS && (
          <button
            onClick={onPlayTTS}
            title={isPlayingTTS ? 'Playing…' : 'Listen'}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              marginTop: 10,
              background: 'none',
              border: 'none',
              padding: 0,
              cursor: 'pointer',
              fontFamily: GEIST,
              fontSize: '0.75rem',
              fontWeight: 400,
              color: isPlayingTTS ? '#DE3E7B' : '#b0b0b0',
              transition: 'color 0.15s ease',
            }}
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
