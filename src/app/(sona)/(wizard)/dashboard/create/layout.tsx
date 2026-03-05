import Image from 'next/image'
import Link from 'next/link'

export default function CreateWizardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#fff' }}>
      {/* Minimal nav — logo only */}
      <header style={{
        borderBottom: '1px solid rgba(0,0,0,0.06)',
        padding: '0 clamp(24px, 4vw, 48px)',
        height: 56,
        display: 'flex',
        alignItems: 'center',
      }}>
        <Link href="/" style={{ display: 'flex', alignItems: 'center', textDecoration: 'none' }}>
          <Image
            src="/brand_assets/sona/Sona brand on white bg 1.svg"
            alt="Sona"
            width={72}
            height={28}
            priority
          />
        </Link>
      </header>

      <div style={{
        maxWidth: 560,
        margin: '0 auto',
        padding: '48px clamp(24px, 4vw, 48px) 96px',
      }}>
        {children}
      </div>
    </div>
  )
}
