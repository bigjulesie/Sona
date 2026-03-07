'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { updateProfile } from './actions'

const GEIST = 'var(--font-geist-sans)'

interface ProfileFormProps {
  fullName: string
  email: string
  saved: boolean
}

export function ProfileForm({ fullName, email, saved }: ProfileFormProps) {
  const [showEmailForm, setShowEmailForm] = useState(false)
  const [newEmail, setNewEmail] = useState('')
  const [emailStatus, setEmailStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle')

  async function handleEmailChange(e: React.FormEvent) {
    e.preventDefault()
    if (!newEmail.trim()) return
    setEmailStatus('sending')
    const supabase = createClient()
    const { error } = await supabase.auth.updateUser({ email: newEmail.trim() })
    if (error) {
      setEmailStatus('error')
    } else {
      setEmailStatus('sent')
      setNewEmail('')
    }
  }

  return (
    <div>
      {/* ── Name form ─────────────────────────────────────── */}
      <form action={updateProfile}>
        <div style={{ marginBottom: 24 }}>
          <label style={{
            fontFamily: GEIST, fontSize: '0.6875rem', fontWeight: 500,
            letterSpacing: '0.09em', textTransform: 'uppercase',
            color: '#b0b0b0', display: 'block', marginBottom: 8,
          }}>
            Full name
          </label>
          <input
            name="full_name"
            type="text"
            defaultValue={fullName}
            placeholder="Your name"
            className="sona-input"
            style={{
              fontFamily: GEIST, fontSize: '0.9375rem', fontWeight: 300,
              color: '#1a1a1a', width: '100%', outline: 'none',
              border: 'none', borderBottom: '1px solid rgba(0,0,0,0.15)',
              backgroundColor: 'transparent', padding: '6px 0',
              boxSizing: 'border-box',
            }}
          />
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button
            type="submit"
            className="sona-btn-dark"
            style={{
              fontFamily: GEIST, fontSize: '0.875rem', fontWeight: 500,
              letterSpacing: '-0.01em', color: '#fff', backgroundColor: '#1a1a1a',
              border: 'none', borderRadius: '980px', padding: '10px 24px',
              cursor: 'pointer',
            }}
          >
            Save
          </button>
          {saved && (
            <span style={{ fontFamily: GEIST, fontSize: '0.8125rem', fontWeight: 300, color: '#9b9b9b' }}>
              Saved
            </span>
          )}
        </div>
      </form>

      {/* ── Email section ─────────────────────────────────── */}
      <div style={{ marginTop: 32 }}>
        <p style={{
          fontFamily: GEIST, fontSize: '0.6875rem', fontWeight: 500,
          letterSpacing: '0.09em', textTransform: 'uppercase',
          color: '#b0b0b0', margin: '0 0 8px',
        }}>
          Email address
        </p>
        <p style={{ fontFamily: GEIST, fontSize: '0.9375rem', fontWeight: 300, color: '#1a1a1a', margin: '0 0 12px' }}>
          {email}
        </p>

        {!showEmailForm && emailStatus !== 'sent' && (
          <button
            onClick={() => setShowEmailForm(true)}
            className="sona-link"
            style={{
              fontFamily: GEIST, fontSize: '0.8125rem', fontWeight: 400,
              color: '#6b6b6b', background: 'none', border: 'none',
              padding: 0, cursor: 'pointer', textDecoration: 'underline',
              textUnderlineOffset: 3,
            }}
          >
            Change email address
          </button>
        )}

        {emailStatus === 'sent' && (
          <p style={{ fontFamily: GEIST, fontSize: '0.8125rem', fontWeight: 300, color: '#9b9b9b', margin: 0 }}>
            Confirmation sent — check your new inbox to complete the change.
          </p>
        )}

        {showEmailForm && emailStatus !== 'sent' && (
          <form onSubmit={handleEmailChange} style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
            <input
              type="email"
              value={newEmail}
              onChange={e => {
                setNewEmail(e.target.value)
                if (emailStatus === 'error') setEmailStatus('idle')
              }}
              placeholder="New email address"
              required
              className="sona-input"
              style={{
                fontFamily: GEIST, fontSize: '0.9375rem', fontWeight: 300,
                color: '#1a1a1a', outline: 'none', border: 'none',
                borderBottom: '1px solid rgba(0,0,0,0.15)',
                backgroundColor: 'transparent', padding: '6px 0',
                maxWidth: 320,
              }}
            />
            {emailStatus === 'error' && (
              <p style={{ fontFamily: GEIST, fontSize: '0.8125rem', color: '#DE3E7B', margin: 0 }}>
                Unable to update email. Please try again.
              </p>
            )}
            <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
              <button
                type="submit"
                disabled={emailStatus === 'sending'}
                className="sona-btn-dark"
                style={{
                  fontFamily: GEIST, fontSize: '0.875rem', fontWeight: 500,
                  color: '#fff', backgroundColor: '#1a1a1a', border: 'none',
                  borderRadius: '980px', padding: '10px 24px',
                  cursor: emailStatus === 'sending' ? 'default' : 'pointer',
                  opacity: emailStatus === 'sending' ? 0.5 : 1,
                }}
              >
                {emailStatus === 'sending' ? 'Sending…' : 'Send confirmation'}
              </button>
              <button
                type="button"
                onClick={() => { setShowEmailForm(false); setEmailStatus('idle'); setNewEmail('') }}
                disabled={emailStatus === 'sending'}
                style={{
                  fontFamily: GEIST, fontSize: '0.8125rem', fontWeight: 400,
                  color: '#b0b0b0', background: 'none', border: 'none',
                  padding: 0, cursor: emailStatus === 'sending' ? 'default' : 'pointer',
                  opacity: emailStatus === 'sending' ? 0.4 : 1,
                }}
              >
                Cancel
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}
