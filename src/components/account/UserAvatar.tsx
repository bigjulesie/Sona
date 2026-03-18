// src/components/account/UserAvatar.tsx
// Renders a circular avatar image with an optional CSS glow halo.
// Falls back to a Cormorant italic initial when no avatarUrl is set.
// Uses a plain <img> (not next/image) — no remotePatterns config exists.

const CORMORANT = 'var(--font-cormorant)'

interface UserAvatarProps {
  avatarUrl?: string | null
  haloColor?: string | null
  name: string
  size: number
}

export function UserAvatar({ avatarUrl, haloColor, name, size }: UserAvatarProps) {
  const glow = haloColor
    ? (() => {
        const r = parseInt(haloColor.slice(1, 3), 16)
        const g = parseInt(haloColor.slice(3, 5), 16)
        const b = parseInt(haloColor.slice(5, 7), 16)
        return `0 0 ${Math.round(size * 0.6)}px ${Math.round(size * 0.15)}px rgba(${r},${g},${b},0.30)`
      })()
    : undefined

  if (avatarUrl) {
    return (
      <img
        src={avatarUrl}
        alt={name}
        width={size}
        height={size}
        style={{
          width: size,
          height: size,
          borderRadius: '50%',
          objectFit: 'cover',
          flexShrink: 0,
          display: 'block',
          boxShadow: glow,
        }}
      />
    )
  }

  return (
    <div style={{
      width: size,
      height: size,
      borderRadius: '50%',
      backgroundColor: 'rgba(0,0,0,0.04)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      flexShrink: 0,
    }}>
      <span style={{
        fontFamily: CORMORANT,
        fontSize: Math.round(size * 0.45),
        fontStyle: 'italic',
        fontWeight: 400,
        color: '#1a1a1a',
        lineHeight: 1,
        userSelect: 'none',
      }}>
        {name[0]?.toUpperCase() ?? '?'}
      </span>
    </div>
  )
}
