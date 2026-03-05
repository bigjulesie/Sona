import Image from 'next/image'
import Link from 'next/link'

// ── Sona Design Principles ────────────────────────────────────────────────
// Sona is the backdrop. The people are the product.
// White is not empty — it is pure potential.
// The coral mark is the only colour. It is heart energy.
// Every Sona is a jewel. We are the case that holds them.
// ─────────────────────────────────────────────────────────────────────────

const GEIST = 'var(--font-geist-sans)'
const CORMORANT = 'var(--font-cormorant)'

export function LandingPage() {
  return (
    <div style={{ backgroundColor: '#fff', color: '#1a1a1a', minHeight: '100vh' }}>

      {/* ── Navigation ──────────────────────────────────────────────────── */}
      <nav style={{
        position: 'sticky',
        top: 0,
        zIndex: 50,
        backgroundColor: 'rgba(255,255,255,0.85)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        borderBottom: '1px solid rgba(0,0,0,0.06)',
        padding: '0 48px',
        height: 56,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
      }}>
        <Image
          src="/brand_assets/sona/Sona brand on white bg 1.svg"
          alt="Sona"
          width={88}
          height={33}
          priority
        />
        <div style={{ display: 'flex', alignItems: 'center', gap: '1.75rem' }}>
          <Link href="/login" className="sona-link" style={{
            fontFamily: GEIST,
            fontSize: '0.875rem',
            color: '#6b6b6b',
            textDecoration: 'none',
            fontWeight: 400,
          }}>
            Sign in
          </Link>
          <Link href="/signup" className="sona-btn-dark" style={{
            fontFamily: GEIST,
            fontSize: '0.875rem',
            fontWeight: 500,
            padding: '8px 20px',
            borderRadius: '980px',
            background: '#1a1a1a',
            color: '#fff',
            textDecoration: 'none',
            letterSpacing: '-0.01em',
          }}>
            Get started
          </Link>
        </div>
      </nav>

      {/* ── Hero ────────────────────────────────────────────────────────── */}
      <section style={{
        textAlign: 'center',
        padding: '120px 24px 112px',
        maxWidth: 900,
        margin: '0 auto',
      }}>
        {/* The coral mark — heart energy, identity radiating outward */}
        <div style={{ marginBottom: 48, display: 'flex', justifyContent: 'center' }}>
          <svg width="120" height="120" viewBox="0 0 72 72" fill="none" aria-hidden>
            <circle cx="36" cy="36" r="36" fill="url(#sonaGrad)" />
            <defs>
              <radialGradient id="sonaGrad" cx="0" cy="0" r="1"
                gradientUnits="userSpaceOnUse"
                gradientTransform="translate(36 36) rotate(90) scale(36)">
                <stop stopColor="#DE3E7B" />
                <stop offset="0.495" stopColor="#DE3E7B" />
                <stop offset="1" stopColor="#DE3E7B" stopOpacity="0" />
              </radialGradient>
            </defs>
          </svg>
        </div>

        {/* Hero headline — Apple-calibre bilateral proposition */}
        <h1 style={{
          fontFamily: CORMORANT,
          fontSize: 'clamp(3.75rem, 7vw, 6.5rem)',
          fontWeight: 400,
          fontStyle: 'italic',
          lineHeight: 1.0,
          letterSpacing: '-0.02em',
          color: '#1a1a1a',
          margin: '0 0 32px',
        }}>
          Know them.<br />
          Be known.
        </h1>

        {/* Sub-headline */}
        <p style={{
          fontFamily: GEIST,
          fontSize: '1.25rem',
          fontWeight: 400,
          lineHeight: 1.6,
          color: '#3a3a3a',
          maxWidth: 580,
          margin: '0 auto 16px',
        }}>
          The right mind in the room — whenever you need it.
        </p>

        {/* Body */}
        <p style={{
          fontFamily: GEIST,
          fontSize: '1.0625rem',
          fontWeight: 300,
          lineHeight: 1.7,
          color: '#6b6b6b',
          maxWidth: 520,
          margin: '0 auto 52px',
        }}>
          Chat or talk by voice with a Sona one-on-one — or invite them into
          a conversation you're already having with others. Their beliefs,
          knowledge, and personality travel with you, helping you think more
          clearly and navigate whatever comes next.
        </p>

        {/* CTAs */}
        <div style={{ display: 'flex', gap: 14, justifyContent: 'center', flexWrap: 'wrap' }}>
          <Link href="/explore" className="sona-btn-dark" style={{
            fontFamily: GEIST,
            display: 'inline-block',
            padding: '16px 36px',
            borderRadius: '980px',
            background: '#1a1a1a',
            color: '#fff',
            textDecoration: 'none',
            fontSize: '1rem',
            fontWeight: 500,
            letterSpacing: '-0.01em',
          }}>
            Explore Sonas
          </Link>
          <Link href="/signup" className="sona-btn-outline" style={{
            fontFamily: GEIST,
            display: 'inline-block',
            padding: '16px 36px',
            borderRadius: '980px',
            border: '1px solid rgba(0,0,0,0.18)',
            color: '#1a1a1a',
            textDecoration: 'none',
            fontSize: '1rem',
            letterSpacing: '-0.01em',
          }}>
            Create your Sona
          </Link>
        </div>
      </section>

      {/* ── Thin divider ────────────────────────────────────────────────── */}
      <div style={{ height: 1, background: 'rgba(0,0,0,0.06)', margin: '0 48px' }} />

      {/* ── Proposition split ───────────────────────────────────────────── */}
      <section style={{
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        maxWidth: 1080,
        margin: '0 auto',
        padding: '96px 48px',
        gap: 80,
        alignItems: 'start',
      }}>
        <div>
          <p style={{
            fontFamily: GEIST,
            fontSize: '0.75rem',
            fontWeight: 500,
            letterSpacing: '0.1em',
            textTransform: 'uppercase',
            color: '#DE3E7B',
            marginBottom: '1.25rem',
            marginTop: 0,
          }}>
            For subscribers
          </p>
          <h2 style={{
            fontFamily: CORMORANT,
            fontSize: '2.5rem',
            fontWeight: 400,
            lineHeight: 1.15,
            margin: '0 0 1.25rem',
            letterSpacing: '-0.01em',
          }}>
            Their wisdom,<br />
            <em>present in your life.</em>
          </h2>
          <p style={{
            fontFamily: GEIST,
            fontSize: '1rem',
            fontWeight: 300,
            lineHeight: 1.75,
            color: '#6b6b6b',
            margin: '0 0 2rem',
          }}>
            Connect with thinkers, founders, and creators who see the world
            differently. Talk with them by chat or voice. Or bring them into
            your meetings, your decisions, your conversations with others.
            A Sona isn't just available — they're with you.
          </p>
          <Link href="/explore" className="sona-arrow-link" style={{
            fontFamily: GEIST,
            fontSize: '0.9375rem',
            fontWeight: 500,
            color: '#1a1a1a',
            textDecoration: 'none',
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
          }}>
            Explore Sonas <span aria-hidden style={{ fontSize: '1.1em' }}>→</span>
          </Link>
        </div>

        <div>
          <p style={{
            fontFamily: GEIST,
            fontSize: '0.75rem',
            fontWeight: 500,
            letterSpacing: '0.1em',
            textTransform: 'uppercase',
            color: '#DE3E7B',
            marginBottom: '1.25rem',
            marginTop: 0,
          }}>
            For creators
          </p>
          <h2 style={{
            fontFamily: CORMORANT,
            fontSize: '2.5rem',
            fontWeight: 400,
            lineHeight: 1.15,
            margin: '0 0 1.25rem',
            letterSpacing: '-0.01em',
          }}>
            Your whole self,<br />
            <em>present when it matters.</em>
          </h2>
          <p style={{
            fontFamily: GEIST,
            fontSize: '1rem',
            fontWeight: 300,
            lineHeight: 1.75,
            color: '#6b6b6b',
            margin: '0 0 2rem',
          }}>
            We capture not just what you know, but how you think — your
            beliefs, your instincts, your personality. Your Sona carries
            everything that makes you <em>you</em>, available to the people
            who value your perspective exactly when they need it most.
          </p>
          <Link href="/signup" className="sona-arrow-link" style={{
            fontFamily: GEIST,
            fontSize: '0.9375rem',
            fontWeight: 500,
            color: '#1a1a1a',
            textDecoration: 'none',
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
          }}>
            Build your Sona <span aria-hidden style={{ fontSize: '1.1em' }}>→</span>
          </Link>
        </div>
      </section>

      {/* ── How it works ────────────────────────────────────────────────── */}
      <section style={{
        borderTop: '1px solid rgba(0,0,0,0.06)',
        padding: '96px 48px',
        backgroundColor: '#fafafa',
      }}>
        <div style={{ maxWidth: 1080, margin: '0 auto' }}>
          <p style={{
            fontFamily: GEIST,
            fontSize: '0.75rem',
            fontWeight: 500,
            letterSpacing: '0.1em',
            textTransform: 'uppercase',
            color: '#DE3E7B',
            marginTop: 0,
            marginBottom: '1.25rem',
          }}>
            How it works
          </p>
          <h2 style={{
            fontFamily: CORMORANT,
            fontSize: 'clamp(2rem, 3.5vw, 3rem)',
            fontWeight: 400,
            margin: '0 0 72px',
            letterSpacing: '-0.01em',
          }}>
            Three steps to a living Sona.
          </h2>

          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(3, 1fr)',
            gap: '1px',
            background: 'rgba(0,0,0,0.06)',
          }}>
            {([
              {
                n: '01',
                title: 'Tell us who you are',
                desc: 'Set up your profile — your name, your expertise, and what you want to be known for. Five minutes.',
              },
              {
                n: '02',
                title: 'The interview',
                desc: 'A deep WhatsApp conversation captures your voice, your beliefs, and the nuances of how you think.',
              },
              {
                n: '03',
                title: 'Your Sona goes live',
                desc: 'Subscribers can now hold genuine conversations with your knowledge. Earn from those who value you.',
              },
            ] as const).map(step => (
              <div key={step.n} style={{
                background: '#fafafa',
                padding: '40px 36px',
              }}>
                <p style={{
                  fontFamily: CORMORANT,
                  fontSize: '2.5rem',
                  fontWeight: 300,
                  color: '#DE3E7B',
                  margin: '0 0 20px',
                  lineHeight: 1,
                }}>
                  {step.n}
                </p>
                <h3 style={{
                  fontFamily: GEIST,
                  fontSize: '1rem',
                  fontWeight: 500,
                  margin: '0 0 12px',
                  letterSpacing: '-0.01em',
                }}>
                  {step.title}
                </h3>
                <p style={{
                  fontFamily: GEIST,
                  fontSize: '0.9375rem',
                  fontWeight: 300,
                  lineHeight: 1.7,
                  color: '#6b6b6b',
                  margin: 0,
                }}>
                  {step.desc}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Closing CTA ─────────────────────────────────────────────────── */}
      <section style={{
        textAlign: 'center',
        padding: '120px 48px',
        borderTop: '1px solid rgba(0,0,0,0.06)',
      }}>
        <div style={{ marginBottom: 40, display: 'flex', justifyContent: 'center' }}>
          <svg width="48" height="48" viewBox="0 0 72 72" fill="none" aria-hidden>
            <circle cx="36" cy="36" r="36" fill="url(#sonaGrad2)" />
            <defs>
              <radialGradient id="sonaGrad2" cx="0" cy="0" r="1"
                gradientUnits="userSpaceOnUse"
                gradientTransform="translate(36 36) rotate(90) scale(36)">
                <stop stopColor="#DE3E7B" />
                <stop offset="0.495" stopColor="#DE3E7B" />
                <stop offset="1" stopColor="#DE3E7B" stopOpacity="0" />
              </radialGradient>
            </defs>
          </svg>
        </div>

        <h2 style={{
          fontFamily: CORMORANT,
          fontSize: 'clamp(2.5rem, 5vw, 4.5rem)',
          fontWeight: 400,
          fontStyle: 'italic',
          lineHeight: 1.05,
          margin: '0 0 24px',
          letterSpacing: '-0.02em',
        }}>
          Be present.<br />Even when you can't be.
        </h2>
        <p style={{
          fontFamily: GEIST,
          fontSize: '1.0625rem',
          fontWeight: 300,
          color: '#6b6b6b',
          lineHeight: 1.7,
          maxWidth: 480,
          margin: '0 auto 48px',
        }}>
          Create a Sona that carries your knowledge and personality forward —
          or explore the remarkable people already here.
        </p>
        <div style={{ display: 'flex', gap: 14, justifyContent: 'center', flexWrap: 'wrap' }}>
          <Link href="/signup" className="sona-btn-dark" style={{
            fontFamily: GEIST,
            display: 'inline-block',
            padding: '16px 36px',
            borderRadius: '980px',
            background: '#1a1a1a',
            color: '#fff',
            textDecoration: 'none',
            fontSize: '1rem',
            fontWeight: 500,
            letterSpacing: '-0.01em',
          }}>
            Create your Sona
          </Link>
          <Link href="/explore" className="sona-btn-outline" style={{
            fontFamily: GEIST,
            display: 'inline-block',
            padding: '16px 36px',
            borderRadius: '980px',
            border: '1px solid rgba(0,0,0,0.18)',
            color: '#1a1a1a',
            textDecoration: 'none',
            fontSize: '1rem',
            letterSpacing: '-0.01em',
          }}>
            Explore Sonas
          </Link>
        </div>
      </section>

      {/* ── Footer ──────────────────────────────────────────────────────── */}
      <footer style={{
        borderTop: '1px solid rgba(0,0,0,0.06)',
        padding: '28px 48px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
      }}>
        <Image
          src="/brand_assets/sona/Sona brand on white bg 1.svg"
          alt="Sona"
          width={66}
          height={25}
        />
        <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
          <a
            href="/privacy"
            style={{
              fontFamily: GEIST,
              fontSize: '0.8125rem',
              color: '#b0b0b0',
              textDecoration: 'none',
            }}
          >
            Privacy
          </a>
          <a
            href="/terms"
            style={{
              fontFamily: GEIST,
              fontSize: '0.8125rem',
              color: '#b0b0b0',
              textDecoration: 'none',
            }}
          >
            Terms
          </a>
          <p style={{
            fontFamily: GEIST,
            fontSize: '0.8125rem',
            color: '#b0b0b0',
            margin: 0,
          }}>
            © 2026 Sona
          </p>
        </div>
      </footer>

    </div>
  )
}
