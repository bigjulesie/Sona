import type { Metadata } from 'next'
import Image from 'next/image'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'Terms of Service',
  description: 'The terms that govern your use of Sona.',
}

const GEIST = 'var(--font-geist-sans)'
const CORMORANT = 'var(--font-cormorant)'

const BODY: React.CSSProperties = {
  fontFamily: GEIST,
  fontSize: '0.9375rem',
  fontWeight: 300,
  lineHeight: 1.8,
  color: '#3a3a3a',
  margin: '0 0 24px',
}

export default function TermsPage() {
  return (
    <main style={{ minHeight: '100vh', backgroundColor: '#fff' }}>
      <div style={{
        maxWidth: 680,
        margin: '0 auto',
        padding: '0 clamp(24px, 4vw, 48px) 96px',
      }}>

        {/* Nav */}
        <div style={{ paddingTop: 40, marginBottom: 64 }}>
          <Link
            href="/"
            style={{
              display: 'inline-block',
              textDecoration: 'none',
            }}
          >
            <Image
              src="/brand_assets/sona/Sona brand on white bg 1.svg"
              alt="Sona"
              width={66}
              height={25}
              priority
            />
          </Link>
        </div>

        {/* Header */}
        <p style={{
          fontFamily: GEIST,
          fontSize: '0.6875rem',
          fontWeight: 500,
          letterSpacing: '0.09em',
          textTransform: 'uppercase',
          color: '#b0b0b0',
          margin: '0 0 10px',
        }}>
          Legal
        </p>
        <h1 style={{
          fontFamily: CORMORANT,
          fontSize: 'clamp(2rem, 4vw, 2.75rem)',
          fontWeight: 400,
          fontStyle: 'italic',
          lineHeight: 1.1,
          letterSpacing: '-0.02em',
          color: '#1a1a1a',
          margin: '0 0 10px',
        }}>
          Terms of Service
        </h1>
        <p style={{
          fontFamily: GEIST,
          fontSize: '0.875rem',
          fontWeight: 300,
          color: '#b0b0b0',
          margin: '0 0 56px',
        }}>
          Last updated: March 2026
        </p>

        <div style={{ height: 1, backgroundColor: 'rgba(0,0,0,0.06)', marginBottom: 56 }} />

        <section style={{ marginBottom: 48 }}>
          <h2 style={{
            fontFamily: CORMORANT,
            fontSize: '1.375rem',
            fontWeight: 400,
            fontStyle: 'italic',
            color: '#1a1a1a',
            margin: '0 0 16px',
          }}>
            Using Sona
          </h2>
          <p style={BODY}>
            By accessing or using Sona, you agree to these Terms of Service. If you do not agree, please do not use the service. You must be at least 13 years old to use Sona. If you are under 18, you may only use Sona with parental consent.
          </p>
          <p style={BODY}>
            You are responsible for maintaining the security of your account and for all activity that occurs under it. Notify us immediately at support@sona.ai if you believe your account has been compromised.
          </p>
        </section>

        <section style={{ marginBottom: 48 }}>
          <h2 style={{
            fontFamily: CORMORANT,
            fontSize: '1.375rem',
            fontWeight: 400,
            fontStyle: 'italic',
            color: '#1a1a1a',
            margin: '0 0 16px',
          }}>
            Subscriptions and billing
          </h2>
          <p style={BODY}>
            Some Sonas require a paid subscription to access. Subscriptions are billed monthly and renew automatically unless cancelled. You may cancel at any time from your account settings; your access continues until the end of the billing period.
          </p>
          <p style={BODY}>
            Prices are displayed in USD. We use Stripe for all payment processing. Refunds are issued at our discretion and are generally not provided for partial billing periods.
          </p>
        </section>

        <section style={{ marginBottom: 48 }}>
          <h2 style={{
            fontFamily: CORMORANT,
            fontSize: '1.375rem',
            fontWeight: 400,
            fontStyle: 'italic',
            color: '#1a1a1a',
            margin: '0 0 16px',
          }}>
            Content and conduct
          </h2>
          <p style={BODY}>
            Sona conversations are AI-generated and do not represent the actual views, statements, or endorsements of real individuals. Creators are responsible for the accuracy and appropriateness of the knowledge and materials they provide to train their Sona.
          </p>
          <p style={BODY}>
            You may not use Sona to generate content that is illegal, harmful, misleading, or that violates the rights of others. We reserve the right to remove content and suspend accounts that violate these terms.
          </p>
        </section>

        <section style={{ marginBottom: 48 }}>
          <h2 style={{
            fontFamily: CORMORANT,
            fontSize: '1.375rem',
            fontWeight: 400,
            fontStyle: 'italic',
            color: '#1a1a1a',
            margin: '0 0 16px',
          }}>
            Intellectual property
          </h2>
          <p style={BODY}>
            Creators retain ownership of the content they upload to Sona. By uploading content, you grant us a non-exclusive, worldwide licence to use, store, and process that content for the purpose of providing the service.
          </p>
          <p style={BODY}>
            The Sona platform, branding, and software are owned by us. You may not copy, modify, or distribute any part of the platform without our written permission.
          </p>
        </section>

        <section style={{ marginBottom: 48 }}>
          <h2 style={{
            fontFamily: CORMORANT,
            fontSize: '1.375rem',
            fontWeight: 400,
            fontStyle: 'italic',
            color: '#1a1a1a',
            margin: '0 0 16px',
          }}>
            Limitation of liability
          </h2>
          <p style={BODY}>
            Sona is provided "as is" without warranties of any kind. To the fullest extent permitted by law, we are not liable for any indirect, incidental, or consequential damages arising from your use of the service.
          </p>
          <p style={BODY}>
            Our total liability for any claim arising from your use of Sona shall not exceed the amount you paid us in the three months preceding the claim.
          </p>
        </section>

        <section style={{ marginBottom: 48 }}>
          <h2 style={{
            fontFamily: CORMORANT,
            fontSize: '1.375rem',
            fontWeight: 400,
            fontStyle: 'italic',
            color: '#1a1a1a',
            margin: '0 0 16px',
          }}>
            Changes to these terms
          </h2>
          <p style={BODY}>
            We may update these Terms from time to time. Material changes will be communicated by email or in-app notice. Continued use of Sona after changes take effect constitutes your acceptance of the new terms.
          </p>
        </section>

        <div style={{ height: 1, backgroundColor: 'rgba(0,0,0,0.06)', marginBottom: 40 }} />

        <p style={{
          fontFamily: GEIST,
          fontSize: '0.875rem',
          fontWeight: 300,
          color: '#6b6b6b',
          lineHeight: 1.6,
        }}>
          Questions? Email{' '}
          <a href="mailto:support@sona.ai" style={{ color: '#1a1a1a', textDecoration: 'none' }}>
            support@sona.ai
          </a>
          {' '}or see our{' '}
          <Link href="/privacy" style={{ color: '#1a1a1a', textDecoration: 'none' }}>
            Privacy Policy
          </Link>
          .
        </p>

      </div>
    </main>
  )
}
