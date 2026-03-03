import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: { default: 'Sona', template: '%s | Sona' },
  description: 'Meet the people who shaped your world',
}

export default function SonaLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
