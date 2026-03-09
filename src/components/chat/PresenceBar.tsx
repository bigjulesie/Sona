'use client'

import { useState } from 'react'
import type { SessionStatus } from '@/lib/hooks/useGroupSession'

const GEIST = 'var(--font-geist-sans)'

interface PresenceBarProps {
  portraitName: string
  status: SessionStatus
  onInvite: () => void
  onPause: () => void
  onResume: () => void
  onLeave: () => void
}

export function PresenceBar({
  portraitName,
  status,
  onInvite,
  onPause,
  onResume,
  onLeave,
}: PresenceBarProps) {
  const [controlsOpen, setControlsOpen] = useState(false)

  const isActive = status === 'active'
  const isPaused = status === 'paused'
  const isInRoom = isActive || isPaused
  const isIdle = status === 'idle'
  const isStarting = status === 'starting'

  if (isIdle || status === 'ended') {
    return (
      <div style={{
        padding: '10px clamp(16px, 4vw, 24px)',
        borderBottom: '1px solid rgba(0,0,0,0.05)',
        display: 'flex',
        alignItems: 'center',
      }}>
        <button
          onClick={onInvite}
          style={{
            fontFamily: GEIST,
            fontSize: '0.75rem',
            fontWeight: 400,
            color: '#6b6b6b',
            background: 'none',
            border: '1px solid rgba(0,0,0,0.10)',
            borderRadius: '980px',
            padding: '5px 14px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: 7,
          }}
          aria-label={`Invite ${portraitName} into the room`}
        >
          <span style={{
            width: 6,
            height: 6,
            borderRadius: '50%',
            backgroundColor: '#b0b0b0',
            display: 'inline-block',
            flexShrink: 0,
          }} />
          Invite {portraitName} in
        </button>
      </div>
    )
  }

  if (isStarting) {
    return (
      <div style={{
        padding: '10px clamp(16px, 4vw, 24px)',
        borderBottom: '1px solid rgba(0,0,0,0.05)',
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        minHeight: 40,
      }}>
        <span style={{
          fontFamily: GEIST,
          fontSize: '0.75rem',
          fontWeight: 400,
          color: '#b0b0b0',
        }}>
          Joining the room…
        </span>
      </div>
    )
  }

  return (
    <>
      {/* Presence row — tappable to open controls */}
      <div
        role="button"
        tabIndex={0}
        onClick={() => setControlsOpen(o => !o)}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setControlsOpen(o => !o) } }}
        aria-expanded={controlsOpen}
        aria-label={isActive
          ? `${portraitName} is in the room — tap to manage`
          : `${portraitName} has stepped out — tap to manage`}
        style={{
          width: '100%',
          padding: '10px clamp(16px, 4vw, 24px)',
          borderBottom: '1px solid rgba(0,0,0,0.05)',
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          cursor: 'pointer',
          minHeight: 40,
        }}
      >
        {/* Animated coral dot */}
        <span
          aria-hidden="true"
          className="presence-dot"
          style={{
            width: 7,
            height: 7,
            borderRadius: '50%',
            backgroundColor: isActive ? '#DE3E7B' : '#b0b0b0',
            display: 'inline-block',
            flexShrink: 0,
            animation: isActive ? 'presence-pulse 2.8s ease-in-out infinite' : 'none',
            transition: 'background-color 0.2s ease',
          }}
        />
        <span style={{
          fontFamily: GEIST,
          fontSize: '0.75rem',
          fontWeight: 400,
          color: '#6b6b6b',
          letterSpacing: '0.01em',
          flex: 1,
        }}>
          {isActive
            ? `${portraitName} is in the room`
            : `${portraitName} has stepped out`}
        </span>

        {/* Single-tap pause/resume affordance — no need to open controls */}
        <button
          onClick={(e) => {
            e.stopPropagation()  // don't also toggle controls
            isActive ? onPause() : onResume()
          }}
          style={{
            fontFamily: GEIST,
            fontSize: '0.6875rem',
            fontWeight: 400,
            color: '#b0b0b0',
            background: 'none',
            border: 'none',
            padding: '2px 8px',
            cursor: 'pointer',
            borderRadius: '980px',
            flexShrink: 0,
          }}
          aria-label={isActive ? 'Pause listening' : 'Resume listening'}
        >
          {isActive ? 'Pause' : 'Resume'}
        </button>
      </div>

      {/* Inline controls disclosure */}
      {controlsOpen && (
        <div style={{
          display: 'flex',
          gap: 8,
          padding: '8px clamp(16px, 4vw, 24px) 12px',
          borderBottom: '1px solid rgba(0,0,0,0.05)',
          backgroundColor: '#fff',
        }}>
          <button
            onClick={() => { isActive ? onPause() : onResume(); setControlsOpen(false) }}
            style={{
              fontFamily: GEIST,
              fontSize: '0.75rem',
              fontWeight: 450,
              color: '#6b6b6b',
              background: 'none',
              border: '1px solid rgba(0,0,0,0.10)',
              borderRadius: '980px',
              padding: '6px 14px',
              cursor: 'pointer',
            }}
          >
            {isActive ? 'Step out for a moment' : 'Come back in'}
          </button>
          <button
            onClick={() => { onLeave(); setControlsOpen(false) }}
            style={{
              fontFamily: GEIST,
              fontSize: '0.75rem',
              fontWeight: 450,
              color: '#6b6b6b',
              background: 'none',
              border: '1px solid rgba(0,0,0,0.10)',
              borderRadius: '980px',
              padding: '6px 14px',
              cursor: 'pointer',
            }}
          >
            Leave the room
          </button>
        </div>
      )}
    </>
  )
}
