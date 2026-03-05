'use client'

import { useEffect } from 'react'

/** Silently reconciles Stripe subscription state on account page load. */
export function AccountSync() {
  useEffect(() => {
    fetch('/api/stripe/sync', { method: 'POST' }).catch(() => {})
  }, [])
  return null
}
