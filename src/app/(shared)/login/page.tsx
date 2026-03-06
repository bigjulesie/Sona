import { Suspense } from 'react'
import { LoginForm } from './LoginForm'
import { getBrand } from '@/lib/brand'

export default async function LoginPage() {
  const brand = await getBrand()
  return (
    <Suspense>
      <LoginForm brand={brand} />
    </Suspense>
  )
}
