import { SonaNav } from '@/components/sona/SonaNav'

export default function PlatformLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <SonaNav />
      {children}
    </>
  )
}
