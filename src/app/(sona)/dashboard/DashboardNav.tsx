'use client'

import Image from 'next/image'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { SignOutButton } from '@/components/sona/SignOutButton'

const GEIST = 'var(--font-geist-sans)'

const NAV_ITEMS = [
  { href: '/dashboard', label: 'Overview', exact: true },
  { href: '/dashboard/content', label: 'Content', exact: false },
  { href: '/dashboard/interview', label: 'Interview', exact: false },
  { href: '/dashboard/settings', label: 'Settings', exact: false },
]

export function DashboardNav() {
  const pathname = usePathname()

  function isActive(href: string, exact: boolean) {
    return exact ? pathname === href : pathname.startsWith(href)
  }

  return (
    <header style={{
      backgroundColor: '#fff',
      borderBottom: '1px solid rgba(0,0,0,0.06)',
      position: 'sticky',
      top: 0,
      zIndex: 40,
    }}>
      <div style={{
        maxWidth: 1080,
        margin: '0 auto',
        padding: '0 clamp(24px, 4vw, 48px)',
        height: 56,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
      }}>
        {/* Logo */}
        <Link href="/" style={{ display: 'flex', alignItems: 'center' }}>
          <Image
            src="/brand_assets/sona/Sona brand - on white bg.svg"
            alt="Sona"
            width={72}
            height={27}
            priority
          />
        </Link>

        {/* Nav links */}
        <nav style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
          {NAV_ITEMS.map(item => {
            const active = isActive(item.href, item.exact)
            return (
              <Link
                key={item.href}
                href={item.href}
                className={active ? undefined : 'sona-link'}
                style={{
                  fontFamily: GEIST,
                  fontSize: '0.875rem',
                  fontWeight: active ? 500 : 400,
                  color: active ? '#1a1a1a' : '#6b6b6b',
                  textDecoration: 'none',
                  padding: '6px 12px',
                  borderRadius: '6px',
                  backgroundColor: active ? 'rgba(0,0,0,0.05)' : 'transparent',
                  transition: 'background-color 0.15s',
                }}
              >
                {item.label}
                {active && (
                  <span style={{
                    display: 'block',
                    height: 2,
                    backgroundColor: '#DE3E7B',
                    borderRadius: 1,
                    marginTop: 2,
                  }} />
                )}
              </Link>
            )
          })}
        </nav>

        {/* Right: Explore + Account + Sign out */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem' }}>
          <Link href="/explore" className="sona-link" style={{
            fontFamily: GEIST,
            fontSize: '0.875rem',
            color: '#6b6b6b',
            textDecoration: 'none',
          }}>
            Explore
          </Link>
          <Link href="/account" className="sona-link" style={{
            fontFamily: GEIST,
            fontSize: '0.875rem',
            color: '#6b6b6b',
            textDecoration: 'none',
          }}>
            Account
          </Link>
          <SignOutButton />
        </div>
      </div>
    </header>
  )
}
