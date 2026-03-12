'use client'

import { useRouter } from 'next/navigation'
import { useState, useRef, useEffect } from 'react'

export function HoldingPage() {
  const router = useRouter()
  const [code, setCode] = useState('')
  const [status, setStatus] = useState<'idle' | 'shaking' | 'success'>('idle')
  const [errorVisible, setErrorVisible] = useState(false)
  const [mounted, setMounted] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const errorTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    // Trigger fade-up animations after mount
    const t = setTimeout(() => setMounted(true), 50)
    return () => clearTimeout(t)
  }, [])

  async function handleSubmit() {
    if (!code.trim() || status === 'success') return

    try {
      const res = await fetch('/api/invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: code.trim() }),
      })

      if (res.ok) {
        setStatus('success')
        setTimeout(() => {
          router.replace('/explore')
        }, 1800)
      } else {
        // Shake
        setStatus('shaking')
        setErrorVisible(true)
        if (errorTimer.current) clearTimeout(errorTimer.current)
        errorTimer.current = setTimeout(() => {
          setStatus('idle')
          setErrorVisible(false)
          setCode('')
          inputRef.current?.focus()
        }, 1200)
      }
    } catch {
      setStatus('shaking')
      setErrorVisible(true)
      if (errorTimer.current) clearTimeout(errorTimer.current)
      errorTimer.current = setTimeout(() => {
        setStatus('idle')
        setErrorVisible(false)
        setCode('')
      }, 1200)
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') handleSubmit()
  }

  const isSuccess = status === 'success'

  return (
    <>
      <style>{`
        @keyframes pulse-halo {
          0%, 100% { transform: scale(1); opacity: 1; }
          50% { transform: scale(1.03); opacity: 0.88; }
        }

        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          15%       { transform: translateX(-8px); }
          30%       { transform: translateX(7px); }
          45%       { transform: translateX(-6px); }
          60%       { transform: translateX(5px); }
          75%       { transform: translateX(-3px); }
          90%       { transform: translateX(2px); }
        }

        @keyframes fade-up {
          from { opacity: 0; transform: translateY(14px); }
          to   { opacity: 1; transform: translateY(0); }
        }

        @keyframes fade-in {
          from { opacity: 0; }
          to   { opacity: 1; }
        }

        @keyframes welcome-fade {
          0%   { opacity: 0; transform: translateY(6px); }
          20%  { opacity: 1; transform: translateY(0); }
          75%  { opacity: 1; }
          100% { opacity: 0; }
        }

        @keyframes page-fade-white {
          0%   { opacity: 0; }
          100% { opacity: 1; }
        }

        .holding-logo {
          animation: pulse-halo 4s ease-in-out infinite;
          transform-origin: center;
        }

        .holding-logo-wrap {
          animation: fade-up 0.9s cubic-bezier(0.22, 1, 0.36, 1) both;
          animation-delay: 0.1s;
        }

        .holding-tagline {
          animation: fade-up 0.9s cubic-bezier(0.22, 1, 0.36, 1) both;
          animation-delay: 0.32s;
        }

        .holding-input-wrap {
          animation: fade-up 0.9s cubic-bezier(0.22, 1, 0.36, 1) both;
          animation-delay: 0.52s;
        }

        .holding-input-shake {
          animation: shake 0.5s cubic-bezier(0.36, 0.07, 0.19, 0.97) both;
        }

        .holding-error {
          animation: fade-in 0.2s ease both;
        }

        .holding-welcome {
          animation: welcome-fade 1.8s ease forwards;
        }

        .holding-overlay {
          animation: page-fade-white 0.6s ease 1.4s both;
        }

        .holding-input::placeholder {
          color: rgba(255, 255, 255, 0.35) !important;
          font-style: italic !important;
        }

        .holding-input:focus {
          outline: none !important;
          border-bottom-color: rgba(255, 255, 255, 0.8) !important;
        }
      `}</style>

      {/* White overlay that fades in on success, covering the coral page */}
      {isSuccess && (
        <div
          className="holding-overlay"
          style={{
            position: 'fixed',
            inset: 0,
            background: '#ffffff',
            zIndex: 50,
            pointerEvents: 'none',
          }}
        />
      )}

      <main
        style={{
          minHeight: '100dvh',
          background: '#DE3E7B',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 0,
          padding: '2rem',
        }}
      >
        {/* Logo */}
        <div
          className={mounted ? 'holding-logo-wrap' : ''}
          style={{ opacity: mounted ? undefined : 0, marginBottom: '2rem' }}
        >
          <div className="holding-logo">
            <svg
              width="242"
              height="87"
              viewBox="0 0 363 130"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
              aria-label="Sona"
              role="img"
            >
              <circle cx="62.5" cy="64.5" r="62.5" fill="url(#paint0_radial_holding)" />
              <path
                d="M156.147 102.6C149.814 102.6 144.38 101.567 139.847 99.5C135.38 97.4333 131.88 94.5333 129.347 90.8C126.88 87 125.48 82.5333 125.147 77.4L142.547 76.6C142.88 79.1333 143.614 81.3 144.747 83.1C145.88 84.9 147.38 86.2667 149.247 87.2C151.18 88.1333 153.547 88.6 156.347 88.6C158.614 88.6 160.514 88.3333 162.047 87.8C163.647 87.2667 164.847 86.4667 165.647 85.4C166.514 84.3333 166.947 83 166.947 81.4C166.947 79.9333 166.58 78.6667 165.847 77.6C165.18 76.4667 163.814 75.4667 161.747 74.6C159.747 73.6667 156.714 72.7667 152.647 71.9C146.38 70.5667 141.314 69.0333 137.447 67.3C133.647 65.5 130.847 63.2667 129.047 60.6C127.314 57.8667 126.447 54.4 126.447 50.2C126.447 45.8667 127.547 42.0667 129.747 38.8C131.947 35.5333 135.114 33 139.247 31.2C143.38 29.3333 148.314 28.4 154.047 28.4C160.18 28.4 165.314 29.4667 169.447 31.6C173.647 33.6667 176.914 36.5333 179.247 40.2C181.58 43.8667 182.98 48.1 183.447 52.9L166.247 53.7C166.047 51.3667 165.414 49.3667 164.347 47.7C163.347 46.0333 161.947 44.7333 160.147 43.8C158.414 42.8667 156.314 42.4 153.847 42.4C150.78 42.4 148.347 43.0667 146.547 44.4C144.814 45.7333 143.947 47.4667 143.947 49.6C143.947 51.2667 144.347 52.6333 145.147 53.7C146.014 54.7667 147.414 55.7 149.347 56.5C151.28 57.2333 153.98 57.9333 157.447 58.6C164.247 59.8667 169.614 61.5333 173.547 63.6C177.48 65.6667 180.28 68.1 181.947 70.9C183.614 73.7 184.447 76.9333 184.447 80.6C184.447 85.1333 183.314 89.0667 181.047 92.4C178.78 95.6667 175.514 98.2 171.247 100C167.047 101.733 162.014 102.6 156.147 102.6ZM216.669 102.2C211.002 102.2 206.035 101.033 201.769 98.7C197.569 96.3667 194.269 93.1 191.869 88.9C189.535 84.7 188.369 79.7667 188.369 74.1C188.369 68.4333 189.535 63.5 191.869 59.3C194.269 55.1 197.569 51.8333 201.769 49.5C206.035 47.1667 211.002 46 216.669 46C222.335 46 227.269 47.1667 231.469 49.5C235.669 51.8333 238.935 55.1 241.269 59.3C243.669 63.5 244.869 68.4333 244.869 74.1C244.869 79.7667 243.669 84.7 241.269 88.9C238.935 93.1 235.669 96.3667 231.469 98.7C227.269 101.033 222.335 102.2 216.669 102.2ZM216.669 89.5C220.002 89.5 222.569 88.1667 224.369 85.5C226.235 82.8333 227.169 79.0333 227.169 74.1C227.169 69.2333 226.235 65.4667 224.369 62.8C222.569 60.0667 220.002 58.7 216.669 58.7C213.269 58.7 210.635 60.0667 208.769 62.8C206.969 65.4667 206.069 69.2333 206.069 74.1C206.069 79.0333 206.969 82.8333 208.769 85.5C210.635 88.1667 213.269 89.5 216.669 89.5ZM250.373 101V47.2H265.773L266.473 63.7L264.373 63.3C264.84 59.0333 265.873 55.6333 267.473 53.1C269.14 50.5667 271.207 48.7667 273.673 47.7C276.14 46.5667 278.873 46 281.873 46C285.673 46 288.94 46.8333 291.673 48.5C294.473 50.1 296.607 52.4333 298.073 55.5C299.54 58.5 300.273 62.1333 300.273 66.4V101H283.073V72.3C283.073 69.5667 282.873 67.2333 282.473 65.3C282.073 63.3667 281.34 61.9 280.273 60.9C279.273 59.9 277.807 59.4 275.873 59.4C273.073 59.4 270.973 60.5333 269.573 62.8C268.24 65 267.573 68.1667 267.573 72.3V101H250.373ZM324.616 102.2C319.016 102.2 314.416 100.9 310.816 98.3C307.216 95.7 305.416 92.1 305.416 87.5C305.416 82.7667 306.949 79.1 310.016 76.5C313.082 73.9 317.549 72 323.416 70.8L340.116 67.4C340.116 64.2667 339.416 61.9 338.016 60.3C336.682 58.6333 334.749 57.8 332.216 57.8C329.682 57.8 327.682 58.4333 326.216 59.7C324.816 60.9 323.916 62.6333 323.516 64.9L306.316 64.3C307.382 58.1 310.149 53.5 314.616 50.5C319.082 47.5 324.949 46 332.216 46C340.616 46 346.882 47.9 351.016 51.7C355.216 55.5 357.316 61.1667 357.316 68.7V85.7C357.316 87.3667 357.582 88.4667 358.116 89C358.716 89.5333 359.516 89.8 360.516 89.8H361.816V101C361.282 101.2 360.416 101.367 359.216 101.5C358.016 101.633 356.849 101.7 355.716 101.7C353.649 101.7 351.649 101.367 349.716 100.7C347.782 99.9667 346.182 98.7 344.916 96.9C343.649 95.0333 343.016 92.3667 343.016 88.9L344.316 90.2C343.649 92.6 342.449 94.7333 340.716 96.6C339.049 98.4 336.882 99.8 334.216 100.8C331.549 101.733 328.349 102.2 324.616 102.2ZM329.116 91C331.249 91 333.149 90.5667 334.816 89.7C336.482 88.8333 337.782 87.5667 338.716 85.9C339.649 84.2333 340.116 82.1667 340.116 79.7V77.5L329.716 79.9C327.649 80.3667 326.016 81.1 324.816 82.1C323.682 83.0333 323.116 84.3 323.116 85.9C323.116 87.5 323.616 88.7667 324.616 89.7C325.616 90.5667 327.116 91 329.116 91Z"
                fill="white"
              />
              <defs>
                <radialGradient
                  id="paint0_radial_holding"
                  cx="0"
                  cy="0"
                  r="1"
                  gradientUnits="userSpaceOnUse"
                  gradientTransform="translate(62.5 64.5) rotate(90) scale(62.5)"
                >
                  <stop offset="0" stopColor="#ffffff" stopOpacity="1" />
                  <stop offset="1" stopColor="#ffffff" stopOpacity="0" />
                </radialGradient>
              </defs>
            </svg>
          </div>
        </div>

        {/* Tagline */}
        {!isSuccess && (
          <p
            className={mounted ? 'holding-tagline' : ''}
            style={{
              opacity: mounted ? undefined : 0,
              fontFamily: 'var(--font-cormorant)',
              fontStyle: 'italic',
              fontSize: '1.0625rem',
              letterSpacing: '0.05em',
              color: 'rgba(255, 255, 255, 0.75)',
              margin: 0,
              marginBottom: '2.5rem',
              textAlign: 'center',
            }}
          >
            by invitation only
          </p>
        )}

        {/* Welcome state */}
        {isSuccess && (
          <p
            className="holding-welcome"
            style={{
              fontFamily: 'var(--font-cormorant)',
              fontStyle: 'italic',
              fontSize: '2rem',
              letterSpacing: '0.04em',
              color: 'rgba(255, 255, 255, 0.92)',
              margin: 0,
              marginBottom: '2.5rem',
              textAlign: 'center',
            }}
          >
            welcome
          </p>
        )}

        {/* Input area */}
        {!isSuccess && (
          <div
            className={mounted ? 'holding-input-wrap' : ''}
            style={{
              opacity: mounted ? undefined : 0,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '0.625rem',
              width: '100%',
              maxWidth: '280px',
            }}
          >
            <input
              ref={inputRef}
              className={`holding-input${status === 'shaking' ? ' holding-input-shake' : ''}`}
              type="text"
              autoComplete="off"
              autoCorrect="off"
              autoCapitalize="off"
              spellCheck={false}
              placeholder="invitation code"
              value={code}
              onChange={e => setCode(e.target.value)}
              onKeyDown={handleKeyDown}
              disabled={false}
              style={{
                width: '100%',
                background: 'transparent',
                border: 'none',
                borderBottom: '1px solid rgba(255, 255, 255, 0.4)',
                color: 'rgba(255, 255, 255, 0.95)',
                fontSize: '0.875rem',
                fontFamily: 'var(--font-geist-sans)',
                letterSpacing: '0.15em',
                textAlign: 'center',
                padding: '0.5rem 0',
                transition: 'border-bottom-color 0.2s ease',
              }}
            />

            {errorVisible && (
              <span
                className="holding-error"
                style={{
                  fontFamily: 'var(--font-geist-sans)',
                  fontSize: '0.6875rem',
                  letterSpacing: '0.07em',
                  color: 'rgba(255, 255, 255, 0.6)',
                  textAlign: 'center',
                }}
              >
                incorrect code
              </span>
            )}
          </div>
        )}
      </main>
    </>
  )
}
