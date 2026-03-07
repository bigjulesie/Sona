'use client'

import { useState, useTransition } from 'react'
import { deleteAccount } from './actions'

const GEIST = 'var(--font-geist-sans)'

export function DeleteAccountButton() {
  const [confirming, setConfirming] = useState(false)
  const [confirmText, setConfirmText] = useState('')
  const [isPending, startTransition] = useTransition()
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  function handleDelete() {
    setErrorMessage(null)
    startTransition(async () => {
      try {
        await deleteAccount()
      } catch {
        setErrorMessage('Could not delete account. Please try again.')
      }
    })
  }

  return (
    <div style={{
      border: '1px solid rgba(222,62,123,0.15)',
      borderRadius: 14,
      padding: '24px',
      backgroundColor: 'rgba(222,62,123,0.02)',
    }}>
      <p style={{
        fontFamily: GEIST, fontSize: '0.6875rem', fontWeight: 500,
        letterSpacing: '0.09em', textTransform: 'uppercase',
        color: '#DE3E7B', margin: '0 0 8px',
      }}>
        Danger zone
      </p>

      {!confirming ? (
        <>
          <p style={{ fontFamily: GEIST, fontSize: '0.875rem', fontWeight: 300, color: '#6b6b6b', margin: '0 0 16px' }}>
            Permanently delete your account and all associated data. This cannot be undone.
          </p>
          <button
            type="button"
            onClick={() => setConfirming(true)}
            style={{
              fontFamily: GEIST, fontSize: '0.875rem', fontWeight: 400,
              color: '#DE3E7B', border: '1px solid rgba(222,62,123,0.3)',
              borderRadius: '980px', padding: '10px 24px',
              background: 'transparent', cursor: 'pointer',
            }}
          >
            Delete account
          </button>
        </>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <p style={{ fontFamily: GEIST, fontSize: '0.875rem', fontWeight: 300, color: '#1a1a1a', margin: 0 }}>
            Type <strong>DELETE</strong> to confirm.
          </p>
          <input
            type="text"
            value={confirmText}
            onChange={e => setConfirmText(e.target.value)}
            placeholder="DELETE"
            autoFocus
            disabled={isPending}
            style={{
              fontFamily: GEIST, fontSize: '0.9375rem', fontWeight: 300,
              color: '#1a1a1a', outline: 'none', border: 'none',
              borderBottom: '1px solid rgba(0,0,0,0.15)',
              backgroundColor: 'transparent', padding: '6px 0',
              maxWidth: 200,
              opacity: isPending ? 0.5 : 1,
            }}
          />
          <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
            <button
              onClick={handleDelete}
              disabled={confirmText !== 'DELETE' || isPending}
              style={{
                fontFamily: GEIST, fontSize: '0.875rem', fontWeight: 500,
                color: '#fff', backgroundColor: '#DE3E7B',
                border: 'none', borderRadius: '980px', padding: '10px 24px',
                cursor: confirmText !== 'DELETE' || isPending ? 'default' : 'pointer',
                opacity: confirmText !== 'DELETE' || isPending ? 0.4 : 1,
              }}
            >
              {isPending ? 'Deleting…' : 'Delete my account'}
            </button>
            <button
              type="button"
              onClick={() => { setConfirming(false); setConfirmText('') }}
              disabled={isPending}
              style={{
                fontFamily: GEIST, fontSize: '0.8125rem', fontWeight: 400,
                color: '#b0b0b0', background: 'none', border: 'none',
                padding: 0, cursor: isPending ? 'default' : 'pointer',
                opacity: isPending ? 0.4 : 1,
              }}
            >
              Cancel
            </button>
          </div>
          {errorMessage && (
            <p style={{ fontFamily: GEIST, fontSize: '0.8125rem', color: '#DE3E7B', margin: '4px 0 0' }}>
              {errorMessage}
            </p>
          )}
        </div>
      )}
    </div>
  )
}
