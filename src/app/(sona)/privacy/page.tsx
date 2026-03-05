import type { Metadata } from 'next'
import Image from 'next/image'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'Privacy Policy',
  description: 'How Sona collects, uses, and protects your personal information.',
}

const GEIST = 'var(--font-geist-sans)'
const CORMORANT = 'var(--font-cormorant)'

const SECTION_LABEL: React.CSSProperties = {
  fontFamily: GEIST,
  fontSize: '0.6875rem',
  fontWeight: 500,
  letterSpacing: '0.09em',
  textTransform: 'uppercase',
  color: '#b0b0b0',
  margin: '0 0 10px',
}

const BODY: React.CSSProperties = {
  fontFamily: GEIST,
  fontSize: '0.9375rem',
  fontWeight: 300,
  lineHeight: 1.8,
  color: '#3a3a3a',
  margin: '0 0 24px',
}

export default function PrivacyPage() {
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
        <p style={SECTION_LABEL}>Legal</p>
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
          Privacy Policy
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

        {/* Sections */}
        <section style={{ marginBottom: 48 }}>
          <h2 style={{
            fontFamily: CORMORANT,
            fontSize: '1.375rem',
            fontWeight: 400,
            fontStyle: 'italic',
            color: '#1a1a1a',
            margin: '0 0 16px',
          }}>
            What we collect
          </h2>
          <p style={BODY}>
            When you create an account, we collect your email address. When you subscribe to a Sona, we collect billing information through Stripe — we never store your full card number. When you have conversations with Sonas, those messages are stored to provide the service and to improve quality.
          </p>
          <p style={BODY}>
            We may also collect usage data such as pages visited, features used, and device information to help us understand how Sona is being used and to improve it.
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
            How we use it
          </h2>
          <p style={BODY}>
            Your information is used to provide, maintain, and improve the Sona service. This includes authenticating you, processing payments, delivering Sona conversations, and sending service-related communications.
          </p>
          <p style={BODY}>
            We do not sell your personal data. We do not use your conversations to train AI models without your consent.
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
            Third-party services
          </h2>
          <p style={BODY}>
            Sona uses Supabase for authentication and data storage, Stripe for payment processing, ElevenLabs for voice synthesis, and Anthropic's Claude for conversational AI. Each of these providers has its own privacy policy. We share only the minimum data necessary for these services to function.
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
            Your rights
          </h2>
          <p style={BODY}>
            You may request access to, correction of, or deletion of your personal data at any time. To submit a request, email us at privacy@sona.ai. We will respond within 30 days.
          </p>
          <p style={BODY}>
            If you close your account, your personal data will be deleted within 90 days, except where retention is required by law.
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
            Cookies
          </h2>
          <p style={BODY}>
            Sona uses cookies and similar technologies for authentication and to remember your preferences. We do not use third-party advertising cookies.
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
            Changes to this policy
          </h2>
          <p style={BODY}>
            We may update this Privacy Policy from time to time. We will notify you of material changes by email or by posting a notice on the platform. Continued use of Sona after changes take effect constitutes your acceptance.
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
          <a href="mailto:privacy@sona.ai" style={{ color: '#1a1a1a', textDecoration: 'none' }}>
            privacy@sona.ai
          </a>
          {' '}or see our{' '}
          <Link href="/terms" style={{ color: '#1a1a1a', textDecoration: 'none' }}>
            Terms of Service
          </Link>
          .
        </p>

      </div>
    </main>
  )
}
