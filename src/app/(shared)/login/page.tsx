import { headers } from 'next/headers'
import { Suspense } from 'react'
import { LoginForm } from './LoginForm'

export default async function LoginPage() {
  const hdrs = await headers()
  const brand = hdrs.get('x-brand') ?? 'nh'
  return (
    <Suspense>
      <LoginForm brand={brand} />
    </Suspense>
  )
}
