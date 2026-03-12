'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

const GEIST = 'var(--font-geist-sans)'
const CORMORANT = 'var(--font-cormorant)'

const NAV_ITEMS = [
  { href: '/dashboard',           label: 'Overview',  exact: true  },
  { href: '/dashboard/content',   label: 'Context',   exact: false },
  { href: '/dashboard/mind',      label: 'Mind',      exact: false },
  { href: '/dashboard/pricing',   label: 'Pricing',   exact: false },
  { href: '/dashboard/interview', label: 'Interview', exact: false },
  { href: '/dashboard/settings',  label: 'Settings',  exact: false },
]

interface DashboardSubNavProps {
  portraitName: string
  isPublic: boolean
}

export function DashboardSubNav({ portraitName, isPublic }: DashboardSubNavProps) {
  const pathname = usePathname()

  function isActive(href: string, exact: boolean) {
    return exact ? pathname === href : pathname.startsWith(href)
  }

  return (
    <div style={{
      backgroundColor: '#f7f7f7',
      borderBottom: '1px solid rgba(0,0,0,0.07)',
    }}>
      <div style={{
        maxWidth: 1080,
        margin: '0 auto',
        padding: '0 clamp(24px, 4vw, 48px)',
        height: 44,
        display: 'flex',
        alignItems: 'center',
        gap: 20,
      }}>

        {/* Portrait identity */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
          <span style={{
            fontFamily: CORMORANT,
            fontSize: '1rem',
            fontStyle: 'italic',
            fontWeight: 400,
            color: '#1a1a1a',
            lineHeight: 1,
          }}>
            {portraitName}
          </span>
          <span style={{
            fontFamily: GEIST,
            fontSize: '0.5625rem',
            fontWeight: 500,
            letterSpacing: '0.07em',
            textTransform: 'uppercase',
            color: isPublic ? '#2a7c4f' : '#9b9b9b',
            backgroundColor: isPublic ? 'rgba(42,124,79,0.08)' : 'rgba(0,0,0,0.05)',
            padding: '2px 7px',
            borderRadius: '980px',
          }}>
            {isPublic ? 'Live' : 'Draft'}
          </span>
        </div>

        {/* Divider */}
        <div style={{ width: 1, height: 14, backgroundColor: 'rgba(0,0,0,0.12)', flexShrink: 0 }} />

        {/* Section tabs */}
        <nav style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          {NAV_ITEMS.map(item => {
            const active = isActive(item.href, item.exact)
            return (
              <Link
                key={item.href}
                href={item.href}
                className={active ? undefined : 'sona-link'}
                style={{
                  fontFamily: GEIST,
                  fontSize: '0.8125rem',
                  fontWeight: active ? 500 : 400,
                  color: active ? '#1a1a1a' : '#6b6b6b',
                  textDecoration: 'none',
                  padding: '4px 10px',
                  borderRadius: 6,
                  backgroundColor: active ? 'rgba(0,0,0,0.07)' : 'transparent',
                }}
              >
                {item.label}
              </Link>
            )
          })}
        </nav>

      </div>
    </div>
  )
}
