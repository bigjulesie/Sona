'use client'

import { useActionState } from 'react'
import { saveVerifyStep } from './actions'

const GEIST = 'var(--font-geist-sans)'

const LABEL_STYLE: React.CSSProperties = {
  fontFamily: GEIST,
  fontSize: '0.6875rem',
  fontWeight: 500,
  letterSpacing: '0.09em',
  textTransform: 'uppercase',
  color: '#b0b0b0',
  display: 'block',
  marginBottom: 10,
}

const INPUT_STYLE: React.CSSProperties = {
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

export function VerifyStep({ portraitId }: { portraitId: string }) {
  const [state, formAction, isPending] = useActionState(saveVerifyStep, null)

  return (
    <form action={formAction} style={{ display: 'flex', flexDirection: 'column', gap: 32 }}>
      <input type="hidden" name="portrait_id" value={portraitId} />

      {/* LinkedIn URL */}
      <div>
        <label htmlFor="linkedin_url" style={LABEL_STYLE}>
          LinkedIn{' '}
          <span style={{ fontWeight: 300, textTransform: 'none', letterSpacing: 0 }}>
            — optional
          </span>
        </label>
        <input
          id="linkedin_url"
          name="linkedin_url"
          type="url"
          placeholder="linkedin.com/in/yourname"
          className="sona-input"
          style={INPUT_STYLE}
        />
        {state?.field === 'linkedin_url' && state?.error && (
          <span style={{ fontFamily: GEIST, fontSize: '0.75rem', color: '#e55', marginTop: 4, display: 'block' }}>
            {state.error}
          </span>
        )}
      </div>

      {/* Search context */}
      <div>
        <label htmlFor="search_context" style={LABEL_STYLE}>
          Search context{' '}
          <span style={{ fontWeight: 300, textTransform: 'none', letterSpacing: 0 }}>
            — optional
          </span>
        </label>
        <input
          id="search_context"
          name="search_context"
          type="text"
          placeholder={`e.g. "AI researcher", "venture capitalist"`}
          className="sona-input"
          style={INPUT_STYLE}
        />
        {state?.field === 'search_context' && state?.error && (
          <span style={{ fontFamily: GEIST, fontSize: '0.75rem', color: '#e55', marginTop: 4, display: 'block' }}>
            {state.error}
          </span>
        )}
      </div>

      {/* Personal website */}
      <div>
        <label htmlFor="website_url" style={LABEL_STYLE}>
          Website{' '}
          <span style={{ fontWeight: 300, textTransform: 'none', letterSpacing: 0 }}>
            — optional
          </span>
        </label>
        <input
          id="website_url"
          name="website_url"
          type="url"
          placeholder="https://yourwebsite.com"
          className="sona-input"
          style={INPUT_STYLE}
        />
        {state?.field === 'website_url' && state?.error && (
          <span style={{ fontFamily: GEIST, fontSize: '0.75rem', color: '#e55', marginTop: 4, display: 'block' }}>
            {state.error}
          </span>
        )}
      </div>

      {state?.error && !state?.field && (
        <p style={{ fontFamily: GEIST, fontSize: '0.8125rem', color: '#e55', margin: '0 0 16px' }}>
          {state.error}
        </p>
      )}

      <div>
        <button
          type="submit"
          disabled={isPending}
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
            cursor: isPending ? 'default' : 'pointer',
            opacity: isPending ? 0.5 : 1,
          }}
        >
          {isPending ? 'Saving…' : 'Continue'}
        </button>
      </div>
    </form>
  )
}
