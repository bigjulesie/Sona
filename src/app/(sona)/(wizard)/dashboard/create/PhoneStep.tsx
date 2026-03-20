'use client'

import { useState } from 'react'

const GEIST = 'var(--font-geist-sans)'
const CORMORANT = 'var(--font-cormorant)'

// Curated UK/Europe IANA timezones
const TIMEZONES = [
  { value: 'Europe/London',     label: 'London (GMT/BST)' },
  { value: 'Europe/Dublin',     label: 'Dublin (GMT/IST)' },
  { value: 'Europe/Lisbon',     label: 'Lisbon (WET/WEST)' },
  { value: 'Europe/Paris',      label: 'Paris (CET/CEST)' },
  { value: 'Europe/Berlin',     label: 'Berlin (CET/CEST)' },
  { value: 'Europe/Amsterdam',  label: 'Amsterdam (CET/CEST)' },
  { value: 'Europe/Brussels',   label: 'Brussels (CET/CEST)' },
  { value: 'Europe/Madrid',     label: 'Madrid (CET/CEST)' },
  { value: 'Europe/Rome',       label: 'Rome (CET/CEST)' },
  { value: 'Europe/Zurich',     label: 'Zurich (CET/CEST)' },
  { value: 'Europe/Vienna',     label: 'Vienna (CET/CEST)' },
  { value: 'Europe/Stockholm',  label: 'Stockholm (CET/CEST)' },
  { value: 'Europe/Oslo',       label: 'Oslo (CET/CEST)' },
  { value: 'Europe/Copenhagen', label: 'Copenhagen (CET/CEST)' },
  { value: 'Europe/Warsaw',     label: 'Warsaw (CET/CEST)' },
  { value: 'Europe/Prague',     label: 'Prague (CET/CEST)' },
  { value: 'Europe/Helsinki',   label: 'Helsinki (EET/EEST)' },
  { value: 'Europe/Athens',     label: 'Athens (EET/EEST)' },
  { value: 'Europe/Bucharest',  label: 'Bucharest (EET/EEST)' },
  { value: 'Europe/Istanbul',   label: 'Istanbul (TRT)' },
]

type Stage = 'input' | 'sending' | 'sent' | 'verifying' | 'verified'

interface Props {
  portraitId: string
}

const LABEL: React.CSSProperties = {
  fontFamily: GEIST,
  fontSize: '0.6875rem',
  fontWeight: 500,
  letterSpacing: '0.09em',
  textTransform: 'uppercase',
  color: '#b0b0b0',
  display: 'block',
  marginBottom: 10,
}

const INPUT: React.CSSProperties = {
  fontFamily: GEIST,
  fontSize: '0.9375rem',
  fontWeight: 300,
  color: '#1a1a1a',
  width: '100%',
  background: 'transparent',
  border: 'none',
  borderBottom: '1px solid rgba(0,0,0,0.15)',
  padding: '8px 0',
  outline: 'none',
  boxSizing: 'border-box',
}

const SELECT: React.CSSProperties = {
  ...INPUT,
  appearance: 'none',
  WebkitAppearance: 'none',
  backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='8' viewBox='0 0 12 8'%3E%3Cpath d='M1 1l5 5 5-5' stroke='%23b0b0b0' stroke-width='1.5' fill='none' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E")`,
  backgroundRepeat: 'no-repeat',
  backgroundPosition: 'right 4px center',
  paddingRight: 24,
  cursor: 'pointer',
}

export function PhoneStep({ portraitId }: Props) {
  const [stage, setStage]         = useState<Stage>('input')
  const [phone, setPhone]         = useState('')
  const [timezone, setTimezone]   = useState('Europe/London')
  const [otp, setOtp]             = useState('')
  const [errorMsg, setErrorMsg]   = useState<string | null>(null)

  async function handleSend() {
    setErrorMsg(null)
    setStage('sending')
    try {
      const res = await fetch('/api/whatsapp/send-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone_number: phone }),
      })
      const data = await res.json()
      if (!res.ok) { setErrorMsg(data.error ?? 'Failed to send code.'); setStage('input'); return }
      setStage('sent')
    } catch {
      setErrorMsg('Network error. Please try again.')
      setStage('input')
    }
  }

  async function handleVerify() {
    setErrorMsg(null)
    setStage('verifying')
    try {
      const res = await fetch('/api/whatsapp/verify-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone_number: phone, otp, timezone }),
      })
      const data = await res.json()
      if (!res.ok) { setErrorMsg(data.error ?? 'Verification failed.'); setStage('sent'); return }
      setStage('verified')
    } catch {
      setErrorMsg('Network error. Please try again.')
      setStage('sent')
    }
  }

  // ── Verified state ────────────────────────────────────────────────────────
  if (stage === 'verified') {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
        {/* Coral check */}
        <div style={{
          width: 52, height: 52, borderRadius: '50%', backgroundColor: '#DE3E7B',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
            <path d="M5 13l4 4L19 7" />
          </svg>
        </div>

        <div>
          <p style={{ fontFamily: CORMORANT, fontSize: '1.375rem', fontStyle: 'italic', fontWeight: 400, color: '#1a1a1a', margin: '0 0 8px' }}>
            Number verified.
          </p>
          <p style={{ fontFamily: GEIST, fontSize: '0.875rem', fontWeight: 300, color: '#6b6b6b', margin: 0, lineHeight: 1.7 }}>
            Sunny from Sona will reach out on WhatsApp to schedule your first conversation — a relaxed 15-minute call to get to know you.
          </p>
        </div>

        <a
          href={`/dashboard/create?step=4&portrait_id=${portraitId}`}
          className="sona-btn-dark"
          style={{
            fontFamily: GEIST,
            display: 'inline-block',
            alignSelf: 'flex-start',
            fontSize: '0.9375rem',
            fontWeight: 500,
            letterSpacing: '-0.01em',
            padding: '12px 36px',
            borderRadius: '980px',
            background: '#1a1a1a',
            color: '#fff',
            textDecoration: 'none',
          }}
        >
          Continue
        </a>
      </div>
    )
  }

  // ── Input + OTP form ─────────────────────────────────────────────────────
  const isBusy = stage === 'sending' || stage === 'verifying'

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 32 }}>

      {/* Phone number */}
      <div>
        <label style={LABEL}>WhatsApp number</label>
        <input
          type="tel"
          value={phone}
          onChange={e => setPhone(e.target.value)}
          placeholder="+44 7700 900000"
          disabled={stage === 'sent' || isBusy}
          className="sona-input"
          style={{
            ...INPUT,
            opacity: (stage === 'sent' || isBusy) ? 0.5 : 1,
          }}
        />
      </div>

      {/* Timezone */}
      <div>
        <label style={LABEL}>Your timezone</label>
        <select
          value={timezone}
          onChange={e => setTimezone(e.target.value)}
          disabled={stage === 'sent' || isBusy}
          style={{
            ...SELECT,
            opacity: (stage === 'sent' || isBusy) ? 0.5 : 1,
          }}
        >
          {TIMEZONES.map(tz => (
            <option key={tz.value} value={tz.value}>{tz.label}</option>
          ))}
        </select>
      </div>

      {/* Send code button — shown until code is sent */}
      {stage !== 'sent' && (
        <div>
          <button
            onClick={handleSend}
            disabled={isBusy || !phone.trim()}
            className="sona-btn-dark"
            style={{
              fontFamily: GEIST,
              fontSize: '0.9375rem',
              fontWeight: 500,
              letterSpacing: '-0.01em',
              padding: '12px 36px',
              borderRadius: '980px',
              background: '#1a1a1a',
              color: '#fff',
              border: 'none',
              cursor: (isBusy || !phone.trim()) ? 'default' : 'pointer',
              opacity: (isBusy || !phone.trim()) ? 0.4 : 1,
              transition: 'opacity 0.15s',
            }}
          >
            {stage === 'sending' ? 'Sending…' : 'Send verification code'}
          </button>
        </div>
      )}

      {/* OTP entry — shown after code is sent */}
      {stage === 'sent' && (
        <>
          <div>
            <label style={LABEL}>
              Verification code
              <span style={{ fontWeight: 300, textTransform: 'none', letterSpacing: 0 }}> — sent to {phone}</span>
            </label>
            <input
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              maxLength={6}
              value={otp}
              onChange={e => setOtp(e.target.value.replace(/\D/g, ''))}
              placeholder="6-digit code"
              autoFocus
              className="sona-input"
              style={{ ...INPUT, letterSpacing: '0.2em' }}
            />
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 14 }}>
            <button
              onClick={handleVerify}
              disabled={otp.length < 6 || isBusy}
              className="sona-btn-dark"
              style={{
                fontFamily: GEIST,
                fontSize: '0.9375rem',
                fontWeight: 500,
                letterSpacing: '-0.01em',
                padding: '12px 36px',
                borderRadius: '980px',
                background: '#1a1a1a',
                color: '#fff',
                border: 'none',
                cursor: (otp.length < 6 || isBusy) ? 'default' : 'pointer',
                opacity: (otp.length < 6 || isBusy) ? 0.4 : 1,
                transition: 'opacity 0.15s',
              }}
            >
              {isBusy ? 'Verifying…' : 'Verify'}
            </button>

            {/* Resend */}
            <button
              onClick={() => { setOtp(''); setStage('input'); setErrorMsg(null) }}
              style={{
                fontFamily: GEIST,
                fontSize: '0.8125rem',
                fontWeight: 300,
                color: '#b0b0b0',
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                padding: 0,
              }}
            >
              Didn't receive it? Try again
            </button>
          </div>
        </>
      )}

      {errorMsg && (
        <p style={{ fontFamily: GEIST, fontSize: '0.8125rem', color: '#DE3E7B', margin: 0 }}>
          {errorMsg}
        </p>
      )}

      {/* Skip */}
      <a
        href={`/dashboard/create?step=4&portrait_id=${portraitId}`}
        className="sona-link"
        style={{
          fontFamily: GEIST,
          fontSize: '0.8125rem',
          fontWeight: 300,
          color: '#b0b0b0',
          textDecoration: 'none',
          alignSelf: 'flex-start',
        }}
      >
        Skip for now
      </a>
    </div>
  )
}
