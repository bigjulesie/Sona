'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

interface Props {
  portraitId: string
  isFree: boolean
  isLoggedIn: boolean
  slug: string
}

export function SubscribeButton({ portraitId, isFree, isLoggedIn, slug }: Props) {
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  async function handleClick() {
    if (!isLoggedIn) {
      router.push(`/login?next=/sona/${slug}`)
      return
    }
    setLoading(true)
    try {
      if (isFree) {
        await fetch('/api/subscriptions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ portrait_id: portraitId }),
        })
        router.refresh()
      } else {
        const res = await fetch('/api/stripe/checkout', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ portrait_id: portraitId }),
        })
        const { url } = await res.json()
        if (url) window.location.href = url
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <button onClick={handleClick} disabled={loading}
      className="px-6 py-2.5 bg-gray-900 text-white rounded-xl font-medium hover:bg-gray-700 disabled:opacity-50 transition-colors">
      {loading ? 'Loading…' : isFree ? 'Follow for free' : 'Subscribe'}
    </button>
  )
}
